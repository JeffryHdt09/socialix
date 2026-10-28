import type { Metadata } from "next";
import { Suspense } from "react";

import { PublishedCard, ReviewCard, ScheduledCard } from "@/components/dashboard/overview-cards";
import { ActivityList, EmptyBanner, ReviewList } from "@/components/dashboard/overview-lists";
import { PageHeader } from "@/components/dashboard/page-header";
import { OfficeScene } from "@/components/office/office-scene";
import { getOverview } from "@/lib/dal";

export const metadata: Metadata = { title: "Vue d’ensemble · Socialix" };

// Vue d'ensemble d'une campagne (PAGES.md, fiche 4) : où en est la campagne, et ce qui attend une décision.
export default function OverviewPage({ params }: PageProps<"/dashboard/[campaignId]/overview">) {
  return (
    <>
      <PageHeader title="Vue d’ensemble" subtitle="Où en est la campagne et ce qui attend une décision." />
      {/* Les chiffres viennent de la base à chaque visite : derrière un <Suspense> (Cache Components), avec un squelette
          aux formes du contenu pendant le chargement (PAGES.md : pas de roue qui tourne au milieu de la page). */}
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent params={params} />
      </Suspense>
    </>
  );
}

async function OverviewContent({ params }: Pick<PageProps<"/dashboard/[campaignId]/overview">, "params">) {
  const { campaignId } = await params;
  // getOverview vérifie que la campagne appartient à l'utilisateur AVANT de lire le moindre post.
  const overview = await getOverview(campaignId);

  return (
    <>
      {overview.totalPosts === 0 && <EmptyBanner campaignId={campaignId} />}

      {/* Trois cartes de tailles différentes : la première occupe deux colonnes sur quatre */}
      <div className="grid gap-4 md:grid-cols-4">
        <ScheduledCard overview={overview} className="md:col-span-2" />
        <ReviewCard overview={overview} campaignId={campaignId} />
        <PublishedCard overview={overview} />
      </div>

      {/* Les listes à gauche, le bureau à droite. 4fr / 6fr, mesuré : le contenu fait au plus 944 px (max-w-5xl moins les marges),
          donc la colonne du bureau y fait 547 px, au-dessus des 512 px à partir desquels ses étiquettes s'affichent.
          Avec 5fr / 6fr, elle ne faisait que 497 px et les étiquettes disparaissaient sur un grand écran. */}
      <div className="grid gap-8 lg:grid-cols-[4fr_6fr]">
        <div className="flex min-w-0 flex-col gap-8">
          <ReviewList items={overview.toReview} campaignId={campaignId} />
          <ActivityList />
        </div>
        <section aria-labelledby="bureau-titre" className="min-w-0">
          <h2 id="bureau-titre" className="mb-3 text-[13px] font-medium text-muted-foreground">
            Ton équipe
          </h2>
          <OfficeScene theme="auto" />
        </section>
      </div>
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div role="status" aria-label="Chargement de la vue d’ensemble" className="flex animate-pulse flex-col gap-8 motion-reduce:animate-none">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="h-72 rounded-xl bg-muted md:col-span-2" />
        <div className="h-72 rounded-xl bg-muted" />
        <div className="h-72 rounded-xl bg-muted" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[4fr_6fr]">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-24 rounded-md bg-muted" />
          <div className="h-16 rounded-lg bg-muted" />
          <div className="h-16 rounded-lg bg-muted" />
        </div>
        <div className="aspect-[1376/768] rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
