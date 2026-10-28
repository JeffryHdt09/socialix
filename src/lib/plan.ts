import { z } from "zod";

import { AGENTS } from "@/lib/agents";

// Le plan que produit le Maître (chapitre 10) et sa VALIDATION. Fichier sans dépendance serveur : utilisable partout et testable seul.
// Règle : la sortie d'un modèle n'est jamais crue. Avant tout enregistrement, validatePlan la vérifie ; si elle est
// invalide, on renvoie la liste des problèmes (en français), que le Maître pourra recevoir pour se corriger.

export const MAX_TASKS = 12;

// Limites alignées sur celles de la base (agent_tasks) : un plan accepté ici ne peut pas être refusé par un contrôle SQL.
const MAX_TITLE = 120;
const MAX_INSTRUCTION = 4000;
const MAX_SUMMARY = 2000;

// Les agents à qui le Maître peut confier du travail : tous sauf lui-même.
export const WORKER_AGENTS: readonly string[] = AGENTS.filter((a) => a.id !== "maitre").map((a) => a.id);

// La forme demandée au modèle (sortie structurée). Volontairement simple : plus un schéma est compliqué, plus un modèle se trompe.
// `key` est un nom local au plan (« t1 », « idees »), que `dependsOn` utilise pour dire « après telle tâche ».
export const planDraftSchema = z.object({
  summary: z.string().describe("Résumé du plan en une ou deux phrases, adressé à la personne"),
  tasks: z
    .array(
      z.object({
        key: z.string().describe("Nom court et unique de la tâche dans ce plan, par exemple t1, t2"),
        agent: z.string().describe("Identifiant de l'agent à qui confier la tâche"),
        title: z.string().describe("Titre court de la tâche"),
        instruction: z.string().describe("Consigne complète pour l'agent, avec tout le contexte utile"),
        dependsOn: z.array(z.string()).describe("Noms (key) des tâches à terminer avant celle-ci ; liste vide s'il n'y en a pas"),
      }),
    )
    .describe("Les tâches du plan"),
});

export type PlanDraft = z.infer<typeof planDraftSchema>;

// Un plan validé : tâches numérotées dans un ordre où CHAQUE tâche vient après celles dont elle dépend.
export type ValidTask = { position: number; key: string; agent: string; title: string; instruction: string; dependsOnPositions: number[] };
export type ValidPlan = { summary: string; tasks: ValidTask[] };
export type PlanValidation = { ok: true; plan: ValidPlan } | { ok: false; errors: string[] };

export function validatePlan(input: unknown, workers: readonly string[] = WORKER_AGENTS): PlanValidation {
  const parsed = planDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `Forme du plan invalide (${i.path.join(".") || "racine"}) : ${i.message}`) };
  }

  const errors: string[] = [];
  const summary = parsed.data.summary.trim();
  if (summary.length === 0) errors.push("Le résumé du plan est vide.");
  if (summary.length > MAX_SUMMARY) errors.push(`Le résumé est trop long (${MAX_SUMMARY} caractères au maximum).`);

  const drafts = parsed.data.tasks.map((t) => ({ ...t, key: t.key.trim(), title: t.title.trim(), instruction: t.instruction.trim(), agent: t.agent.trim(), dependsOn: t.dependsOn.map((d) => d.trim()) }));
  if (drafts.length === 0) errors.push("Le plan ne contient aucune tâche.");
  if (drafts.length > MAX_TASKS) errors.push(`Le plan contient ${drafts.length} tâches : ${MAX_TASKS} au maximum.`);

  // Les noms locaux doivent être non vides et uniques, sinon « dependsOn » ne veut rien dire.
  const seen = new Set<string>();
  for (const t of drafts) {
    if (t.key.length === 0) errors.push("Une tâche n'a pas de nom (key).");
    else if (seen.has(t.key)) errors.push(`Deux tâches portent le même nom « ${t.key} ».`);
    seen.add(t.key);
  }

  for (const t of drafts) {
    const who = `Tâche « ${t.key || "?"} »`;
    if (!workers.includes(t.agent)) errors.push(`${who} : l'agent « ${t.agent} » n'existe pas ou ne peut pas recevoir de tâche (agents possibles : ${workers.join(", ")}).`);
    if (t.title.length === 0) errors.push(`${who} : le titre est vide.`);
    if (t.title.length > MAX_TITLE) errors.push(`${who} : le titre dépasse ${MAX_TITLE} caractères.`);
    if (t.instruction.length === 0) errors.push(`${who} : la consigne est vide.`);
    if (t.instruction.length > MAX_INSTRUCTION) errors.push(`${who} : la consigne dépasse ${MAX_INSTRUCTION} caractères.`);
    for (const d of new Set(t.dependsOn)) {
      if (d === t.key) errors.push(`${who} : ne peut pas dépendre d'elle-même.`);
      else if (!seen.has(d)) errors.push(`${who} : dépend de « ${d} », qui n'existe pas dans le plan.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  // Tri topologique STABLE (algorithme de Kahn) : à chaque tour, on prend la première tâche, dans l'ordre d'origine, dont
  // toutes les dépendances sont déjà placées. Deux effets : chaque tâche vient après ses dépendances (la numérotation « 01, 02… »
  // est un ordre d'exécution valide), et ce qui reste à la fin sans pouvoir être placé est pris dans un CYCLE.
  const deps = new Map(drafts.map((t) => [t.key, new Set(t.dependsOn)]));
  const ordered: typeof drafts = [];
  const placed = new Set<string>();
  while (ordered.length < drafts.length) {
    const next = drafts.find((t) => !placed.has(t.key) && [...deps.get(t.key)!].every((d) => placed.has(d)));
    if (!next) {
      const stuck = drafts.filter((t) => !placed.has(t.key)).map((t) => t.key);
      return { ok: false, errors: [`Dépendances circulaires : les tâches ${stuck.map((k) => `« ${k} »`).join(", ")} s'attendent les unes les autres, ou attendent une tâche prise dans une boucle.`] };
    }
    ordered.push(next);
    placed.add(next.key);
  }

  const positionOf = new Map(ordered.map((t, i) => [t.key, i + 1]));
  return {
    ok: true,
    plan: {
      summary,
      tasks: ordered.map((t, i) => ({
        position: i + 1,
        key: t.key,
        agent: t.agent,
        title: t.title,
        instruction: t.instruction,
        dependsOnPositions: [...new Set(t.dependsOn)].map((d) => positionOf.get(d)!).sort((a, b) => a - b),
      })),
    },
  };
}
