import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { posts } from "@/db/schema";
import { APP_TIMEZONE } from "@/lib/dates";

// Les calculs de la vue d'ensemble d'un projet (PAGES.md, fiche 4). Toutes les dates sont stockées en UTC ;
// « aujourd'hui » et le découpage en jours se font dans le fuseau de l'utilisateur (PLAN.md : Europe/Paris par
// défaut). Sans cela, un post programmé à 00 h 30 heure de Paris tomberait la veille, puisqu'il est 23 h 30 en UTC.
export const OVERVIEW_TIMEZONE = APP_TIMEZONE;

export type OverviewDay = {
  day: string; // « 2026-11-02 », jour civil dans le fuseau ci-dessus
  scheduled: number; // posts programmés ce jour-là
  unconfirmed: number; // brouillons et posts à valider datés ce jour-là : pas encore confirmés, donc hachurés
};
export type ReviewItem = { id: string; title: string; platforms: string[]; scheduledAt: Date | null; imageUrl: string | null };
export type Overview = {
  // Tous les posts du projet, tous statuts confondus : distingue « projet vide » de « rien à relire ».
  totalPosts: number;
  scheduledNext7Days: number;
  strip: OverviewDay[]; // toujours 7 jours, aujourd'hui compris, même sans aucun post
  toReviewCount: number;
  published30Days: number;
  toReview: ReviewItem[]; // les 5 premiers à relire
};

// ATTENTION : cette fonction ne vérifie PAS que le projet appartient à l'utilisateur connecté. Elle ne doit être
// appelée que par getOverview (src/lib/dal.ts), qui le vérifie avant. « now » est un paramètre pour pouvoir tester
// avec une date fixe.
export async function queryOverviewUnchecked(projectId: string, now: Date = new Date()): Promise<Overview> {
  const nowIso = now.toISOString();
  const tz = OVERVIEW_TIMEZONE;

  const [stripRows, countRows, toReview] = await Promise.all([
    // Les 7 jours qui commencent aujourd'hui. generate_series produit un jour même s'il est vide, d'où le left join :
    // la bande a toujours 7 cases.
    db.execute(sql`
      select d::date::text as day,
             count(p.id) filter (where p.status = 'scheduled')::int as scheduled,
             count(p.id) filter (where p.status in ('draft', 'to_review'))::int as unconfirmed
      from generate_series(
             (${nowIso}::timestamptz at time zone ${tz})::date,
             (${nowIso}::timestamptz at time zone ${tz})::date + 6,
             interval '1 day') as d
      left join posts p
        on p.project_id = ${projectId}::uuid
       and p.status in ('scheduled', 'draft', 'to_review')
       and (p.scheduled_at at time zone ${tz})::date = d::date
      group by d
      order by d`),
    db.execute(sql`
      select count(*)::int as total,
             count(*) filter (where status = 'to_review')::int as to_review,
             count(*) filter (where status = 'published'
                                and scheduled_at >= ${nowIso}::timestamptz - interval '30 days'
                                and scheduled_at <= ${nowIso}::timestamptz)::int as published_30
      from posts
      where project_id = ${projectId}::uuid`),
    db
      .select({ id: posts.id, title: posts.title, platforms: posts.platforms, scheduledAt: posts.scheduledAt, imageUrl: posts.imageUrl })
      .from(posts)
      .where(and(eq(posts.projectId, projectId), eq(posts.status, "to_review")))
      // Les plus proches d'abord ; ceux sans date à la fin
      .orderBy(sql`${posts.scheduledAt} asc nulls last`, asc(posts.createdAt))
      .limit(5),
  ]);

  const strip = (stripRows as unknown as OverviewDay[]).map((r) => ({ day: r.day, scheduled: Number(r.scheduled), unconfirmed: Number(r.unconfirmed) }));
  const counts = (countRows as unknown as { total: number; to_review: number; published_30: number }[])[0];
  return {
    totalPosts: Number(counts.total),
    scheduledNext7Days: strip.reduce((total, d) => total + d.scheduled, 0),
    strip,
    toReviewCount: Number(counts.to_review),
    published30Days: Number(counts.published_30),
    toReview,
  };
}
