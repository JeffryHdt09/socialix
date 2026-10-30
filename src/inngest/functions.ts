import "server-only";

import { z } from "zod";

import { EVENTS, inngest, sendTasksReady } from "@/inngest/client";
import { findReadyTasks, executeTask, recoverStaleTasks } from "@/lib/task-runner";

// Les trois fonctions de fond (chapitre 11). Chacune ne fait que décider QUOI lancer ; le travail et toutes les règles
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
    return { outcome: result.outcome };
  },
);

// 3. Balayage toutes les 15 minutes : le filet de sécurité. Il rattrape ce qu'aucun événement n'a lancé (événement perdu,
// tâche remise à plus tard après un quota, tâche répétée dont l'heure est venue) et reprend les tâches abandonnées.
export const sweepTasks = inngest.createFunction(
  { id: "sweep-tasks", triggers: [{ cron: "*/15 * * * *" }], retries: 0 },
  async ({ step }) => {
    const recovered = await step.run("recover-stale", () => recoverStaleTasks());
    const ready = await step.run("find-ready", () => findReadyTasks({ limit: 20 }));
    await step.run("send-ready", () => sendTasksReady(ready));
    return { recovered, launched: ready.length };
  },
);

export const functions = [onPlanCreated, executeAgentTask, sweepTasks];
