import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { agentPlans, agentTaskDependencies, agentTasks } from "@/db/schema";
import { ownsCampaign } from "@/lib/ownership";
import type { CancelResult, PlanView } from "@/lib/plan-types";

// Lecture et annulation des plans. Comme chat-service, ces fonctions prennent le propriétaire (`userId`) en paramètre :
// l'action serveur et la DAL le tirent de la session, jamais d'une adresse ou d'un formulaire.

// Les plans d'une campagne (les plus récents d'abord) avec leurs tâches et dépendances. Liste vide si la campagne n'est
// pas à la personne. `onlyPlanId` : un seul plan (vérifié sur la campagne, pour qu'un identifiant d'une autre campagne ne passe pas).
export async function readPlans(userId: string, campaignId: string, options: { limit?: number; onlyPlanId?: string } = {}): Promise<PlanView[]> {
  const { limit = 20, onlyPlanId } = options;
  if (onlyPlanId !== undefined && !z.uuid().safeParse(onlyPlanId).success) return [];
  if (!(await ownsCampaign(userId, campaignId))) return [];

  const plans = await db
    .select()
    .from(agentPlans)
    .where(onlyPlanId ? and(eq(agentPlans.campaignId, campaignId), eq(agentPlans.id, onlyPlanId)) : eq(agentPlans.campaignId, campaignId))
    .orderBy(desc(agentPlans.createdAt), desc(agentPlans.id))
    .limit(limit);
  if (plans.length === 0) return [];

  const tasks = await db
    .select()
    .from(agentTasks)
    .where(inArray(agentTasks.planId, plans.map((p) => p.id)))
    .orderBy(asc(agentTasks.planId), asc(agentTasks.position));
  const links = tasks.length === 0 ? [] : await db.select().from(agentTaskDependencies).where(inArray(agentTaskDependencies.taskId, tasks.map((t) => t.id)));
  const positionOf = new Map(tasks.map((t) => [t.id, t.position]));

  return plans.map((p) => ({
    id: p.id,
    summary: p.summary,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    tasks: tasks
      .filter((t) => t.planId === p.id)
      .map((t) => ({
        id: t.id,
        position: t.position,
        agent: t.agent,
        title: t.title,
        instruction: t.instruction,
        status: t.status,
        dependsOn: links
          .filter((l) => l.taskId === t.id)
          .map((l) => positionOf.get(l.dependsOnTaskId)!)
          .sort((a, b) => a - b),
      })),
  }));
}

// Annule un plan actif : le plan et ses tâches PAS ENCORE TERMINÉES (en attente ou en cours). Une tâche déjà faite reste faite :
// on n'efface jamais un résultat. Annuler un plan déjà annulé est sans effet (même résultat) ; un plan terminé ne s'annule pas.
export async function cancelPlanAs(userId: string, campaignId: string, planId: string): Promise<CancelResult> {
  const notFound = { ok: false, error: "Ce plan est introuvable." } as const;
  const [current] = await readPlans(userId, campaignId, { onlyPlanId: planId });
  if (!current) return notFound; // campagne d'un autre, plan d'une autre campagne, identifiant piégé : même réponse
  if (current.status === "cancelled") return { ok: true, plan: current };
  if (current.status === "done") return { ok: false, error: "Ce plan est déjà terminé : il ne peut plus être annulé." };

  await db.transaction(async (tx) => {
    // « status = active » dans la condition : si le plan a été terminé ou annulé entre-temps (autre onglet, tâche de fond),
    // on n'écrase rien
    const cancelled = await tx
      .update(agentPlans)
      .set({ status: "cancelled" })
      .where(and(eq(agentPlans.id, planId), eq(agentPlans.campaignId, campaignId), eq(agentPlans.status, "active")))
      .returning({ id: agentPlans.id });
    if (cancelled.length > 0) {
      await tx.update(agentTasks).set({ status: "cancelled" }).where(and(eq(agentTasks.planId, planId), inArray(agentTasks.status, ["pending", "running"])));
    }
  });
  const [after] = await readPlans(userId, campaignId, { onlyPlanId: planId });
  return after ? { ok: true, plan: after } : notFound;
}

// Un plan dont plus aucune tâche n'est en attente ni en cours est fini : il passe à « terminé » (les tâches annulées ou en
// échec ne bloquent pas la fin, elles restent visibles). Appelée par l'exécuteur du chapitre 11 après chaque tâche.
// Sans effet sur un plan déjà terminé ou annulé (la condition « active » évite d'écraser une annulation faite entre-temps).
export async function settlePlan(planId: string): Promise<boolean> {
  const open = await db.select({ id: agentTasks.id }).from(agentTasks).where(and(eq(agentTasks.planId, planId), inArray(agentTasks.status, ["pending", "running"]))).limit(1);
  if (open.length > 0) return false;
  const settled = await db.update(agentPlans).set({ status: "done" }).where(and(eq(agentPlans.id, planId), eq(agentPlans.status, "active"))).returning({ id: agentPlans.id });
  return settled.length > 0;
}
