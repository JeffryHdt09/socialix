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
  result: string | null; // ce que l'agent a produit (chapitre 11), null tant que la tâche n'est pas faite
  images: string[]; // adresses des images produites par la tâche (chapitre 12), vide le plus souvent
  lastError: string | null; // mot court : « quota », « indisponible », « limite », « dependance »… (jamais un texte d'erreur)
  nextRunAt: string | null; // prochaine tentative ou prochaine répétition (ISO)
};

export type PlanView = {
  id: string;
  summary: string;
  status: PlanStatus;
  createdAt: string;
  tasks: TaskView[];
  report: string | null; // le rapport du Maître (chapitre 13b) : écrit en même temps que le plan passe à « terminé »
  reviewRound: number; // combien de fois le Maître a renvoyé des tâches à leurs agents pour correction
};

// « Toutes les tâches sont closes, le Maître relit le travail » : le plan est encore actif, mais rien ne tourne plus.
// Déduit des tâches : pas de colonne de plus à lire, et vrai exactement pendant la fenêtre qui sépare la dernière tâche du rapport.
export function isAwaitingReview(plan: Pick<PlanView, "status" | "tasks">): boolean {
  return plan.status === "active" && plan.tasks.length > 0 && plan.tasks.every((t) => t.status !== "pending" && t.status !== "running");
}

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

// La phrase qui explique l'état d'une tâche quand il n'est pas évident : pourquoi elle attend, pourquoi elle a échoué.
// `clock` met une date en « 14:35 » (passée par l'appelant : ce fichier reste utilisable partout).
export function taskNote(task: Pick<TaskView, "status" | "lastError" | "nextRunAt">, clock: (iso: string) => string): string | null {
  const at = task.nextRunAt ? clock(task.nextRunAt) : null;
  if (task.status === "pending" && task.lastError === "quota") return `Pause : la limite gratuite de l’IA est atteinte. Nouvel essai vers ${at ?? "plus tard"}.`;
  if (task.status === "pending" && task.lastError === "limite") return `Limite de tâches du jour atteinte. Reprise vers ${at ?? "plus tard"}.`;
  if (task.status === "pending" && task.lastError) return `L’agent n’a pas pu répondre. Nouvel essai vers ${at ?? "plus tard"}.`;
  if (task.status === "pending" && at) return `Prévue vers ${at}.`;
  if (task.status === "failed") return task.lastError === "agent absent du projet" ? "Échec : cet agent ne fait pas partie du projet." : "Échec : l’agent n’a pas pu répondre après plusieurs essais.";
  if (task.status === "cancelled" && task.lastError === "dependance") return "Annulée : une tâche dont elle dépend a échoué.";
  return null;
}

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
