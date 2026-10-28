// L'équipe d'agents, vue comme une DONNÉE (PLAN.md, chapitres 9 et 10) : ajouter un agent, c'est ajouter une ligne ici
// (et un poste dans public/office/atelier.json), sans réécrire le bureau.
// Le Vidéaste (phase 3) n'y figure pas encore : il n'a pas de poste dans l'atelier.
export const AGENTS = [
  { id: "maitre", name: "Maître", role: "Planifie le travail et le répartit entre les agents" },
  { id: "recherche", name: "Recherche", role: "Cherche des idées et suit les tendances" },
  { id: "createur", name: "Créateur", role: "Rédige les posts et prépare les images" },
  { id: "planificateur", name: "Planificateur", role: "Choisit les jours et les heures de publication" },
  { id: "analytique", name: "Analytique", role: "Lit les résultats et en tire des conseils" },
] as const;

export type AgentId = (typeof AGENTS)[number]["id"];

// Les quatre états d'un agent (DESIGN.md, « États »). Ils ne reposent jamais sur la couleur seule : chacun a son texte.
export type AgentStatus = "idle" | "working" | "done" | "blocked";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Au repos",
  working: "En cours",
  done: "Terminé",
  blocked: "Bloqué, attend une réponse",
};
