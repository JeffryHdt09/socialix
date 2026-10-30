import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { postDeliveries, socialAccounts } from "@/db/schema";
import { publisher as defaultPublisher } from "@/lib/buffer";
import { getOwnedProject } from "@/lib/ownership";
import { isPlatform, networkName, type Platform } from "@/lib/post-rules";
import type { Publisher } from "@/lib/publisher";

// Les comptes d'un projet (chapitre 14) : quel compte du service de publication sert à quel réseau. Les comptes eux-mêmes se
// connectent chez le service ; ici on ne fait que les RELIER à un projet. Même règle d'isolation que partout : le propriétaire vient de
// la session, le projet est revérifié, et un compte n'est jamais lié sur la foi du navigateur (on relit la liste chez le service).

export type AccountView = { id: string; platform: Platform; name: string; channelId: string };

// Pourquoi une liaison ou un retrait a échoué. La page affiche un texte FIXE par code (jamais un texte venu de l'adresse).
export type AccountErrorCode = "introuvable" | "reseau" | "deconnecte" | "verrouille" | "deja" | "programmes" | "service";
export type AccountResult = { ok: true } | { ok: false; code: AccountErrorCode; message: string };

export async function readProjectAccounts(userId: string, projectId: string): Promise<AccountView[]> {
  if (!(await getOwnedProject(userId, projectId))) return [];
  const rows = await db.select().from(socialAccounts).where(eq(socialAccounts.projectId, projectId)).orderBy(asc(socialAccounts.createdAt));
  return rows.filter((r) => isPlatform(r.platform)).map((r) => ({ id: r.id, platform: r.platform as Platform, name: r.name, channelId: r.channelId }));
}

// Code d'erreur Postgres d'une violation d'unicité ou de clé étrangère, quelle que soit la couche qui l'enveloppe
const pgCode = (error: unknown): string | undefined => {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
};

// Relie un compte du service à un projet. `channelId` vient du navigateur : on relit la liste chez le service et on n'accepte que ce
// qui s'y trouve vraiment, avec le réseau qu'IL indique (jamais celui que le navigateur prétendrait).
export async function linkAccountAs(userId: string, projectId: string, channelId: string, pub: Publisher = defaultPublisher): Promise<AccountResult> {
  if (!(await getOwnedProject(userId, projectId))) return { ok: false, code: "introuvable", message: "Projet introuvable." };
  const listed = await pub.listChannels();
  if (!listed.ok) return { ok: false, code: "service", message: listed.message };
  const channel = listed.channels.find((c) => c.id === channelId);
  if (!channel) return { ok: false, code: "introuvable", message: "Ce compte n’existe pas (ou plus) chez le service de publication." };
  if (!channel.platform) return { ok: false, code: "reseau", message: "Socialix ne gère pas encore ce réseau." };
  if (channel.disconnected) return { ok: false, code: "deconnecte", message: "Ce compte est déconnecté chez le service de publication : reconnecte-le d’abord." };
  if (channel.locked) return { ok: false, code: "verrouille", message: "Ce compte est verrouillé chez le service de publication (limite de ton offre)." };

  const [existing] = await db.select().from(socialAccounts).where(and(eq(socialAccounts.projectId, projectId), eq(socialAccounts.platform, channel.platform))).limit(1);
  if (existing) {
    if (existing.channelId === channel.id) return { ok: true }; // déjà lié : sans effet
    return { ok: false, code: "deja", message: `Ce projet a déjà un compte ${networkName(channel.platform)} : retire-le d’abord.` };
  }
  try {
    await db.insert(socialAccounts).values({ projectId, provider: pub.name, channelId: channel.id, platform: channel.platform, name: channel.name.slice(0, 200) });
  } catch (error) {
    // Deux liaisons simultanées pour le même réseau : la base n'en laisse passer qu'une
    if (pgCode(error) === "23505") return { ok: false, code: "deja", message: `Ce projet a déjà un compte ${networkName(channel.platform)} : retire-le d’abord.` };
    throw error;
  }
  return { ok: true };
}

// Retire un compte d'un projet. Refusé tant que des posts programmés passent par lui : sinon ils partiraient chez le service sans que
// nous sachions les annuler.
export async function unlinkAccountAs(userId: string, projectId: string, accountId: string): Promise<AccountResult> {
  if (!(await getOwnedProject(userId, projectId))) return { ok: false, code: "introuvable", message: "Projet introuvable." };
  const [account] = await db.select().from(socialAccounts).where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.projectId, projectId))).limit(1);
  if (!account) return { ok: false, code: "introuvable", message: "Ce compte n’est pas lié à ce projet." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(postDeliveries).where(and(eq(postDeliveries.socialAccountId, account.id), eq(postDeliveries.status, "scheduled")));
  const blocked: AccountResult = { ok: false, code: "programmes", message: "Des posts programmés passent par ce compte : déprogramme-les d’abord." };
  if (n > 0) return blocked;
  try {
    // L'historique de ce compte (posts déjà envoyés ou en échec) part avec lui : il ne sert plus à rien sans le compte. Dans la même
    // transaction, pour que rien ne reste à moitié supprimé.
    await db.transaction(async (tx) => {
      await tx.delete(postDeliveries).where(and(eq(postDeliveries.socialAccountId, account.id), sql`${postDeliveries.status} <> 'scheduled'`));
      await tx.delete(socialAccounts).where(and(eq(socialAccounts.id, account.id), eq(socialAccounts.projectId, projectId)));
    });
  } catch (error) {
    // Un post a été programmé entre la vérification et la suppression : la clé étrangère refuse (23503) et tout est annulé
    if (pgCode(error) === "23503") return blocked;
    throw error;
  }
  return { ok: true };
}
