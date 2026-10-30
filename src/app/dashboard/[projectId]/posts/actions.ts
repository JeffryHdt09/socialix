"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/dal";
import { readLogoFile } from "@/lib/logo-upload";
import { type ActionResult, deletePostAs, duplicatePostAs, isUuid, savePostAs, type SavePostResult, unschedulePostAs, validatePostAs } from "@/lib/post-queries";
import type { PostInput } from "@/lib/post-rules";
import { getOwnedProject } from "@/lib/ownership";
import { imagekitConfig, retouchImage } from "@/lib/imagekit";
import { allowRetouch, allowUpload } from "@/lib/retouch-limit";
import { validateSpec } from "@/lib/retouch-rules";
import { agentImageUrl, projectImageKeyFromUrl, uploadPostImage } from "@/lib/storage";

// Les actions de la page Posts et de l'éditeur. Une action serveur est une adresse publique : la session est revérifiée à chaque
// fois, le propriétaire vient de la session, et tout le reste (projet, post, champs, image) est revérifié dans post-queries.ts.
// Les identifiants liés au formulaire (`.bind`) ne sont pas crus pour autant.

const postsPath = (projectId: string) => `/dashboard/${projectId}/posts`;

// Une action qui échoue ne doit pas laisser un bouton muet : on revient sur la page Posts avec un CODE court (jamais un texte :
// la page affiche un message fixe, une adresse trafiquée ne peut donc pas faire afficher n'importe quoi).
function failed(projectId: string, result: ActionResult): void {
  if (!result.ok && result.code) redirect(`${postsPath(projectId)}?erreur=${result.code}`);
}

// Rafraîchit la page Posts et la vue d'ensemble (leurs compteurs viennent des posts)
function refresh(projectId: string) {
  revalidatePath(postsPath(projectId));
  revalidatePath(`/dashboard/${projectId}/overview`);
}

async function authorized(projectId: unknown, postId: unknown): Promise<{ userId: string; projectId: string; postId: string } | null> {
  const session = await getSession();
  if (!session || !isUuid(projectId) || !isUuid(postId)) return null;
  return { userId: session.user.id, projectId, postId };
}

export async function validatePostAction(projectId: string, postId: string): Promise<void> {
  const a = await authorized(projectId, postId);
  if (!a) return;
  const result = await validatePostAs(a.userId, a.projectId, a.postId);
  refresh(a.projectId);
  // Il manque quelque chose pour partir : on ouvre l'éditeur plutôt que de laisser la personne devant un bouton muet
  if (!result.ok && result.needsEditor) redirect(`${postsPath(a.projectId)}/${a.postId}?programmer=1`);
  failed(a.projectId, result);
}

export async function unschedulePostAction(projectId: string, postId: string): Promise<void> {
  const a = await authorized(projectId, postId);
  if (!a) return;
  const result = await unschedulePostAs(a.userId, a.projectId, a.postId);
  refresh(a.projectId);
  failed(a.projectId, result);
}

export async function duplicatePostAction(projectId: string, postId: string): Promise<void> {
  const a = await authorized(projectId, postId);
  if (!a) return;
  const result = await duplicatePostAs(a.userId, a.projectId, a.postId);
  refresh(a.projectId);
  if (result.ok && result.id) redirect(`${postsPath(a.projectId)}/${result.id}`); // la copie s'ouvre dans l'éditeur
  failed(a.projectId, result);
}

export async function deletePostAction(projectId: string, postId: string): Promise<void> {
  const a = await authorized(projectId, postId);
  if (!a) return;
  const result = await deletePostAs(a.userId, a.projectId, a.postId);
  refresh(a.projectId);
  failed(a.projectId, result);
}

