import "server-only";

import { and, asc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { agentCommunications, agentPlans, agentTaskDependencies, agentTasks, posts, projects } from "@/db/schema";
import { findAgent } from "@/lib/agents";
import { ChatError, type ModelOptions } from "@/lib/chat";
import { runReview, type ReviewResult } from "@/lib/review";
import { IMAGE_REQUIRED, isPlatform, networkName, textLengths } from "@/lib/post-rules";
import { scanForInjection } from "@/lib/prompt-safety";
import { type ReviewTask, withFeedback } from "@/lib/review-rules";
import { findReadyTasks } from "@/lib/task-runner";

// La revue du Maître côté base (chapitre 13b), SANS rien de propre à Inngest, comme task-runner.ts : Inngest ne fait que
// déclencher executeReview. Toutes les règles (une seule revue à la fois par plan, jamais après une annulation, plafond d'échecs)
// sont décidées ICI, dans la base, donc vraies même si l'événement arrive deux fois.

export const REVIEW_STALE_MINUTES = 10; // une revue « en cours » depuis plus longtemps est considérée comme abandonnée
export const MAX_REVIEW_FAILURES = 3; // revues ratées avant de conclure sans relecture (sinon un modèle en panne boucle sans fin)

const NO_RESULT_REPORT = "Aucune tâche de ce plan n'a abouti : il n'y a donc rien à relire. Regarde le détail de chaque tâche pour savoir ce qui s'est passé, puis refais une demande si besoin.";
const FALLBACK_REPORT = "Le Maître n'a pas pu relire ce travail : le modèle n'a pas répondu correctement après plusieurs essais. Les résultats de chaque tâche sont disponibles. Relis-les toi-même avant de t'en servir.";

export type ReviewRunOutcome = "concluded" | "redo" | "fallback" | "deferred" | "skipped";
export type ReviewRunResult = { outcome: ReviewRunOutcome; readyTaskIds: string[] };

// Les plans qui attendent leur revue, les plus anciens d'abord : actifs, sans rapport, avec au moins une tâche, aucune tâche
// ouverte, et personne ne les relit en ce moment. Sert au balayage régulier (le filet de sécurité d'un événement perdu).
export async function findPlansToReview(limit = 10): Promise<string[]> {
  const rows = await db.execute(sql`
    select p.id from agent_plans p
    where p.status = 'active' and p.report is null
      and (p.review_started_at is null or p.review_started_at < now() - make_interval(mins => ${REVIEW_STALE_MINUTES}))
      and exists (select 1 from agent_tasks t where t.plan_id = p.id)
      and not exists (select 1 from agent_tasks t where t.plan_id = p.id and t.status in ('pending', 'running'))
    order by p.created_at limit ${limit}`);
  return rows.map((r) => r.id as string);
}

type Claimed = { id: string; projectId: string; request: string; summary: string; round: number; failures: number; token: string; createdAt: Date };

// Réserve la revue : « personne ne relit ce plan » devient « je le relis » en UNE instruction, avec toutes les conditions dans le
// même WHERE (comme claimTask). Deux appels simultanés : la base n'en laisse passer qu'un. Le jeton rendu est l'heure exacte de la
// réservation : toute écriture suivante le revérifie, pour qu'une revue trop lente n'écrase pas celle qui l'a remplacée.
async function claimReview(planId: string): Promise<Claimed | null> {
  const rows = await db.execute(sql`
    update agent_plans p set review_started_at = now()
    where p.id = ${planId} and p.status = 'active' and p.report is null
      and (p.review_started_at is null or p.review_started_at < now() - make_interval(mins => ${REVIEW_STALE_MINUTES}))
      and exists (select 1 from agent_tasks t where t.plan_id = p.id)
      and not exists (select 1 from agent_tasks t where t.plan_id = p.id and t.status in ('pending', 'running'))
    returning p.id, p.project_id, p.request, p.summary, p.review_round, p.review_failures, p.created_at, extract(epoch from p.review_started_at)::text as token`);
  const r = rows[0];
  if (!r) return null;
  return { id: r.id as string, projectId: r.project_id as string, request: r.request as string, summary: r.summary as string, round: r.review_round as number, failures: r.review_failures as number, token: r.token as string, createdAt: new Date(r.created_at as string | Date) };
}

// « Cette revue est toujours la mienne » : plan actif, pas encore conclu, et réservé avec CE jeton.
const mine = (c: Claimed) => and(eq(agentPlans.id, c.id), eq(agentPlans.status, "active"), isNull(agentPlans.report), sql`extract(epoch from ${agentPlans.reviewStartedAt})::text = ${c.token}`);

// Conclut le plan : le rapport s'écrit et le plan passe à « terminé » dans la MÊME instruction. Faux si le plan a été annulé ou
// repris par une autre revue entre-temps (on n'écrase rien).
async function conclude(c: Claimed, report: string): Promise<boolean> {
  const done = await db.update(agentPlans).set({ status: "done", report }).where(mine(c)).returning({ id: agentPlans.id });
  return done.length > 0;
}

// Abandonne cette revue sans conclure (le balayage la reprendra). `failure` : compte comme un échec (pas un quota épuisé).
async function release(c: Claimed, failure: boolean): Promise<void> {
  await db.update(agentPlans).set({ reviewStartedAt: null, reviewFailures: sql`${agentPlans.reviewFailures} + ${failure ? 1 : 0}` }).where(mine(c));
}

type TaskRow = typeof agentTasks.$inferSelect;

// Ce que le PROGRAMME constate sur les brouillons de post déposés par l'équipe pendant ce plan : la longueur réelle par réseau
// (hashtags compris), une image manquante quand le réseau l'exige, ou l'absence de brouillon alors que le Créateur avait une tâche.
// Ces faits vont au Maître : il n'a pas à compter lui-même (il en est incapable de façon fiable).
async function draftChecks(c: Claimed, rows: TaskRow[]): Promise<string[]> {
  const drafts = await db
    .select({ title: posts.title, caption: posts.caption, hashtags: posts.hashtags, platforms: posts.platforms, imageUrl: posts.imageUrl })
    .from(posts)
    .where(and(eq(posts.projectId, c.projectId), eq(posts.createdBy, "agent"), gte(posts.createdAt, c.createdAt)));
  const lines: string[] = [];
  for (const d of drafts) {
    const title = scanForInjection(d.title).safe ? d.title.slice(0, 80) : "(titre écarté)";
    const platforms = d.platforms.filter(isPlatform);
    for (const l of textLengths(d.caption, d.hashtags, platforms)) {
      lines.push(`Brouillon « ${title} » pour ${networkName(l.platform)} : ${l.length} caractères sur ${l.limit} autorisés, hashtags compris${l.length > l.limit ? " : TROP LONG, à renvoyer au Créateur" : ""}.`);
    }
    const needImage = platforms.filter((p) => IMAGE_REQUIRED.includes(p));
    if (!d.imageUrl && needImage.length > 0) lines.push(`Brouillon « ${title} » : pas d'image, alors que ${needImage.map(networkName).join(" et ")} en exige une.`);
  }
  if (drafts.length === 0 && rows.some((t) => t.agent === "createur" && t.status === "done")) lines.push("Aucun brouillon de post n'a été déposé pendant ce plan, alors que le Créateur avait une tâche.");
  return lines;
}

// Le Maître renvoie des tâches : en UNE transaction, le plan passe au tour suivant, les tâches renvoyées reçoivent le retour dans
// leur consigne et repartent, ainsi que les tâches terminées qui s'appuyaient sur elles. Les autres (en échec, annulées) ne
// bougent pas : une tâche remise en attente derrière une tâche en échec ne partirait jamais et bloquerait le plan.
async function applyRedo(c: Claimed, review: ReviewResult, rows: TaskRow[]): Promise<boolean> {
  const byPosition = new Map(rows.map((t) => [t.position, t]));
  const feedbackOf = new Map(review.redo.map((r) => [r.position, r.feedback]));
  return db.transaction(async (tx) => {
    const advanced = await tx.update(agentPlans).set({ reviewRound: sql`${agentPlans.reviewRound} + 1`, reviewStartedAt: null }).where(mine(c)).returning({ id: agentPlans.id });
    if (advanced.length === 0) return false;
    for (const position of review.toReset) {
      const task = byPosition.get(position);
      if (!task) continue;
      const feedback = feedbackOf.get(position);
      const reset = await tx
        .update(agentTasks)
        .set({
          status: "pending",
          attempts: 0,
          lastError: null,
          nextRunAt: null,
          startedAt: null,
          finishedAt: null,
          ...(feedback !== undefined ? { instruction: withFeedback(task.instruction, feedback) ?? task.instruction } : {}),
        })
        .where(and(eq(agentTasks.id, task.id), eq(agentTasks.status, "done")))
        .returning({ id: agentTasks.id });
      if (reset.length > 0 && feedback !== undefined) await tx.insert(agentCommunications).values({ taskId: task.id, fromAgent: "maitre", toAgent: task.agent, message: feedback });
    }
    return true;
  });
}

// Fait relire le plan par le Maître, puis conclut ou renvoie. Ne lève pas d'erreur pour un modèle qui ne répond pas : la revue est
// remise à plus tard (voir MAX_REVIEW_FAILURES). `options` remplace modèles et fabrique de modèles (tests : faux modèle).
export async function executeReview(planId: string, options: ModelOptions = {}): Promise<ReviewRunResult> {
  const skipped: ReviewRunResult = { outcome: "skipped", readyTaskIds: [] };
  const claimed = await claimReview(planId);
  if (!claimed) return skipped; // quelqu'un d'autre le relit, ou il n'est plus à relire : rien à faire

  const rows = await db.select().from(agentTasks).where(eq(agentTasks.planId, planId)).orderBy(asc(agentTasks.position));
  const links = await db.select().from(agentTaskDependencies).where(inArray(agentTaskDependencies.taskId, rows.map((t) => t.id)));
  const positionOf = new Map(rows.map((t) => [t.id, t.position]));
  const tasks: ReviewTask[] = rows.map((t) => ({
    position: t.position,
    agentName: findAgent(t.agent)?.name ?? t.agent,
    title: t.title,
    instruction: t.instruction,
    status: t.status,
    result: typeof (t.output as { text?: unknown } | null)?.text === "string" ? (t.output as { text: string }).text : null,
    dependsOn: links.filter((l) => l.taskId === t.id).map((l) => positionOf.get(l.dependsOnTaskId)!).sort((a, b) => a - b),
  }));

  // Rien à relire : pas d'appel au modèle (il ne coûte pas de quota pour dire qu'il n'y a rien).
  if (!tasks.some((t) => t.status === "done")) return (await conclude(claimed, NO_RESULT_REPORT)) ? { outcome: "concluded", readyTaskIds: [] } : skipped;

  const [project] = await db.select({ teams: projects.teams }).from(projects).where(eq(projects.id, claimed.projectId)).limit(1);
  let review: ReviewResult;
  try {
    review = await runReview({ request: claimed.request, summary: claimed.summary, tasks, round: claimed.round, checks: await draftChecks(claimed, rows) }, { ...options, teams: project?.teams });
  } catch (error) {
    const quota = error instanceof ChatError && error.reason === "quota";
    // Journal : jamais error.message (il peut contenir du texte de la personne ou des détails de requête)
    console.error("Revue : l'appel a échoué", planId, error instanceof ChatError ? error.reason : error instanceof Error ? error.name : "?");
    // Un quota épuisé n'est la faute de personne : on réessaie plus tard sans compter. Tout autre échec compte, et au plafond on
    // conclut sans relecture plutôt que de laisser le plan « actif » pour toujours.
    if (!quota && claimed.failures + 1 >= MAX_REVIEW_FAILURES) return (await conclude(claimed, FALLBACK_REPORT)) ? { outcome: "fallback", readyTaskIds: [] } : skipped;
    await release(claimed, !quota);
    return { outcome: "deferred", readyTaskIds: [] };
  }

  if (review.decision === "complete") return (await conclude(claimed, review.report)) ? { outcome: "concluded", readyTaskIds: [] } : skipped;
  if (!(await applyRedo(claimed, review, rows))) return skipped;
  return { outcome: "redo", readyTaskIds: await findReadyTasks({ planId }) };
}
