// Les sept sections d'un projet : adresse (/dashboard/<id>/<slug>) et libellé du menu.
// Source unique, partagée par le menu latéral et par l'action « changer de projet » (qui n'accepte
// que ces adresses, pour ne jamais rediriger vers une adresse inventée).
export const PROJECT_SECTIONS = [
  { slug: "overview", label: "Vue d’ensemble" },
  { slug: "agents", label: "Agents IA" },
  { slug: "posts", label: "Posts" },
  { slug: "calendar", label: "Calendrier" },
  { slug: "analytics", label: "Analytique" },
  { slug: "accounts", label: "Comptes" },
  { slug: "settings", label: "Réglages" },
] as const;

export type SectionSlug = (typeof PROJECT_SECTIONS)[number]["slug"];
