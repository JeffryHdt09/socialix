import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { posts } from "@/db/schema";
import { getOwnedProject } from "@/lib/ownership";
import { isPlatform, type PostErrors, type PostInput, scheduleErrors, validatePost } from "@/lib/post-rules";
import { agentImageUrl, isAgentImageKeyFor, projectImageKeyFromUrl } from "@/lib/storage";

// Lire, créer, modifier et changer l'état des posts d'un projet (chapitre 13). Comme partout : le propriétaire (`userId`) vient de
// la SESSION, jamais d'un paramètre de l'appelant, et le projet est revérifié ici. Un identifiant de post est toujours cherché AVEC
// son projet : l'identifiant d'un post d'un autre projet ne trouve rien.

export type PostStatus = (typeof posts.$inferSelect)["status"];
export type PostView = {
  id: string;
  title: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  imageUrl: string | null;
  scheduledAt: Date | null;
  status: PostStatus;
  createdBy: "user" | "agent";
  createdAt: Date;
};

export const MAX_POSTS_PER_PROJECT = 500; // sans plafond, un projet (ou un agent qui boucle) remplirait la base

const columns = {
  id: posts.id,
  title: posts.title,
  caption: posts.caption,
  hashtags: posts.hashtags,
  platforms: posts.platforms,
  imageUrl: posts.imageUrl,
  scheduledAt: posts.scheduledAt,
  status: posts.status,
  createdBy: posts.createdBy,
  createdAt: posts.createdAt,
};

export const isUuid = (v: unknown): v is string => z.uuid().safeParse(v).success;

// Les posts du projet d'UN état, du plus récent au plus ancien (les programmés dans l'ordre où ils partiront). Liste vide si le projet
// n'est pas à la personne. La page n'affiche qu'un onglet à la fois : on ne charge pas les légendes des quatre autres.
export async function readProjectPosts(userId: string, projectId: string, status: PostStatus): Promise<PostView[]> {
  if (!(await getOwnedProject(userId, projectId))) return [];
  return db
    .select(columns)
    .from(posts)
    .where(and(eq(posts.projectId, projectId), eq(posts.status, status)))
    .orderBy(status === "scheduled" ? asc(posts.scheduledAt) : desc(posts.createdAt))
    .limit(MAX_POSTS_PER_PROJECT);
}

