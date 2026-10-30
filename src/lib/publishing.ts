import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { postDeliveries } from "@/db/schema";
import { readProjectAccounts } from "@/lib/account-service";
import { publisher as defaultPublisher } from "@/lib/buffer";
import { type ActionResult, getPostAs, prepareSave, revertScheduledPost, savePostAs, type SavePostResult, unschedulePostAs, validatePostAs, deletePostAs } from "@/lib/post-queries";
import { buildPostText, CAPTION_LIMITS, isPlatform, networkName, type Platform, type PostInput } from "@/lib/post-rules";
import type { Publisher } from "@/lib/publisher";

// La publication d'un post (chapitre 14) : tenir notre base ET le service de publication d'accord. Les deux ne peuvent pas être
// modifiés en une seule opération : on choisit donc l'ordre qui, si quelque chose casse au milieu, laisse l'état le plus SÛR.
//   - Programmer : sauvegarder chez nous, PUIS envoyer au service ; si le service refuse, on remet le post comme avant.
//   - Déprogrammer ou supprimer : annuler chez le service D'ABORD ; si l'annulation échoue, on ne touche à rien chez nous (sinon le
//     post resterait programmé chez eux, donc publié, alors que nous le croirions retiré).
// Un post n'est JAMAIS publié sans une action de la personne : « Programmer » et « Valider » sont des boutons de l'interface,
// aucun agent n'y a accès (CLAUDE.md, règle des outils).

export type SendFailureCode = "service" | "compte" | "etat" | "texte";
export type SendResult = { ok: true; deliveries: number } | { ok: false; code: SendFailureCode; message: string };
export type CancelDeliveriesResult = { ok: true; cancelled: number } | { ok: false; message: string };

const detailOf = (f: { message: string; detail?: string }) => (f.detail ? `${f.message} (${f.detail})` : f.message);

// Retire chez le service tous les envois programmés d'un post, puis efface leur trace chez nous. Un envoi retiré ne l'est de chez nous
// QU'APRÈS que le service a confirmé : s'il refuse, la trace reste (on saura quoi annuler plus tard). Les envois déjà publiés
// (« sent ») sont de l'histoire : on n'y touche pas.
export async function cancelPostDeliveries(userId: string, projectId: string, postId: string, pub: Publisher = defaultPublisher): Promise<CancelDeliveriesResult> {
  const post = await getPostAs(userId, projectId, postId); // vérifie le propriétaire et le projet
  if (!post) return { ok: true, cancelled: 0 };
  const rows = await db.select().from(postDeliveries).where(and(eq(postDeliveries.postId, postId), ne(postDeliveries.status, "sent")));
  let cancelled = 0;
  let firstFailure: string | null = null;
  let failures = 0;
  for (const row of rows) {
    // Un envoi « en échec » n'a plus rien à annuler chez le réseau : on efface seulement sa trace
    if (row.status === "scheduled") {
      const res = await pub.cancel(row.externalId);
      if (!res.ok) {
        failures++;
        firstFailure ??= detailOf(res);
        continue;
      }
    }
    await db.delete(postDeliveries).where(eq(postDeliveries.id, row.id));
    cancelled++;
  }
  if (failures > 0) return { ok: false, message: `${failures} envoi${failures > 1 ? "s n'ont" : " n'a"} pas pu être annulé${failures > 1 ? "s" : ""} chez le service de publication : ${firstFailure}` };
  return { ok: true, cancelled };
}

