// Essai RÉEL de bout en bout (PLAN.md, 14.5) : vrais modèles d'IA, vraie base, vrai Buffer. Seuls Inngest et les clics de l'interface
// sont remplacés par ce script, qui appelle les MÊMES fonctions que l'application, dans le même ordre :
//   1. la personne écrit au Maître (sendMessageAs) -> plan et tâches en base
//   2. les agents exécutent leurs tâches (executeTask), dans l'ordre des dépendances
//   3. le Maître relit (executeReview) : il conclut par un rapport, ou renvoie des tâches (on les réexécute)
//   4. la personne reprend le post produit et le PROGRAMME dans 7 jours sur Bluesky (savePostAndPublish) -> envoyé à Buffer
//   5. on vérifie chez Buffer qu'il est bien programmé, puis on le DÉPROGRAMME (unscheduleAndCancel). Rien n'est publié.
// Usage : node scripts/run-e2e-real.mjs [fichier-rapport.json]
// Demande : DATABASE_URL, BUFFER_API_KEY (avec un canal Bluesky connecté), et des modèles (Gemini et/ou OpenRouter).
// Crée un utilisateur jetable, puis supprime tout. Les modèles gratuits peuvent journaliser les requêtes : rien de privé ici.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import postgres from "postgres";

import { createLoader } from "./lib/load-ts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const reportFile = process.argv[2] ?? path.join(root, ".next", "e2e-report.json");
const load = createLoader(root);
const sql = postgres(process.env.DATABASE_URL, { max: 2, prepare: false, onnotice: () => {} });

const Chat = load("src/lib/chat-service.ts");
const Runner = load("src/lib/task-runner.ts");
const Review = load("src/lib/review-service.ts");
const Accounts = load("src/lib/account-service.ts");
const Pub = load("src/lib/publishing.ts");
const { publisher } = load("src/lib/buffer.ts");
const { buildPostText, CAPTION_LIMITS } = load("src/lib/post-rules.ts");

const REQUEST = [
  "Prépare UN post pour Bluesky (300 caractères maximum, hashtags compris) qui annonce Socialix :",
  "une application où une équipe d'agents IA prépare les posts des réseaux sociaux, et où la personne valide tout avant publication.",
  "Public : petits commerces et indépendants. Ton : chaleureux, simple, sans exagération.",
  "Pas de date à fixer, je la choisirai moi-même. N'invente aucun chiffre, aucun client, aucun témoignage.",
].join(" ");