// Enregistre un post depuis l'éditeur : brouillon ou programmé. `postId` null = nouveau post. Le contenu arrive comme un objet simple,
// pas comme un formulaire : savePostAs revérifie tout champ par champ.
export async function savePostAction(projectId: string, postId: string | null, input: PostInput, mode: "draft" | "schedule"): Promise<SavePostResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (!isUuid(projectId) || (postId !== null && !isUuid(postId)) || (mode !== "draft" && mode !== "schedule") || typeof input !== "object" || input === null) {
    return { ok: false, error: "Demande invalide." };
  }
  // On ne retient que les champs attendus, avec le bon type : rien d'autre venu du navigateur n'entre
  const clean: PostInput = {
    title: typeof input.title === "string" ? input.title : "",
    caption: typeof input.caption === "string" ? input.caption : "",
    hashtags: Array.isArray(input.hashtags) ? input.hashtags.filter((h): h is string => typeof h === "string").slice(0, 60) : [],
    platforms: Array.isArray(input.platforms) ? input.platforms.filter((p): p is string => typeof p === "string").slice(0, 20) : [],
    imageUrl: typeof input.imageUrl === "string" ? input.imageUrl : null,
    day: typeof input.day === "string" ? input.day : "",
    time: typeof input.time === "string" ? input.time : "",
  };
  const result = await savePostAs(session.user.id, projectId, postId, clean, mode);
  if (result.ok) refresh(projectId);
  return result;
}

export type UploadImageResult = { ok: true; url: string } | { ok: false; error: string };

// Téléverse l'image d'un post. Contrôlée sur ses OCTETS (PNG, JPG ou WebP, 3 Mo au plus : voir logo-check.ts), nommée par nous.
export async function uploadPostImageAction(projectId: string, formData: FormData): Promise<UploadImageResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (!isUuid(projectId) || !(await getOwnedProject(session.user.id, projectId))) return { ok: false, error: "Projet introuvable." };
  if (!allowUpload(session.user.id)) return { ok: false, error: "Trop d'images envoyées en peu de temps : attends quelques minutes." };
  const file = await readLogoFile(formData.get("image"));
  if (file === null) return { ok: false, error: "Choisis une image." };
  if (!file.ok) return { ok: false, error: file.error };
  try {
    const key = await uploadPostImage(session.user.id, projectId, file.bytes, file.contentType as "image/png" | "image/jpeg" | "image/webp");
    return { ok: true, url: agentImageUrl(key) };
  } catch (error) {
    console.error("Image de post : l'envoi a échoué", error instanceof Error ? error.name : "?");
    return { ok: false, error: "L'image n'a pas pu être envoyée. Réessaie dans un instant." };
  }
}

export type RetouchResultView = { ok: true; url: string } | { ok: false; error: string };

// Retouche l'image d'un post avec ImageKit : la demande est contrôlée (validateSpec), l'image doit être une image de CE projet dans
// NOTRE stockage, le résultat est rangé dans notre stockage (ImageKit ne garde rien). La personne voit le résultat, puis le choisit
// ou l'abandonne ; la retouche part toujours de l'image d'origine, pas de la précédente.
export async function retouchImageAction(projectId: string, sourceUrl: string, rawSpec: unknown): Promise<RetouchResultView> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (!isUuid(projectId) || typeof sourceUrl !== "string" || !(await getOwnedProject(session.user.id, projectId))) return { ok: false, error: "Projet introuvable." };
  const checked = validateSpec(rawSpec);
  if (!checked.ok) return { ok: false, error: checked.error };
  if (!imagekitConfig()) return { ok: false, error: "La retouche n'est pas configurée : renseigne IMAGEKIT_URL_ENDPOINT et IMAGEKIT_PRIVATE_KEY dans .env.local." };
  let key: string | null;
  try {
    key = projectImageKeyFromUrl(sourceUrl, session.user.id, projectId);
  } catch {
    return { ok: false, error: "Le stockage d'images n'est pas disponible pour l'instant." };
  }
  if (!key) return { ok: false, error: "Cette image n'appartient pas à ce projet." };
  if (!allowRetouch(session.user.id)) return { ok: false, error: "Trop de retouches en peu de temps : attends quelques minutes." };

  const result = await retouchImage(agentImageUrl(key), checked.spec);
  if (!result.ok) {
    const why = { non_configure: "La retouche n'est pas configurée.", refuse: "ImageKit a refusé cette retouche (image trop grande, ou réglage non pris en charge).", trop_long: "La retouche prend trop de temps : réessaie dans un instant.", indisponible: "La retouche n'a pas pu se faire. Réessaie dans un instant." }[result.reason];
    return { ok: false, error: why };
  }
  try {
    const stored = await uploadPostImage(session.user.id, projectId, result.bytes, result.mediaType);
    return { ok: true, url: agentImageUrl(stored) };
  } catch {
    return { ok: false, error: "Le résultat n'a pas pu être enregistré. Réessaie dans un instant." };
  }
}
