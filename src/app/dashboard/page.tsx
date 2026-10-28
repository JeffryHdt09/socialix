import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CampaignAvatar } from "@/components/campaign/campaign-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { OFFICE_LABELS } from "@/lib/campaign-rules";
import { avatarPropsFor } from "@/lib/campaign-avatar-props";
import { getMyCampaigns, verifySession } from "@/lib/dal";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Tableau de bord · Socialix" };

// Page privée provisoire : le vrai tableau de bord (menu latéral, vue d'ensemble) arrive au chapitre 6.
// L'en-tête est statique et part tout de suite ; la liste dépend de la session, d'où le <Suspense>.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-10">
      <header className="flex items-center justify-between gap-4">
        <span className="text-xl font-extrabold tracking-tight">Socialix</span>
        <div className="flex items-start gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <Suspense fallback={<CampaignsSkeleton />}>
        <Campaigns />
      </Suspense>
    </main>
  );
}

// Dates affichées dans le fuseau de l'utilisateur (Europe/Paris par défaut, PLAN.md) ; la base les garde en UTC.
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" });

async function Campaigns() {
  // Contrôle de sécurité : sans session valide en base, redirection vers /sign-in.
  const { user } = await verifySession();
  const campaigns = await getMyCampaigns();

  // Aucune campagne : on ne montre pas un écran vide, on propose d'en créer une (PAGES.md, fiche 1).
  if (campaigns.length === 0) redirect("/campaigns/new");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Bonjour, {user.name}</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Connecté avec <span className="font-mono text-[13px]">{user.email}</span>
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">Nouvelle campagne</Link>
        </Button>
      </div>

      <div>
        <h2 className="text-[13px] font-medium text-muted-foreground">
          {campaigns.length === 1 ? "Ta campagne" : `Tes ${campaigns.length} campagnes`}
        </h2>
        <ul className="mt-3 flex flex-col gap-3">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
              <CampaignAvatar {...avatarPropsFor(campaign)} />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-semibold">{campaign.name}</p>
                <p className="text-[13px] text-muted-foreground">
                  {OFFICE_LABELS[campaign.office]} · <span className="font-mono">créée le {dateFormat.format(campaign.createdAt)}</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function CampaignsSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="flex animate-pulse flex-col gap-6 motion-reduce:animate-none">
      <div className="h-8 w-56 rounded-md bg-muted" />
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <div className="size-14 rounded-lg bg-muted" />
            <div className="flex flex-col gap-2">
              <div className="h-5 w-40 rounded-md bg-muted" />
              <div className="h-4 w-56 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
