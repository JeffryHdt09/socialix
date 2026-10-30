import "server-only";

import { agentCommunications, agentPlans, agentTaskDependencies, agentTasks } from "@/db/schema";
import type { db } from "@/db";
import type { PlanDraft, ValidPlan } from "@/lib/plan";

// Enregistre un plan DÉJÀ VALIDÉ (validatePlan) : le plan, ses tâches, leurs dépendances et une consigne du Maître à chaque agent.
// À appeler DANS une transaction (tx) : si une étape échoue, rien n'est enregistré (pas de plan sans tâches, pas de tâche orpheline).
// La propriété du projet est vérifiée par l'appelant (sendMessageAs) : cette fonction ne vérifie rien d'elle-même.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function savePlan(tx: Tx, projectId: string, request: string, plan: ValidPlan, rawPlan: PlanDraft): Promise<string> {
  const [row] = await tx.insert(agentPlans).values({ projectId, request, summary: plan.summary, plan: rawPlan }).returning({ id: agentPlans.id });

  const tasks = await tx
    .insert(agentTasks)
    .values(plan.tasks.map((t) => ({ planId: row.id, position: t.position, agent: t.agent, title: t.title, instruction: t.instruction })))
    .returning({ id: agentTasks.id, position: agentTasks.position });
  const idAt = new Map(tasks.map((t) => [t.position, t.id]));

  const links = plan.tasks.flatMap((t) => t.dependsOnPositions.map((p) => ({ taskId: idAt.get(t.position)!, dependsOnTaskId: idAt.get(p)! })));
  if (links.length > 0) await tx.insert(agentTaskDependencies).values(links);

  // La consigne que le Maître donne à chaque agent est gardée comme échange (le journal des chapitres suivants s'en servira)
  await tx.insert(agentCommunications).values(plan.tasks.map((t) => ({ taskId: idAt.get(t.position)!, fromAgent: "maitre", toAgent: t.agent, message: t.instruction })));
  return row.id;
}
