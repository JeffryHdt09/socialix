import { parisToUtc } from "@/lib/dates";

// Règles d'un post, écrites UNE fois et partagées par l'éditeur (aides en direct) et par le serveur (contrôle final). Le navigateur
// peut mentir : le serveur revérifie tout avec ce fichier. Aucune dépendance serveur ici (utilisable côté navigateur).

export const PLATFORMS = ["instagram", "facebook", "linkedin", "x", "tiktok", "threads", "pinterest", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

// Longueur maximale d'une légende, par réseau (en caractères). X est le plus strict, Facebook le plus large.
export const CAPTION_LIMITS: Record<Platform, number> = { instagram: 2200, facebook: 63206, linkedin: 3000, x: 280, tiktok: 2200, threads: 500, pinterest: 500, youtube: 5000 };
// Réseaux qui exigent une image (Instagram, Pinterest) ou une vidéo (TikTok, YouTube : phase 3, pas encore possible).
export const IMAGE_REQUIRED: readonly Platform[] = ["instagram", "pinterest"];
export const VIDEO_ONLY: readonly Platform[] = ["tiktok", "youtube"];

export const TITLE_MAX = 120; // même plafond que la base (check posts_title_length)
export const CAPTION_MAX = 10_000; // plafond de stockage d'une légende, tous réseaux confondus
export const HASHTAGS_MAX = 30;
export const HASHTAG_MAX_CHARS = 50;
export const MIN_LEAD_MINUTES = 2; // une date doit être au moins 2 minutes dans le futur pour programmer

// « #Café » et « café » deviennent « café » ; on garde lettres, chiffres et tiret bas, 50 signes au plus, sans doublon.
export function cleanHashtags(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const h of raw) {
    const tag = h.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, HASHTAG_MAX_CHARS).toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= HASHTAGS_MAX) break;
  }
  return out;
}

export type PostInput = { title: string; caption: string; hashtags: readonly string[]; platforms: readonly string[]; imageUrl: string | null; day: string; time: string };
export type PostField = "title" | "caption" | "hashtags" | "platforms" | "image" | "date";
export type PostErrors = Partial<Record<PostField, string>>;
export type ValidPost = { title: string; caption: string; hashtags: string[]; platforms: Platform[]; imageUrl: string | null; scheduledAt: Date | null };
export type PostCheck = { ok: true; data: ValidPost } | { ok: false; errors: PostErrors };

export const isPlatform = (p: string): p is Platform => (PLATFORMS as readonly string[]).includes(p);
const NETWORK_NAME: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", x: "X", tiktok: "TikTok", threads: "Threads", pinterest: "Pinterest", youtube: "YouTube" };
export const networkName = (p: Platform) => NETWORK_NAME[p];

// Ce qu'il manque à un post pour pouvoir être programmé : légende, réseau, média si le réseau l'exige, date au moins 2 minutes dans
// le futur. Utilisé par l'éditeur (validatePost) et par « Valider » (un post déjà en base, dont la date est déjà en UTC).
export function scheduleErrors(post: { caption: string; platforms: readonly Platform[]; imageUrl: string | null; scheduledAt: Date | null }, now: Date): PostErrors {
  const errors: PostErrors = {};
  const caption = post.caption.trim();
  if (!caption) errors.caption = "Écris la légende avant de programmer.";
  else {
    const tooLong = post.platforms.find((p) => caption.length > CAPTION_LIMITS[p]);
    if (tooLong) errors.caption = `Trop long pour ${NETWORK_NAME[tooLong]} : ${CAPTION_LIMITS[tooLong]} caractères au plus.`;
  }
  if (post.platforms.length === 0) errors.platforms = "Choisis au moins un réseau.";
  else {
    const video = post.platforms.find((p) => VIDEO_ONLY.includes(p));
    if (video) errors.platforms = `${NETWORK_NAME[video]} demande une vidéo : elle arrive en phase 3. Retire ce réseau pour programmer.`;
    else if (!post.imageUrl && post.platforms.some((p) => IMAGE_REQUIRED.includes(p))) errors.image = "Instagram et Pinterest demandent une image.";
  }
  if (!post.scheduledAt) errors.date = "Choisis le jour et l'heure de publication.";
  else if (post.scheduledAt.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) errors.date = "Cette date est déjà passée ou trop proche : choisis un moment au moins 2 minutes plus tard.";
  return errors;
}

// « draft » : enregistrer en brouillon, presque tout est facultatif (un titre suffit). « schedule » : programmer, tout doit être
// prêt : légende, réseau, média si le réseau l'exige, date future. `now` est un paramètre pour tester avec une date fixe.
export function validatePost(input: PostInput, mode: "draft" | "schedule", now: Date = new Date()): PostCheck {
  const errors: PostErrors = {};
  const title = input.title.trim();
  const caption = input.caption.trim();

  if (!title) errors.title = "Donne un titre au post (il reste interne, il n'est pas publié).";
  else if (title.length > TITLE_MAX) errors.title = `${TITLE_MAX} caractères au plus.`;

  if (caption.length > CAPTION_MAX) errors.caption = `${CAPTION_MAX} caractères au plus.`;

  if (input.platforms.some((p) => !isPlatform(p))) errors.platforms = "Réseau inconnu.";
  const platforms = [...new Set(input.platforms.filter(isPlatform))];

  const hashtags = cleanHashtags(input.hashtags);

  // Date : les deux champs ensemble, ou aucun
  let scheduledAt: Date | null = null;
  const hasDay = input.day.trim() !== "";
  const hasTime = input.time.trim() !== "";
  if (hasDay !== hasTime) errors.date = "Choisis le jour ET l'heure.";
  else if (hasDay && hasTime) {
    scheduledAt = parisToUtc(input.day.trim(), input.time.trim());
    if (!scheduledAt) errors.date = "Cette date ou cette heure n'existe pas (heure de Paris).";
  }

  if (mode === "schedule") {
    // Les erreurs de saisie déjà trouvées plus haut (date mal écrite, réseau inconnu…) priment sur celles de la programmation
    const more = scheduleErrors({ caption, platforms, imageUrl: input.imageUrl, scheduledAt }, now);
    for (const [field, message] of Object.entries(more) as [PostField, string][]) if (!errors[field]) errors[field] = message;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data: { title, caption, hashtags, platforms, imageUrl: input.imageUrl, scheduledAt } };
}
