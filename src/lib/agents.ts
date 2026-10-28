// Les agents, vus comme une DONNÉE (PLAN.md, chapitres 9, 10 et 10b) : ajouter un agent, c'est ajouter une ligne ici
// (et, s'il a un poste dans le bureau, un siège dans public/office/atelier.json), sans réécrire le bureau.
//
// Une ÉQUIPE = un domaine de travail. Le moteur d'agents ne connaît aucun domaine : pour en ajouter un, on ajoute une équipe
// ici, son contexte dans agent-instructions.ts et ses agents dans la liste. Un projet choisit les équipes qu'il active
// (colonne projects.teams) ; il dispose alors des agents « communs » (présents partout) et de ceux de ses équipes.
export type TeamId = "commun" | "marketing" | "audio";

// Les domaines qu'une personne peut activer pour un projet (« commun » n'en fait pas partie : il est toujours là).
export const TEAMS = [
  { id: "marketing", name: "Marketing", description: "Réseaux sociaux d’un commerce : idées, textes des posts, calendrier, résultats." },
  { id: "audio", name: "Audio-description", description: "Décrire à l’oral ce qu’on voit dans une vidéo, pour les personnes aveugles ou malvoyantes." },
] as const satisfies readonly { id: Exclude<TeamId, "commun">; name: string; description: string }[];

export type ActiveTeamId = (typeof TEAMS)[number]["id"];
export const DEFAULT_TEAMS: ActiveTeamId[] = ["marketing"];

export const AGENTS = [
  { id: "maitre", team: "commun", name: "Maître", role: "Planifie le travail et le répartit entre les agents" },
  { id: "recherche", team: "commun", name: "Recherche", role: "Cherche des idées et des informations, et suit les tendances" },
  { id: "createur", team: "marketing", name: "Créateur", role: "Rédige les posts et prépare les images" },
  { id: "planificateur", team: "marketing", name: "Planificateur", role: "Choisit les jours et les heures de publication" },
  { id: "analytique", team: "marketing", name: "Analytique", role: "Lit les résultats et en tire des conseils" },
  { id: "descripteur", team: "audio", name: "Descripteur", role: "Rédige l’audio-description d’une vidéo, scène par scène" },
  { id: "controleur", team: "audio", name: "Contrôleur", role: "Relit les descriptions : clarté, durée et exactitude" },
] as const satisfies readonly { id: string; team: TeamId; name: string; role: string }[];

export type AgentId = (typeof AGENTS)[number]["id"];

// Les quatre états d'un agent (DESIGN.md, « États »). Ils ne reposent jamais sur la couleur seule : chacun a son texte.
export type AgentStatus = "idle" | "working" | "done" | "blocked";

export const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "Au repos",
  working: "En cours",
  done: "Terminé",
  blocked: "Bloqué, attend une réponse",
};

export type Agent = (typeof AGENTS)[number];

// Ne garde que des équipes qui existent (la base est fiable, mais une ancienne valeur ne doit pas faire planter l'écran).
export function activeTeams(value: readonly string[] | null | undefined): ActiveTeamId[] {
  const known = TEAMS.map((t) => t.id as string);
  const kept = (value ?? []).filter((t, i, all) => known.includes(t) && all.indexOf(t) === i) as ActiveTeamId[];
  return kept.length > 0 ? kept : DEFAULT_TEAMS;
}

// Les agents dont dispose un projet : les communs, puis ceux de ses équipes (dans l'ordre du catalogue).
export function agentsFor(teams: readonly string[] | null | undefined): Agent[] {
  const active = activeTeams(teams) as string[];
  return AGENTS.filter((a) => a.team === "commun" || active.includes(a.team));
}

// Les agents de travail d'un projet : tous sauf le Maître, qui planifie sans exécuter.
export const workersFor = (teams: readonly string[] | null | undefined): Agent[] => agentsFor(teams).filter((a) => a.id !== "maitre");

// Retrouve un agent à partir d'une valeur venue de l'adresse (?agent=…, ?chat=…) : n'importe quel texte peut s'y
// trouver, donc on ne renvoie un agent que si l'identifiant existe vraiment ET s'il fait partie du projet (`teams`).
export function findAgent(value: unknown, teams?: readonly string[] | null): Agent | undefined {
  if (typeof value !== "string") return undefined;
  return (teams === undefined ? [...AGENTS] : agentsFor(teams)).find((a) => a.id === value);
}
