// Ce que l'interface reçoit d'un plan : types et textes partagés entre le serveur et le navigateur (aucun code secret ici).
// Les dates sont en texte (ISO) : un objet Date ne traverse pas la frontière serveur / navigateur.

export type TaskStatus = "pending" | "running" | "done" | "failed" | "cancelled";
export type PlanStatus = "active" | "done" | "cancelled";

export type TaskView = {
  id: string;
  position: number; // numéro d'affichage : « 01 », « 02 »…
  agent: string;
  title: string;
  instruction: string;
  status: TaskStatus;
  dependsOn: number[]; // numéros des tâches à terminer avant celle-ci (« après 02 »)
};

export type PlanView = {
  id: string;
  summary: string;
  status: PlanStatus;
  createdAt: string;
  tasks: TaskView[];
};

// Un état n'est jamais dit par la couleur seule (DESIGN.md) : chacun a son texte.
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "En attente",
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
  cancelled: "Annulée",
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  active: "Plan actif",
  done: "Plan terminé",
  cancelled: "Plan annulé",
};

export type CancelResult = { ok: true; plan: PlanView } | { ok: false; error: string };

// La ligne de bilan d'un plan, en toutes lettres : « 1 terminée sur 3 · 1 en cours · 1 en attente ».
// Fonction pure (aucun accès à la base) : le serveur et le navigateur l'utilisent, et elle se teste seule.
export function summarizeTasks(tasks: { status: TaskStatus }[]): string {
  const count = (s: TaskStatus) => tasks.filter((t) => t.status === s).length;
  if (tasks.length === 0) return "Aucune tâche";
  const done = count("done");
  const parts = [`${done} terminée${done > 1 ? "s" : ""} sur ${tasks.length}`];
  const running = count("running");
  const pending = count("pending");
  const failed = count("failed");
  const cancelled = count("cancelled");
  if (running) parts.push(`${running} en cours`);
  if (pending) parts.push(`${pending} en attente`);
  if (failed) parts.push(`${failed} en échec`);
  if (cancelled) parts.push(`${cancelled} annulée${cancelled > 1 ? "s" : ""}`);
  return parts.join(" · ");
}
