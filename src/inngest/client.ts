import "server-only";

import { Inngest } from "inngest";

// Le client Inngest : l'identifiant de l'application et les noms des événements. Inngest est le « facteur » : il reçoit nos
// événements, les met en file, rappelle notre route /api/inngest pour exécuter les fonctions, et recommence en cas d'échec.
// Il ne décide de RIEN d'important : « cette tâche peut-elle partir ? » se décide en base (src/lib/task-runner.ts).
// isDev : tant qu'on n'est pas en production, on parle au serveur de dev local (npx inngest-cli dev, port 8288), sans clé.
// En production, le mode « cloud » exige INNGEST_EVENT_KEY et INNGEST_SIGNING_KEY (chapitre 18) et le SDK refuse les appels non signés.
export const inngest = new Inngest({ id: "socialix", isDev: process.env.NODE_ENV !== "production" });

export const EVENTS = {
  planCreated: "socialix/plan.created",
  taskReady: "socialix/task.ready",
  planReview: "socialix/plan.review", // toutes les tâches d'un plan sont closes : le Maître doit le relire (chapitre 13b)
} as const;

// Annonce un plan tout juste enregistré : Inngest cherchera ses tâches prêtes et les lancera.
export async function sendPlanCreated(planId: string): Promise<void> {
  await inngest.send({ name: EVENTS.planCreated, data: { planId } });
}

// Annonce que des plans attendent la relecture du Maître. Plusieurs envois pour le même plan sont sans danger : la base ne laisse
// passer qu'une revue à la fois (src/lib/review-service.ts).
export async function sendPlansReview(planIds: string[]): Promise<void> {
  if (planIds.length === 0) return;
  await inngest.send(planIds.map((planId) => ({ name: EVENTS.planReview, data: { planId } })));
}

export async function sendTasksReady(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;
  await inngest.send(taskIds.map((taskId) => ({ name: EVENTS.taskReady, data: { taskId } })));
}