// Envoie un post PROGRAMMÉ chez le service, un envoi par réseau choisi. Tout ou rien : si un réseau est refusé, ceux déjà envoyés sont
// annulés. Chaque envoi réussi est enregistré chez nous AUSSITÔT (pas à la fin) : si le serveur s'arrête au milieu, on sait ce qui
// existe chez le service.
export async function sendScheduledPost(userId: string, projectId: string, postId: string, pub: Publisher = defaultPublisher): Promise<SendResult> {
  const post = await getPostAs(userId, projectId, postId);
  if (!post) return { ok: false, code: "etat", message: "Ce post est introuvable." };
  if (post.status !== "scheduled" || !post.scheduledAt) return { ok: false, code: "etat", message: "Ce post n’est pas programmé : rien à envoyer." };
  const platforms = post.platforms.filter(isPlatform);
  if (platforms.length === 0) return { ok: false, code: "etat", message: "Ce post n’a aucun réseau." };

  const accounts = new Map((await readProjectAccounts(userId, projectId)).map((a) => [a.platform, a]));
  const missing = platforms.find((p) => !accounts.has(p));
  if (missing) return { ok: false, code: "compte", message: `Aucun compte ${networkName(missing)} n’est lié à ce projet : ajoute-le dans « Comptes », ou retire ce réseau du post.` };

  // Le texte réellement envoyé (légende + hashtags) doit tenir dans la limite de CHAQUE réseau : le service le refuserait sinon
  const text = buildPostText(post.caption, post.hashtags);
  const tooLong = platforms.find((p) => text.length > CAPTION_LIMITS[p]);
  if (tooLong) return { ok: false, code: "texte", message: `Légende et hashtags dépassent ${CAPTION_LIMITS[tooLong]} caractères pour ${networkName(tooLong)}.` };

  // S'il reste des envois d'une version précédente, on les retire d'abord : jamais deux versions du même post chez le service
  const cleared = await cancelPostDeliveries(userId, projectId, postId, pub);
  if (!cleared.ok) return { ok: false, code: "service", message: cleared.message };

  const created: { rowId: string; externalId: string; platform: Platform }[] = [];
  for (const platform of platforms) {
    const account = accounts.get(platform)!;
    const res = await pub.schedule({ channelId: account.channelId, platform, text, imageUrls: post.imageUrl ? [post.imageUrl] : [], dueAt: post.scheduledAt });
    if (!res.ok) {
      // Retour en arrière : on annule ce qui a déjà été envoyé pour les autres réseaux
      let orphans = 0;
      for (const done of created) {
        const undo = await pub.cancel(done.externalId);
        if (undo.ok) await db.delete(postDeliveries).where(eq(postDeliveries.id, done.rowId));
        else orphans++; // la trace reste : le balayage (ou un nouvel essai) l'annulera
      }
      const warning = orphans > 0 ? ` Attention : ${orphans} envoi${orphans > 1 ? "s" : ""} déjà fait${orphans > 1 ? "s" : ""} n’a pas pu être annulé chez le service ; il sera retiré au prochain passage.` : "";
      return { ok: false, code: "service", message: `${networkName(platform)} : ${detailOf(res)}.${warning}` };
    }
    const [row] = await db.insert(postDeliveries).values({ postId, socialAccountId: account.id, externalId: res.externalId, status: "scheduled", dueAt: res.dueAt ?? post.scheduledAt }).returning({ id: postDeliveries.id });
    created.push({ rowId: row.id, externalId: res.externalId, platform });
  }
  return { ok: true, deliveries: created.length };
}

// ── Les actions de la personne, de bout en bout ──────────────────────────────────────────────────────────────────────

// « Enregistrer en brouillon » ou « Programmer » depuis l'éditeur.
export async function savePostAndPublish(userId: string, projectId: string, postId: string | null, input: PostInput, mode: "draft" | "schedule", pub: Publisher = defaultPublisher, now: Date = new Date()): Promise<SavePostResult> {
  // 1. On vérifie que la sauvegarde passera, SANS rien écrire
  const prepared = await prepareSave(userId, projectId, postId, input, mode, now);
  if (!prepared.ok) return prepared;
  // 2. Un post déjà chez le service en est retiré AVANT de changer le nôtre (sinon l'ancienne version partirait)
  if (postId !== null) {
    const cleared = await cancelPostDeliveries(userId, projectId, postId, pub);
    if (!cleared.ok) return { ok: false, error: `Rien n’a été modifié. ${cleared.message}` };
  }
  // 3. On sauvegarde chez nous
  const saved = await savePostAs(userId, projectId, postId, input, mode, now);
  if (!saved.ok || saved.status !== "scheduled") return saved;
  // 4. On envoie au service ; s'il refuse, le post redevient un brouillon (ce que la personne a écrit est conservé)
  const sent = await sendScheduledPost(userId, projectId, saved.id, pub);
  if (sent.ok) return saved;
  await revertScheduledPost(projectId, saved.id, "draft");
  return { ok: false, error: `${sent.message} Le post est enregistré en brouillon, rien n’est programmé.` };
}

// « Valider » un post à valider (souvent produit par l'équipe) : il devient programmé ET part chez le service.
export async function validateAndPublish(userId: string, projectId: string, postId: string, pub: Publisher = defaultPublisher, now: Date = new Date()): Promise<ActionResult> {
  const validated = await validatePostAs(userId, projectId, postId, now);
  if (!validated.ok) return validated;
  const sent = await sendScheduledPost(userId, projectId, postId, pub);
  if (sent.ok) return { ok: true };
  await revertScheduledPost(projectId, postId, "to_review");
  return { ok: false, error: sent.message, code: sent.code === "compte" ? "compte" : "publication" };
}

// « Déprogrammer » : annuler chez le service, PUIS repasser en brouillon chez nous.
export async function unscheduleAndCancel(userId: string, projectId: string, postId: string, pub: Publisher = defaultPublisher): Promise<ActionResult> {
  const cleared = await cancelPostDeliveries(userId, projectId, postId, pub);
  if (!cleared.ok) return { ok: false, error: cleared.message, code: "publication" };
  return unschedulePostAs(userId, projectId, postId);
}

// « Supprimer » : annuler chez le service, PUIS supprimer chez nous.
export async function deleteAndCancel(userId: string, projectId: string, postId: string, pub: Publisher = defaultPublisher): Promise<ActionResult> {
  const cleared = await cancelPostDeliveries(userId, projectId, postId, pub);
  if (!cleared.ok) return { ok: false, error: cleared.message, code: "publication" };
  return deletePostAs(userId, projectId, postId);
}
