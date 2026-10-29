// La retouche d'une image (chapitre 13, éditeur d'image) : ce que la personne peut demander, et comment on le traduit en
// transformation ImageKit (adresse « tr:… »). Fichier sans dépendance serveur : l'éditeur s'en sert pour ses champs, le serveur
// revérifie tout avec les mêmes règles. La syntaxe vient de la documentation d'ImageKit (octobre 2026) ; les transformations IA y sont
// en bêta, et une seule transformation asynchrone est permise par chaîne : d'où un choix unique « retouche IA ».

export const CROPS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type Crop = (typeof CROPS)[number];
export const CROP_LABELS: Record<Crop, string> = { "1:1": "Carré 1:1", "4:5": "Portrait 4:5", "9:16": "Vertical 9:16", "16:9": "Paysage 16:9" };

export const AI_OPS = ["none", "removebg", "upscale", "retouch", "changebg"] as const;
export type AiOp = (typeof AI_OPS)[number];
export const AI_LABELS: Record<AiOp, string> = { none: "Aucune", removebg: "Détourer (retirer le fond)", upscale: "Agrandir (meilleure définition)", retouch: "Améliorer (retouche automatique)", changebg: "Changer le fond" };

export const TEXT_COLORS = { white: "FFFFFF", black: "1D1A16", yellow: "E6E05A" } as const;
export type TextColor = keyof typeof TEXT_COLORS;
export const TEXT_COLOR_LABELS: Record<TextColor, string> = { white: "Blanc", black: "Noir", yellow: "Jaune" };
// Hauteur du centre du texte, en part de la hauteur de l'image
export const TEXT_POSITIONS = { top: 0.12, middle: 0.5, bottom: 0.88 } as const;
export type TextPosition = keyof typeof TEXT_POSITIONS;
export const TEXT_POSITION_LABELS: Record<TextPosition, string> = { top: "En haut", middle: "Au milieu", bottom: "En bas" };

export const TEXT_MAX_CHARS = 80;
export const TEXT_MIN_SIZE = 20;
export const TEXT_MAX_SIZE = 160;
export const BACKGROUND_PROMPT_MAX = 100;

export type RetouchSpec = {
  crop: Crop | null;
  ai: AiOp;
  background: string; // la consigne du nouveau fond, seulement pour ai = « changebg »
  grayscale: boolean;
  text: { enabled: boolean; content: string; size: number; color: TextColor; position: TextPosition };
};

export const EMPTY_SPEC: RetouchSpec = { crop: null, ai: "none", background: "", grayscale: false, text: { enabled: false, content: "", size: 64, color: "white", position: "bottom" } };

export type SpecCheck = { ok: true; spec: RetouchSpec } | { ok: false; error: string };

// Contrôle une demande venue du navigateur et la renvoie nettoyée (champs inconnus ignorés, textes recoupés).
export function validateSpec(raw: unknown): SpecCheck {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Demande de retouche invalide." };
  const r = raw as Record<string, unknown>;
  const t = (typeof r.text === "object" && r.text !== null ? r.text : {}) as Record<string, unknown>;
  const crop = r.crop === null || r.crop === undefined ? null : (CROPS as readonly unknown[]).includes(r.crop) ? (r.crop as Crop) : undefined;
  if (crop === undefined) return { ok: false, error: "Format de recadrage inconnu." };
  if (!(AI_OPS as readonly unknown[]).includes(r.ai)) return { ok: false, error: "Retouche inconnue." };
  const ai = r.ai as AiOp;
  const background = typeof r.background === "string" ? r.background.trim() : "";
  if (ai === "changebg" && (background.length < 3 || background.length > BACKGROUND_PROMPT_MAX)) return { ok: false, error: `Décris le nouveau fond en 3 à ${BACKGROUND_PROMPT_MAX} caractères.` };
  const enabled = t.enabled === true;
  const content = typeof t.content === "string" ? t.content.trim() : "";
  if (enabled && (content.length === 0 || content.length > TEXT_MAX_CHARS || /[\u0000-\u001f\u007f]/.test(content))) return { ok: false, error: `Le texte doit faire de 1 à ${TEXT_MAX_CHARS} caractères, sur une ligne.` };
  const size = typeof t.size === "number" && Number.isInteger(t.size) ? t.size : NaN;
  if (enabled && !(size >= TEXT_MIN_SIZE && size <= TEXT_MAX_SIZE)) return { ok: false, error: `La taille du texte va de ${TEXT_MIN_SIZE} à ${TEXT_MAX_SIZE}.` };
  const color = (typeof t.color === "string" && Object.hasOwn(TEXT_COLORS, t.color) ? t.color : null) as TextColor | null;
  const position = (typeof t.position === "string" && Object.hasOwn(TEXT_POSITIONS, t.position) ? t.position : null) as TextPosition | null;
  if (enabled && (!color || !position)) return { ok: false, error: "Couleur ou position du texte inconnue." };
  const spec: RetouchSpec = {
    crop,
    ai,
    background: ai === "changebg" ? background : "",
    grayscale: r.grayscale === true,
    text: { enabled, content: enabled ? content : "", size: enabled ? size : EMPTY_SPEC.text.size, color: color ?? "white", position: position ?? "bottom" },
  };
  if (!spec.crop && spec.ai === "none" && !spec.grayscale && !spec.text.enabled) return { ok: false, error: "Choisis au moins une retouche." };
  return { ok: true, spec };
}

// Texte de l'image : « i- » tel quel s'il ne contient que lettres sans accent, chiffres, @ - _ ; sinon « ie- » (base64 puis encodage
// d'adresse), comme l'exige ImageKit.
const toBase64 = (s: string) => (typeof Buffer !== "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s))));
const layerText = (s: string) => (/^[A-Za-z0-9@_-]+$/.test(s) ? `i-${s}` : `ie-${encodeURIComponent(toBase64(s))}`);

const CROP_PARAMS: Record<Crop, string> = { "1:1": "ar-1-1,w-1080", "4:5": "ar-4-5,w-1080", "9:16": "ar-9-16,w-1080", "16:9": "ar-16-9,w-1920" };

// La chaîne de transformations ImageKit, dans l'ordre : recadrer (avant la retouche IA, qui coûte moins sur une petite image), retouche
// IA (une seule), noir et blanc, texte par-dessus. Les groupes sont séparés par « : », les paramètres d'un groupe par « , ».
// À partir d'une demande déjà validée (validateSpec).
export function buildTransformation(spec: RetouchSpec): string {
  const groups: string[] = [];
  if (spec.crop) groups.push(`${CROP_PARAMS[spec.crop]},fo-auto`);
  if (spec.ai === "removebg") groups.push("e-bgremove");
  if (spec.ai === "upscale") groups.push("e-upscale");
  if (spec.ai === "retouch") groups.push("e-retouch");
  if (spec.ai === "changebg") groups.push(`e-changebg-prompte-${encodeURIComponent(toBase64(spec.background))}`);
  if (spec.grayscale) groups.push("e-grayscale");
  if (spec.text.enabled) {
    const y = TEXT_POSITIONS[spec.text.position];
    groups.push(`l-text,${layerText(spec.text.content)},fs-${spec.text.size},co-${TEXT_COLORS[spec.text.color]},w-bw_mul_0.86,lxc-bw_mul_0.5,lyc-bh_mul_${y},l-end`);
  }
  return groups.join(":");
}