// Combien de posts par état, en une requête qui ne transporte aucune légende : ce sont les compteurs des onglets.
export async function readPostCounts(userId: string, projectId: string): Promise<Record<PostStatus, number>> {
  const counts: Record<PostStatus, number> = { draft: 0, to_review: 0, scheduled: 0, published: 0, failed: 0 };
  if (!(await getOwnedProject(userId, projectId))) return counts;
  const rows = await db.select({ status: posts.status, n: sql<number>`count(*)::int` }).from(posts).where(eq(posts.projectId, projectId)).groupBy(posts.status);
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

type NewPost = Omit<typeof posts.$inferInsert, "projectId">;

// Crée un post sous le plafond du projet. Le comptage et l'insertion se font sous un verrou propre au projet : sans lui, des
// créations simultanées dépasseraient la limite. UN seul endroit pour savePostAs et duplicatePostAs : le verrou et le plafond ne
// peuvent pas se désaccorder. Renvoie null quand le plafond est atteint.
async function insertPostWithinCap(projectId: string, values: NewPost): Promise<{ id: string } | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`posts:${projectId}`}))`);
    const [{ n }] = await tx.execute<{ n: string }>(sql`select count(*) as n from posts where project_id = ${projectId}`);
    if (Number(n) >= MAX_POSTS_PER_PROJECT) return null;
    const [row] = await tx.insert(posts).values({ ...values, projectId }).returning({ id: posts.id });
    return row;
  });
}

export async function getPostAs(userId: string, projectId: string, postId: string): Promise<PostView | null> {
  if (!isUuid(postId) || !(await getOwnedProject(userId, projectId))) return null;
  const [row] = await db.select(columns).from(posts).where(and(eq(posts.id, postId), eq(posts.projectId, projectId))).limit(1);
  return row ?? null;
}

export type SavePostResult = { ok: true; id: string; status: PostStatus } | { ok: false; errors?: PostErrors; error?: string };

// Enregistre un post du formulaire : « draft » = brouillon, « schedule » = programmé. `postId` null = nouveau post.
// Tout est revérifié ici (le formulaire peut mentir) : les champs par validatePost, l'image (elle doit venir de NOTRE stockage et de
// CE projet : une adresse écrite à la main est refusée), le projet, l'état du post (un post publié ne se modifie plus).
export async function savePostAs(userId: string, projectId: string, postId: string | null, input: PostInput, mode: "draft" | "schedule", now: Date = new Date()): Promise<SavePostResult> {
  if (!(await getOwnedProject(userId, projectId))) return { ok: false, error: "Projet introuvable." };
  if (postId !== null && !isUuid(postId)) return { ok: false, error: "Post introuvable." };

  // L'image : vide, ou une adresse de notre stockage pour ce projet
  let imageUrl: string | null = null;
  const wanted = input.imageUrl?.trim();
  if (wanted) {
    try {
      const key = projectImageKeyFromUrl(wanted, userId, projectId);
      if (!key) return { ok: false, errors: { image: "Cette image n'appartient pas à ce projet : téléverse-la de nouveau." } };
      imageUrl = agentImageUrl(key);
    } catch {
      return { ok: false, errors: { image: "Le stockage d'images n'est pas disponible pour l'instant." } };
    }
  }

  const check = validatePost({ ...input, imageUrl }, mode, now);
  if (!check.ok) return { ok: false, errors: check.errors };
  const d = check.data;
  const status: PostStatus = mode === "schedule" ? "scheduled" : "draft";

  if (postId === null) {
    const created = await insertPostWithinCap(projectId, { title: d.title, caption: d.caption, hashtags: d.hashtags, platforms: d.platforms, imageUrl: d.imageUrl, scheduledAt: d.scheduledAt, status, createdBy: "user" });
    return created ? { ok: true, id: created.id, status } : { ok: false, error: `Ce projet a atteint la limite de ${MAX_POSTS_PER_PROJECT} posts.` };
  }

  // Un post déjà publié ne se modifie plus (il existe chez le réseau) ; la condition est dans le WHERE, donc vraie même si
  // quelqu'un le publie pendant qu'on édite.
  const updated = await db
    .update(posts)
    .set({ title: d.title, caption: d.caption, hashtags: d.hashtags, platforms: d.platforms, imageUrl: d.imageUrl, scheduledAt: d.scheduledAt, status })
    .where(and(eq(posts.id, postId), eq(posts.projectId, projectId), sql`${posts.status} <> 'published'`))
    .returning({ id: posts.id });
  return updated.length > 0 ? { ok: true, id: postId, status } : { ok: false, error: "Ce post est introuvable ou déjà publié : il ne peut plus être modifié." };
}

// `code` : pourquoi l'action a échoué, en mot court. La page Posts l'affiche avec un texte FIXE (jamais un texte venu de l'adresse).
export type ActionFailureCode = "etat" | "limite" | "introuvable";
export type ActionResult = { ok: true } | { ok: false; error: string; code?: ActionFailureCode; needsEditor?: boolean };

// « Valider » un post à valider : s'il a déjà tout ce qu'il faut pour partir (légende, réseau, image si le réseau l'exige, date au
// moins 2 minutes dans le futur), il devient programmé. Sinon on renvoie `needsEditor` : la personne doit compléter dans l'éditeur.
export async function validatePostAs(userId: string, projectId: string, postId: string, now: Date = new Date()): Promise<ActionResult> {
  const post = await getPostAs(userId, projectId, postId);
  if (!post) return { ok: false, error: "Post introuvable.", code: "introuvable" };
  if (post.status !== "to_review") return { ok: false, error: "Ce post n'est pas à valider.", code: "etat" };
  const missing = scheduleErrors({ caption: post.caption, hashtags: post.hashtags, platforms: post.platforms.filter(isPlatform), imageUrl: post.imageUrl, scheduledAt: post.scheduledAt }, now);
  if (Object.keys(missing).length > 0) return { ok: false, error: "Il manque des informations (date, réseau, légende ou image) : complète le post dans l'éditeur.", needsEditor: true };
  const updated = await db
    .update(posts)
    .set({ status: "scheduled" })
    .where(and(eq(posts.id, postId), eq(posts.projectId, projectId), eq(posts.status, "to_review")))
    .returning({ id: posts.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: "Ce post a déjà changé d'état.", code: "etat" };
}

// « Déprogrammer » : un post programmé redevient brouillon (sa date reste affichée dans l'éditeur, rien n'est perdu).
export async function unschedulePostAs(userId: string, projectId: string, postId: string): Promise<ActionResult> {
  if (!isUuid(postId) || !(await getOwnedProject(userId, projectId))) return { ok: false, error: "Post introuvable.", code: "introuvable" };
  const updated = await db
    .update(posts)
    .set({ status: "draft" })
    .where(and(eq(posts.id, postId), eq(posts.projectId, projectId), eq(posts.status, "scheduled")))
    .returning({ id: posts.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: "Ce post n'est pas programmé.", code: "etat" };
}

// « Dupliquer » : une copie en brouillon, sans date, à ton nom.
export async function duplicatePostAs(userId: string, projectId: string, postId: string): Promise<ActionResult & { id?: string }> {
  const post = await getPostAs(userId, projectId, postId);
  if (!post) return { ok: false, error: "Post introuvable.", code: "introuvable" };
  const title = `Copie de ${post.title}`.slice(0, 120);
  const created = await insertPostWithinCap(projectId, { title, caption: post.caption, hashtags: post.hashtags, platforms: post.platforms, imageUrl: post.imageUrl, status: "draft", createdBy: "user" });
  return created ? { ok: true, id: created.id } : { ok: false, error: `Ce projet a atteint la limite de ${MAX_POSTS_PER_PROJECT} posts.`, code: "limite" };
}

// « Supprimer » : tout sauf un post déjà publié (il existe chez le réseau ; on garde sa trace).
export async function deletePostAs(userId: string, projectId: string, postId: string): Promise<ActionResult> {
  if (!isUuid(postId) || !(await getOwnedProject(userId, projectId))) return { ok: false, error: "Post introuvable.", code: "introuvable" };
  const deleted = await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.projectId, projectId), sql`${posts.status} <> 'published'`))
    .returning({ id: posts.id });
  return deleted.length > 0 ? { ok: true } : { ok: false, error: "Ce post est introuvable ou déjà publié : il ne peut pas être supprimé.", code: "etat" };
}

// Les images produites par l'équipe pour ce projet (jointes aux résultats de tâches), les plus récentes d'abord : l'éditeur les
// propose en un clic. Seules les clés qui sont bien des images de CE projet et de CETTE personne sont gardées.
export async function readTeamImages(userId: string, projectId: string, limit = 24): Promise<string[]> {
  if (!(await getOwnedProject(userId, projectId))) return [];
  const rows = await db.execute<{ img: string }>(sql`
    select img from (
      select jsonb_array_elements_text(t.output -> 'images') as img, t.finished_at
      from agent_tasks t join agent_plans p on p.id = t.plan_id
      where p.project_id = ${projectId} and jsonb_typeof(t.output -> 'images') = 'array'
    ) x order by finished_at desc nulls last limit ${limit * 2}`);
  const urls: string[] = [];
  try {
    for (const r of rows) {
      if (urls.length >= limit) break;
      if (typeof r.img === "string" && isAgentImageKeyFor(r.img, userId, projectId)) urls.push(agentImageUrl(r.img));
    }
  } catch {
    return []; // stockage non configuré : pas d'images proposées plutôt qu'une page cassée
  }
  return [...new Set(urls)];
}