const report = { startedAt: new Date().toISOString(), request: REQUEST, steps: [], problems: [] };
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const log = (step, data = {}) => {
  report.steps.push({ at: elapsed(), step, ...data });
  console.log(`[${elapsed()}] ${step}${Object.keys(data).length ? ` ${JSON.stringify(data).slice(0, 400)}` : ""}`);
};
const problem = (text) => {
  report.problems.push(text);
  console.log(`[${elapsed()}] PROBLÈME : ${text}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const uid = `e2e-${Date.now()}`;
let projectId = null;

// Exécute toutes les tâches prêtes d'un plan, jusqu'à ce qu'il n'y en ait plus. Un quota épuisé met une tâche en pause 15 minutes :
// pour l'essai, on attend une minute (le repos des modèles en quota) puis on la relance, trois fois au plus.
async function runAllTasks(planId) {
  for (let guard = 0; guard < 30; guard++) {
    const ready = await Runner.findReadyTasks({ planId });
    if (ready.length === 0) {
      const deferred = await sql`select id from agent_tasks where plan_id = ${planId} and status = 'pending' and last_error is not null`;
      if (deferred.length === 0) return;
      if (guard > 20) return problem("des tâches restent en pause après plusieurs essais");
      log("pause : un modèle est en quota, on attend 65 s puis on relance", { tâches: deferred.length });
      await sleep(65_000);
      await sql`update agent_tasks set next_run_at = null where plan_id = ${planId} and status = 'pending'`;
      continue;
    }
    for (const taskId of ready) {
      const [task] = await sql`select position, agent, title from agent_tasks where id = ${taskId}`;
      const started = Date.now();
      const result = await Runner.executeTask(taskId);
      const [after] = await sql`select status, last_error, output from agent_tasks where id = ${taskId}`;
      log(`tâche ${task.position} (${task.agent}) « ${task.title} »`, { issue: result.outcome, état: after.status, erreur: after.last_error, modèle: after.output?.model, durée: `${((Date.now() - started) / 1000).toFixed(0)} s` });
    }
  }
}

try {
  // ---------------------------------------------------------------- préparation
  await sql`insert into "user" (id, name, email) values (${uid}, 'Essai de bout en bout', ${`${uid}@example.invalid`})`;
  [{ id: projectId }] = await sql`insert into projects (user_id, name) values (${uid}, 'Essai Socialix') returning id`;
  const channels = await publisher.listChannels();
  if (!channels.ok) throw new Error(`Buffer : ${channels.message}`);
  const bluesky = channels.channels.find((c) => c.platform === "bluesky" && !c.disconnected && !c.locked);
  if (!bluesky) throw new Error("aucun canal Bluesky utilisable chez Buffer");
  const linked = await Accounts.linkAccountAs(uid, projectId, bluesky.id);
  log("compte Bluesky lié au projet", { ok: linked.ok, compte: bluesky.name });

  // ---------------------------------------------------------------- 1. la demande au Maître
  let sent = await Chat.sendMessageAs(uid, projectId, "maitre", REQUEST, { onPlanCreated: async () => {} });
  if (!sent.ok) throw new Error(`Maître : ${sent.error}`);
  log("réponse du Maître", { modèle: sent.messages[1]?.model, texte: sent.messages[1]?.content });
  if (!sent.plan) {
    // Le Maître a posé une question : on répond comme le ferait la personne, une fois
    sent = await Chat.sendMessageAs(uid, projectId, "maitre", "Tout est dans ma demande : un seul post Bluesky, sans date. Fais le plan.", { onPlanCreated: async () => {} });
    if (!sent.ok) throw new Error(`Maître (2e message) : ${sent.error}`);
    log("2e réponse du Maître", { modèle: sent.messages[1]?.model, texte: sent.messages[1]?.content });
  }
  if (!sent.plan) throw new Error("le Maître n'a pas produit de plan");
  const planId = sent.plan.id;
  report.plan = { summary: sent.plan.summary, tasks: sent.plan.tasks.map((t) => ({ position: t.position, agent: t.agent, title: t.title, instruction: t.instruction, dependsOn: t.dependsOn })) };
  log("plan", report.plan);

  // ---------------------------------------------------------------- 2 et 3. les agents, puis la relecture du Maître
  for (let round = 0; round < 4; round++) {
    await runAllTasks(planId);
    let review = await Review.executeReview(planId);
    for (let i = 0; i < 3 && review.outcome === "deferred"; i++) {
      log("relecture remise à plus tard (quota) : on attend 65 s");
      await sleep(65_000);
      review = await Review.executeReview(planId);
    }
    const [plan] = await sql`select status, report, review_round from agent_plans where id = ${planId}`;
    log(`relecture du Maître (tour ${round + 1})`, { issue: review.outcome, état: plan.status, renvois: plan.review_round, rapport: plan.report });
    if (review.outcome !== "redo") break;
  }

  const tasks = await sql`select position, agent, title, status, last_error, output from agent_tasks where plan_id = ${planId} order by position`;
  report.tasks = tasks.map((t) => ({ position: t.position, agent: t.agent, title: t.title, status: t.status, error: t.last_error, model: t.output?.model ?? null, result: t.output?.text ?? null }));
  const [finalPlan] = await sql`select status, report, review_round from agent_plans where id = ${planId}`;
  report.review = finalPlan;
  const docs = await sql`select kind, title, author, status from documents where project_id = ${projectId}`;
  report.documents = docs;
  const drafts = await sql`select id, title, caption, hashtags, platforms, status, created_by from posts where project_id = ${projectId}`;
  report.drafts = drafts;
  log("ce que l'équipe a produit", { documents: docs.length, brouillons_de_post: drafts.length });

  // ---------------------------------------------------------------- 4. la personne programme le post (dans 7 jours)
  let postId = null;
  let caption;
  let hashtags = [];
  if (drafts.length > 0) {
    postId = drafts[0].id;
    caption = drafts[0].caption;
    hashtags = drafts[0].hashtags;
  } else {
    problem("aucun brouillon de post n'a été déposé par l'équipe : on reprend le texte du dernier livrable, comme le ferait la personne");
    const last = [...report.tasks].reverse().find((t) => t.result);
    caption = (last?.result ?? "").trim();
  }
  const full = buildPostText(caption, hashtags);
  report.proposedText = full;
  if (full.length > CAPTION_LIMITS.bluesky) {
    problem(`le texte proposé fait ${full.length} caractères, au-delà des 300 de Bluesky : la personne devrait le raccourcir`);
    caption = caption.slice(0, 280);
    hashtags = [];
  }
  const day = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const saved = await Pub.savePostAndPublish(uid, projectId, postId, { title: "Annonce de Socialix (essai)", caption, hashtags, platforms: ["bluesky"], imageUrl: null, day, time: "10:00" }, "schedule");
  log("la personne programme le post dans 7 jours", { ok: saved.ok, erreur: saved.ok ? undefined : saved.error ?? saved.errors });
  if (!saved.ok) throw new Error("programmation refusée");
  postId = saved.id;

  // ---------------------------------------------------------------- 5. vérification chez Buffer, puis déprogrammation
  const [delivery] = await sql`select external_id, status, due_at from post_deliveries where post_id = ${postId}`;
  const atBuffer = await publisher.state(delivery.external_id);
  report.buffer = { scheduled: atBuffer, dueAt: delivery.due_at };
  log("chez Buffer", { état: atBuffer.ok ? atBuffer.state : atBuffer.reason, prévu: delivery.due_at });
  if (!atBuffer.ok || atBuffer.state !== "scheduled") problem("Buffer ne montre pas le post comme programmé");

  const unscheduled = await Pub.unscheduleAndCancel(uid, projectId, postId);
  const afterCancel = await publisher.state(delivery.external_id);
  report.buffer.afterCancel = afterCancel;
  log("déprogrammé", { ok: unscheduled.ok, chez_Buffer_ensuite: afterCancel.ok ? afterCancel.state : afterCancel.reason });
  if (afterCancel.ok && afterCancel.state === "scheduled") problem("le post est toujours programmé chez Buffer après l'annulation");
} catch (error) {
  problem(`arrêt : ${error instanceof Error ? error.message : String(error)}`);
} finally {
  // Rien ne doit rester programmé chez Buffer : on annule tout envoi encore présent avant de supprimer l'utilisateur jetable
  if (projectId) {
    const left = await sql`select d.external_id from post_deliveries d join posts p on p.id = d.post_id where p.project_id = ${projectId} and d.status = 'scheduled'`;
    for (const d of left) {
      const r = await publisher.cancel(d.external_id);
      log("nettoyage : annulation chez Buffer", { ok: r.ok });
    }
  }
  await sql`delete from "user" where id = ${uid}`;
  report.durationSeconds = Math.round((Date.now() - t0) / 1000);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\nterminé en ${report.durationSeconds} s, ${report.problems.length} problème(s). Rapport : ${reportFile}`);
  await sql.end();
}
