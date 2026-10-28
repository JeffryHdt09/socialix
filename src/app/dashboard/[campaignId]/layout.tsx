import { Suspense } from "react";

import { requireMyCampaign } from "@/lib/dal";

// Cadre commun des pages d'une campagne (PAGES.md, fiche 3). Le menu latéral et l'en-tête arrivent aux
// étapes 6.3 et 6.4 ; pour l'instant, ce layout fait le plus important : vérifier que la campagne existe
// ET appartient à l'utilisateur connecté, avant de laisser s'afficher la moindre page.
export default function CampaignLayout({ children, params }: LayoutProps<"/dashboard/[campaignId]">) {
  // Lire params et la session se fait à chaque requête : derrière un <Suspense> (Cache Components).
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <CampaignShell params={params}>{children}</CampaignShell>
    </Suspense>
  );
}

async function CampaignShell({ children, params }: { children: React.ReactNode; params: LayoutProps<"/dashboard/[campaignId]">["params"] }) {
  const { campaignId } = await params;
  // Introuvable, pas à soi, ou identifiant qui n'est pas un UUID : le même écran « introuvable » dans les
  // trois cas (voir getMyCampaign). Rien des pages enfants n'est affiché avant ce contrôle.
  await requireMyCampaign(campaignId);

  return <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-10">{children}</div>;
}

function ShellSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="mx-auto flex w-full max-w-5xl animate-pulse flex-col gap-4 px-4 py-8 motion-reduce:animate-none sm:px-10">
      <div className="h-8 w-56 rounded-md bg-muted" />
      <div className="h-4 w-80 rounded-md bg-muted" />
      <div className="h-40 rounded-xl bg-muted" />
    </div>
  );
}
