import "server-only";

import { db } from "@/db";
import { posts } from "@/db/schema";
import { agentImageUrl, isAgentImageKeyFor } from "@/lib/storage";

// Les brouillons de post écrits par les agents (chapitre 12). Un agent ne programme ni ne publie rien : il dépose un post
// « à valider » (statut to_review, auteur « agent », sans date). La personne le relit, le modifie et le programme
// (chapitres 13 à 15). Le projet vient de la tâche, pas du modèle.

export const PLATFORMS = ["instagram", "facebook", "linkedin", "x", "tiktok", "threads", "pinterest", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const MAX_CAPTION_CHARS = 2200; // la limite d'Instagram, la plus longue des légendes courantes
export const MAX_POST_TITLE_CHARS = 120; // même plafond que la base (check posts_title_length)
export const MAX_HASHTAGS = 30;

// « #Café » et « café » deviennent « café » ; on garde lettres, chiffres et tiret bas, 50 signes au plus, sans doublon.
export function cleanHashtags(raw: readonly string[]): string[] {
  const out: string[] = [];
  for (const h of raw) {
    const tag = h.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 50).toLowerCase();
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length >= MAX_HASHTAGS) break;
  }
  return out;
}

export type DraftInput = { userId: string; projectId: string; title: string; caption: string; hashtags: readonly string[]; platforms: readonly string[]; imageKey?: string };
export type DraftResult = { ok: true; id: string } | { ok: false; reason: "invalide" | "image_inconnue" };

export async function createPostDraft(input: DraftInput): Promise<DraftResult> {
  const title = input.title.trim();
  const caption = input.caption.trim();
  const platforms = [...new Set(input.platforms.map((p) => p.trim().toLowerCase()))].filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));
  if (!title || title.length > MAX_POST_TITLE_CHARS || !caption || caption.length > MAX_CAPTION_CHARS || platforms.length === 0) return { ok: false, reason: "invalide" };
  // Une image ne peut venir que du stockage de CE projet : jamais une adresse libre choisie par le modèle
  if (input.imageKey !== undefined && !isAgentImageKeyFor(input.imageKey, input.userId, input.projectId)) return { ok: false, reason: "image_inconnue" };
  const [row] = await db
    .insert(posts)
    .values({
      projectId: input.projectId,
      title,
      caption,
      hashtags: cleanHashtags(input.hashtags),
      platforms,
      imageUrl: input.imageKey ? agentImageUrl(input.imageKey) : null,
      status: "to_review",
      createdBy: "agent",
    })
    .returning({ id: posts.id });
  return { ok: true, id: row.id };
}
