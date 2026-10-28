import { cookies } from "next/headers";
import { Suspense } from "react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { avatarPropsFor } from "@/lib/campaign-avatar-props";
import { getMyCampaigns, requireMyCampaign, verifySession } from "@/lib/dal";

// Cadre commun des pages d'une campagne (PAGES.md, fiche 3) : menu latéral à gauche, pages à droite.
// Avant d'afficher quoi que ce soit, il vérifie que la campagne existe ET appartient à l'utilisateur connecté.
export default function CampaignLayout({ children, params }: LayoutProps<"/dashboard/[campaignId]">) {
  // Lire params, la session et les cookies se fait à chaque requête : derrière un <Suspense> (Cache Components).
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
  const campaign = await requireMyCampaign(campaignId);
  const { user } = await verifySession();
  const campaigns = await getMyCampaigns();

  // Menu replié par défaut (PAGES.md). Le composant mémorise le choix dans le cookie « sidebar_state » ;
  // on le relit ici pour que le serveur dessine directement le bon état, sans éclair au chargement.
  const open = (await cookies()).get("sidebar_state")?.value === "true";

  return (
    // TooltipProvider : les info-bulles du menu replié (la barre latérale de shadcn ne le fournit pas).
    <TooltipProvider delayDuration={0}>
      {/* Lien d'évitement : invisible, il apparaît au premier appui sur Tab. Sans lui, un utilisateur du clavier
          traverse tout le menu (une douzaine d'arrêts) à chaque page avant d'atteindre le contenu. */}
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-[15px] focus:font-semibold focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <SidebarProvider defaultOpen={open}>
        <AppSidebar
          // Le médaillon est calculé ici, côté serveur (l'adresse du logo vient du module de stockage) :
          // le navigateur ne reçoit que des données simples.
          campaigns={campaigns.map((c) => ({ id: c.id, ...avatarPropsFor(c) }))}
          currentId={campaign.id}
          user={{ name: user.name, email: user.email }}
        />
        <SidebarInset>
          <div className="flex h-14 shrink-0 items-center px-4 sm:px-6">
            {/* max-md:size-11 : 44 px sur écran étroit (zone cliquable de la charte), sans dépendre de la détection tactile */}
            <SidebarTrigger className="max-md:size-11" />
          </div>
          {/* id + tabIndex=-1 : cible du lien d'évitement (reçoit le focus sans devenir un arrêt de Tab) */}
          <div id="contenu" tabIndex={-1} className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pb-10 outline-none sm:px-10">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function ShellSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="flex min-h-svh animate-pulse motion-reduce:animate-none">
      <div className="hidden w-16 shrink-0 border-r border-border bg-sidebar md:block" />
      <div className="flex flex-1 flex-col gap-4 p-8">
        <div className="h-8 w-56 rounded-md bg-muted" />
        <div className="h-4 w-80 rounded-md bg-muted" />
        <div className="h-40 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
