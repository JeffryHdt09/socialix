import "server-only";

import { and, asc, eq, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { postDeliveries, posts } from "@/db/schema";
import { publisher as defaultPublisher } from "@/lib/buffer";
import { sendScheduledPost } from "@/lib/publishing";
import type { Publisher } from "@/lib/publisher";

// La synchronisation de la publication (chapitre 14.4) : ce que le service a VRAIMENT fait des posts programmés, et le rattrapage de ce
// qu'une panne a laissé de travers. Elle ne publie jamais rien : elle lit, met à jour nos états, et nettoie. Appelée régulièrement par
// Inngest (src/inngest/functions.ts), mais toutes les règles sont ici, testables sans lui.

// Un post que le service n'a pas encore fini de traiter n'est pas en échec : on lui laisse du temps, mais pas indéfiniment.
export const STUCK_AFTER_HOURS = 6;
// Une opération en cours (programmer, reprogrammer) passe par plusieurs étapes. Le rattrapage n'y touche pas avant ce délai, sinon il
// enverrait en double un post que quelqu'un est justement en train d'envoyer.
export const GRACE_MINUTES = 10;
const MIN_LEAD_MS = 2 * 60_000; // même marge que la programmation : un post qui part dans moins de 2 minutes ne s'envoie plus

export type SyncReport = {
  checked: number; // envois dont l'heure est venue et dont on a demandé l'état
  sent: number; // devenus « publiés »
  failed: number; // devenus « en échec »
  unreachable: number; // le service n'a pas répondu : on réessaiera au prochain passage
  postsPublished: number;
  postsFailed: number;
  resent: number; // posts « programmés » sans aucun envoi, renvoyés au service
  orphansCancelled: number; // envois restés chez le service pour un post qui n'est plus programmé, annulés
};

const emptyReport = (): SyncReport => ({ checked: 0, sent: 0, failed: 0, unreachable: 0, postsPublished: 0, postsFailed: 0, resent: 0, orphansCancelled: 0 });

// Lit chez le service où en sont les envois dont l'heure est venue, met à jour chaque envoi, puis l'état du post (« publié » seulement
// si TOUS ses envois sont partis, « en échec » dès qu'un seul a échoué et que rien n'est plus en attente).
async function syncDueDeliveries(pub: Publisher, now: Date, limit: number, report: SyncReport): Promise<void> {
  const due = await db
    .select({ id: postDeliveries.id, externalId: postDeliveries.externalId, dueAt: postDeliveries.dueAt })
    .from(postDeliveries)
    .innerJoin(posts, eq(posts.id, postDeliveries.postId))
    .where(and(eq(postDeliveries.status, "scheduled"), eq(posts.status, "scheduled"), lte(postDeliveries.dueAt, new Date(now.getTime() + 60_000))))
    .orderBy(asc(postDeliveries.dueAt))
    .limit(limit);

  for (const row of due) {
    report.checked++;
    const res = await pub.state(row.externalId);
    let update: { status: "sent" | "failed"; sentAt?: Date | null; link?: string | null; error?: string } | null = null;

    if (!res.ok) {
      if (res.reason === "not_found") update = { status: "failed", error: "Ce post n’existe plus chez le service de publication." };
      else report.unreachable++; // panne ou limite : ce n'est pas la faute du post, on réessaiera
    } else if (res.state === "sent") {
      update = { status: "sent", sentAt: res.sentAt ?? now, link: res.link };
    } else if (res.state === "error") {
      update = { status: "failed", error: (res.error ?? "Le réseau a refusé la publication.").slice(0, 300) };
    } else if (res.state === "scheduled" || res.state === "sending") {
      // En attente ou en cours d'envoi : normal juste après l'heure prévue. Passé plusieurs heures, ce n'est plus normal.
      const lateBy = row.dueAt ? now.getTime() - row.dueAt.getTime() : 0;
      if (lateBy > STUCK_AFTER_HOURS * 3_600_000) update = { status: "failed", error: `Toujours en attente chez le service plus de ${STUCK_AFTER_HOURS} h après l’heure prévue.` };
    } else {
      // brouillon, en attente d'approbation, état inconnu : le service n'a PAS programmé ce post tel quel. Jamais pris pour une réussite.
      update = { status: "failed", error: `Le service a mis ce post en « ${res.state} » au lieu de le publier.` };
    }
    if (!update) continue;
    // « status = scheduled » dans la condition : si quelqu'un l'a annulé entre-temps, on n'écrase rien
    const changed = await db.update(postDeliveries).set(update).where(and(eq(postDeliveries.id, row.id), eq(postDeliveries.status, "scheduled"))).returning({ id: postDeliveries.id });
    if (changed.length > 0) {
      if (update.status === "sent") report.sent++;
      else report.failed++;
    }
  }
}

// Un post « programmé » dont tous les envois ont une issue devient « publié » (tous partis) ou « en échec » (au moins un échec).
// Écrit en SQL, en une instruction : le résultat ne dépend pas de l'ordre dans lequel les envois ont été traités.
async function settlePosts(report: SyncReport): Promise<void> {
  const rows = await db.execute(sql`
    update posts p set status = (case when not exists (select 1 from post_deliveries d where d.post_id = p.id and d.status <> 'sent') then 'published' else 'failed' end)::post_status
    where p.status = 'scheduled'
      and exists (select 1 from post_deliveries d where d.post_id = p.id)
      and not exists (select 1 from post_deliveries d where d.post_id = p.id and d.status = 'scheduled')
    returning p.status`);
  for (const r of rows) {
    if (r.status === "published") report.postsPublished++;
    else report.postsFailed++;
  }
}

// Les posts « programmés » qui n'ont AUCUN envoi : une panne est survenue entre la sauvegarde et l'envoi. On les renvoie si leur date
// est encore devant nous ; sinon, ou si le service refuse, on les marque « en échec » pour que la personne le voie (un post qui se
// croit programmé et ne partira jamais est le pire des états).
async function rescueUnsentPosts(pub: Publisher, now: Date, report: SyncReport): Promise<void> {
  const cutoff = new Date(now.getTime() - GRACE_MINUTES * 60_000);
  const lost = await db.execute(sql`
    select p.id, p.project_id, p.scheduled_at, pr.user_id
    from posts p join projects pr on pr.id = p.project_id
    where p.status = 'scheduled' and p.updated_at < ${cutoff.toISOString()}::timestamptz
      and not exists (select 1 from post_deliveries d where d.post_id = p.id)
    order by p.scheduled_at limit 20`);
  for (const row of lost) {
    const postId = row.id as string;
    const projectId = row.project_id as string;
    const at = row.scheduled_at ? new Date(row.scheduled_at as string | Date) : null;
    let sent = false;
    if (at && at.getTime() > now.getTime() + MIN_LEAD_MS) sent = (await sendScheduledPost(row.user_id as string, projectId, postId, pub)).ok;
    if (sent) {
      report.resent++;
      continue;
    }
    await db.update(posts).set({ status: "failed" }).where(and(eq(posts.id, postId), eq(posts.projectId, projectId), eq(posts.status, "scheduled")));
    report.postsFailed++;
  }
}

// Les envois restés « programmés » chez le service pour un post qui n'est plus programmé (retour en arrière dont l'annulation avait
// échoué, par exemple) : ils PUBLIERAIENT quelque chose que la personne a retiré. On les annule.
async function cancelOrphans(pub: Publisher, now: Date, report: SyncReport): Promise<void> {
  const cutoff = new Date(now.getTime() - GRACE_MINUTES * 60_000);
  const orphans = await db
    .select({ id: postDeliveries.id, externalId: postDeliveries.externalId })
    .from(postDeliveries)
    .innerJoin(posts, eq(posts.id, postDeliveries.postId))
    .where(and(eq(postDeliveries.status, "scheduled"), sql`${posts.status} <> 'scheduled'`, sql`${postDeliveries.createdAt} < ${cutoff.toISOString()}::timestamptz`))
    .limit(20);
  for (const row of orphans) {
    const res = await pub.cancel(row.externalId);
    if (!res.ok) continue; // on réessaiera au prochain passage
    await db.delete(postDeliveries).where(eq(postDeliveries.id, row.id));
    report.orphansCancelled++;
  }
}

export async function syncDeliveries(pub: Publisher = defaultPublisher, now: Date = new Date(), limit = 50): Promise<SyncReport> {
  const report = emptyReport();
  await syncDueDeliveries(pub, now, limit, report);
  await settlePosts(report);
  await rescueUnsentPosts(pub, now, report);
  await cancelOrphans(pub, now, report);
  return report;
}
