import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getMyCampaigns } from "@/lib/dal";
import { LAST_CAMPAIGN_COOKIE } from "@/lib/last-campaign";

export const metadata: Metadata = { title: "Socialix" };

// /dashboard n'affiche rien lui-même : il envoie vers le bon endroit (PAGES.md, fiche 1).
// Sans campagne, vers le formulaire de création ; sinon vers la vue d'ensemble de la campagne ouverte en dernier.
export default function DashboardPage() {
  // Lire la session et les cookies se fait à chaque requête : derrière un <Suspense> (Cache Components).
  return (
    <Suspense fallback={<RedirectSkeleton />}>
      <GoToCampaign />
    </Suspense>
  );
}

// Promise<never> : cette fonction se termine toujours par une redirection, elle ne renvoie jamais rien à afficher.
async function GoToCampaign(): Promise<never> {
  const campaigns = await getMyCampaigns(); // vérifie aussi la session ; la plus récente d'abord
  if (campaigns.length === 0) redirect("/campaigns/new");

  // Le cookie n'est qu'une préférence : on le compare aux campagnes de l'utilisateur connecté.
  // Absent, périmé, falsifié ou venant d'un autre compte, il est ignoré et on prend la plus récente.
  const remembered = (await cookies()).get(LAST_CAMPAIGN_COOKIE)?.value;
  const target = campaigns.find((campaign) => campaign.id === remembered) ?? campaigns[0];

  redirect(`/dashboard/${target.id}/overview`);
}

function RedirectSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10 sm:px-10">
      <div role="status" aria-label="Chargement" className="h-8 w-56 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
    </main>
  );
}
