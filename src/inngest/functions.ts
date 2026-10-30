import "server-only";

import { z } from "zod";

import { EVENTS, inngest, sendPlansReview, sendTasksReady } from "@/inngest/client";
import { syncDeliveries } from "@/lib/delivery-sync";
import { executeReview, findPlansToReview } from "@/lib/review-service";
import { findReadyTasks, executeTask, recoverStaleTasks } from "@/lib/task-runner";

// Les fonctions de fond (chapitre 11, plus la revue du Maître au chapitre 13b). Chacune ne fait que décider QUOI lancer ; le travail et toutes les règles
// (jamais deux fois, annulation, reprises) sont dans src/lib/task-runner.ts.

const idSchema = z.uuid();

// 1. Un plan vient d'être enregistré : on lance ses tâches prêtes (celles qui n'attendent personne).
export const onPlanCreated = inngest.createFunction(
  { id: "on-plan-created", triggers: [{ event: EVENTS.planCreated }], retries: 2 },
  async ({ event, step }) => {
    const planId = idSchema.parse(event.data.planId);
    const ready = await step.run("find-ready-tasks", () => findReadyTasks({ planId }));
    await step.run("send-ready-tasks", () => sendTasksReady(ready));
    return { launched: ready.length };
  },
);

// 2. Une tâche peut partir : on l'exécute, puis on lance celles qu'elle vient de débloquer.
// concurrency : au plus 2 tâches à la fois sur toute l'application (le quota gratuit des modèles est partagé).
export const executeAgentTask = inngest.createFunction(
  { id: "execute-agent-task", triggers: [{ event: EVENTS.taskReady }], concurrency: { limit: 2 }, retries: 1 },
  async ({ event, step }) => {
    const taskId = idSchema.parse(event.data.taskId);
    // Une seule étape pour l'exécution : si elle réussit, Inngest ne la rejoue pas ; si le serveur tombe au milieu, la tâche
    // reste « en cours » et le balayage la reprendra (recoverStaleTasks) plutôt que de la relancer à l'aveugle.
    const result = await step.run("execute", () => executeTask(taskId));
    await step.run("unblock-next", () => sendTasksReady(result.readyTaskIds));
    // Dernière tâche du plan : le Maître doit maintenant relire le travail avant que le plan soit terminé.
    await step.run("start-review", () => sendPlansReview(result.reviewPlanId ? [result.reviewPlanId] : []));
    return { outcome: result.outcome };
  },
);

// 3. Un plan n'a plus rien d'ouvert : le Maître relit les résultats. Il conclut (rapport, plan « terminé ») ou renvoie des tâches
// à leurs agents, que l'on relance aussitôt. concurrency : une seule revue à la fois (le quota des modèles est partagé).
export const reviewPlan = inngest.createFunction(
  { id: "review-plan", triggers: [{ event: EVENTS.planReview }], concurrency: { limit: 1 }, retries: 1 },
  async ({ event, step }) => {
    const planId = idSchema.parse(event.data.planId);
    const result = await step.run("review", () => executeReview(planId));
    await step.run("restart-redone-tasks", () => sendTasksReady(result.readyTaskIds));
    return { outcome: result.outcome };
  },
);

// 4. Balayage toutes les 15 minutes : le filet de sécurité. Il rattrape ce qu'aucun événement n'a lancé (événement perdu,
// tâche remise à plus tard après un quota, tâche répétée dont l'heure est venue) et reprend les tâches abandonnées.
export const sweepTasks = inngest.createFunction(
  { id: "sweep-tasks", triggers: [{ cron: "*/15 * * * *" }], retries: 0 },
  async ({ step }) => {
    const recovered = await step.run("recover-stale", () => recoverStaleTasks());
    const ready = await step.run("find-ready", () => findReadyTasks({ limit: 20 }));
    await step.run("send-ready", () => sendTasksReady(ready));
    // Les plans dont la revue s'est perdue ou a été remise à plus tard (modèle en quota) repartent ici.
    const toReview = await step.run("find-plans-to-review", () => findPlansToReview());
    await step.run("send-reviews", () => sendPlansReview(toReview));
    return { recovered, launched: ready.length, reviews: toReview.length };
  },
);

// 5. Synchronisation de la publication toutes les 10 minutes (chapitre 14.4) : lit chez le service de publication ce qu'il a fait des
// posts dont l'heure est venue (publié, refusé…) et rattrape ce qu'une panne a laissé de travers. Elle ne publie jamais rien. Une seule
// à la fois : deux synchronisations simultanées n'apportent rien.
export const syncPublications = inngest.createFunction(
  { id: "sync-publications", triggers: [{ cron: "*/10 * * * *" }], concurrency: { limit: 1 }, retries: 0 },
  async ({ step }) => step.run("sync", () => syncDeliveries()),
);

export const functions = [onPlanCreated, executeAgentTask, reviewPlan, sweepTasks, syncPublications];
