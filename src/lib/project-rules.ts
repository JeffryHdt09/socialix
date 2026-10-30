import { z } from "zod";

import { TEAMS } from "@/lib/agents";

// Règles d'un projet, écrites UNE fois et partagées par le formulaire (messages en direct)
// et par le serveur (contrôle final). Le navigateur peut mentir ; le serveur revérifie tout avec ce fichier.
// La base ajoute un dernier garde-fou : voir la contrainte projects_name_length dans src/db/schema.ts.

export const PROJECT_NAME_MAX = 60;

// Plafond par utilisateur : sans lui, un compte (ou un script) pourrait remplir la base et le stockage.
export const MAX_PROJECTS_PER_USER = 20;

// Icônes proposées à l'étape 1 du formulaire. La clé est ce qu'on stocke (« icon:coffee » dans la base) ;
// le dessin et le libellé français sont dans src/components/project/project-icon.tsx, qui doit
// couvrir toutes ces clés (TypeScript refuse de compiler s'il en manque une).
export const PROJECT_ICON_KEYS = [
  "coffee",
  "store",
  "flower",
  "camera",
  "utensils",
  "scissors",
  "dumbbell",
  "book",
  "bag",
  "palette",
  "music",
  "paw",
] as const;
export type ProjectIconKey = (typeof PROJECT_ICON_KEYS)[number];

// Décors du bureau. Seul l'atelier bois est dessiné ; « modern » existe dans la base mais l'application
// le refuse tant que le décor n'est pas créé (PLAN.md, chapitre 7).
export const OFFICES = ["wooden", "modern"] as const;
export const AVAILABLE_OFFICES = ["wooden"] as const;
export const OFFICE_LABELS: Record<(typeof OFFICES)[number], string> = {
  wooden: "Atelier bois",
  modern: "Bureau moderne",
};

// Le logo téléversé (3 Mo, PNG, JPG ou WebP) n'est pas décrit ici : il se contrôle sur les octets du
// fichier, dans src/lib/logo-check.ts.

export const projectSchema = z.object({
  // trim() d'abord : « Café » et «  Café  » donnent le même nom, et un nom fait d'espaces est vide.
  name: z
    .string({ error: "Donne un nom à ton projet." })
    .trim()
    .min(1, "Donne un nom à ton projet.")
    .max(PROJECT_NAME_MAX, `${PROJECT_NAME_MAX} caractères maximum.`),
  office: z.enum(AVAILABLE_OFFICES, { error: "Ce décor n’est pas encore disponible." }),
  // null = pas d'icône choisie (logo téléversé, ou aucun : on affichera l'initiale du nom).
  icon: z.enum(PROJECT_ICON_KEYS, { error: "Cette icône n’existe pas." }).nullable(),
  // Les domaines activés : au moins un, chacun connu, sans doublon. Ils décident des agents du projet (src/lib/agents.ts).
  teams: z
    .array(z.enum(TEAMS.map((t) => t.id) as [string, ...string[]], { error: "Ce domaine n’existe pas." }), { error: "Choisis au moins un domaine." })
    .min(1, "Choisis au moins un domaine.")
    .transform((ids) => [...new Set(ids)]),
});

export type ProjectInput = z.infer<typeof projectSchema>;

// Relit la valeur de projects.icon : « icon:<nom> », « upload:<clé> » ou vide.
// Une valeur inattendue (base modifiée à la main, icône retirée de la liste) retombe sur « none » :
// on affichera l'initiale du nom plutôt qu'une erreur.
export type StoredIcon = { kind: "icon"; key: ProjectIconKey } | { kind: "upload"; key: string } | { kind: "none" };

export function parseStoredIcon(value: string | null): StoredIcon {
  if (value?.startsWith("icon:")) {
    const key = value.slice("icon:".length);
    const known = PROJECT_ICON_KEYS.find((k) => k === key);
    if (known) return { kind: "icon", key: known };
  }
  if (value?.startsWith("upload:")) return { kind: "upload", key: value.slice("upload:".length) };
  return { kind: "none" };
}
