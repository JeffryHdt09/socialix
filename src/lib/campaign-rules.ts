import { z } from "zod";

// Règles d'une campagne, écrites UNE fois et partagées par le formulaire (messages en direct)
// et par le serveur (contrôle final). Le navigateur peut mentir ; le serveur revérifie tout avec ce fichier.
// La base ajoute un dernier garde-fou : voir la contrainte campaigns_name_length dans src/db/schema.ts.

export const CAMPAIGN_NAME_MAX = 60;

// Icônes proposées à l'étape 1 du formulaire. La clé est ce qu'on stocke (« icon:coffee » dans la base) ;
// le dessin et le libellé français sont dans src/components/campaign/campaign-icon.tsx, qui doit
// couvrir toutes ces clés (TypeScript refuse de compiler s'il en manque une).
export const CAMPAIGN_ICON_KEYS = [
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
export type CampaignIconKey = (typeof CAMPAIGN_ICON_KEYS)[number];

// Décors du bureau. Seul l'atelier bois est dessiné ; « modern » existe dans la base mais l'application
// le refuse tant que le décor n'est pas créé (PLAN.md, chapitre 7).
export const OFFICES = ["wooden", "modern"] as const;
export const AVAILABLE_OFFICES = ["wooden"] as const;

// Le logo téléversé (3 Mo, PNG, JPG ou WebP) n'est pas décrit ici : il se contrôle sur les octets du
// fichier, dans src/lib/logo-check.ts.

export const campaignSchema = z.object({
  // trim() d'abord : « Café » et «  Café  » donnent le même nom, et un nom fait d'espaces est vide.
  name: z
    .string({ error: "Donne un nom à ta campagne." })
    .trim()
    .min(1, "Donne un nom à ta campagne.")
    .max(CAMPAIGN_NAME_MAX, `${CAMPAIGN_NAME_MAX} caractères maximum.`),
  office: z.enum(AVAILABLE_OFFICES, { error: "Ce décor n’est pas encore disponible." }),
  // null = pas d'icône choisie (logo téléversé, ou aucun : on affichera l'initiale du nom).
  icon: z.enum(CAMPAIGN_ICON_KEYS, { error: "Cette icône n’existe pas." }).nullable(),
});

export type CampaignInput = z.infer<typeof campaignSchema>;
