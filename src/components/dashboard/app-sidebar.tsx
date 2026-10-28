"use client";

import Link from "next/link";

import { CampaignSwitcher, type CampaignOption } from "@/components/dashboard/campaign-switcher";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SidebarProfile } from "@/components/dashboard/sidebar-profile";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";

// Le menu latéral d'une campagne (PAGES.md, fiche 3) : logo et sélecteur en haut, les sept sections,
// puis l'état de l'équipe et le profil en bas. Replié en icônes par défaut ; le choix est mémorisé.
export function AppSidebar({
  campaigns,
  currentId,
  user,
}: {
  campaigns: CampaignOption[];
  currentId: string;
  user: { name: string; email: string };
}) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-3">
        {/* Replié, le logo disparaît : le médaillon du sélecteur, juste dessous, suffit. */}
        <Link href="/dashboard" className="inline-flex min-h-11 items-center px-3 text-xl font-extrabold tracking-tight group-data-[collapsible=icon]:hidden">
          Socialix
        </Link>
        <CampaignSwitcher campaigns={campaigns} currentId={currentId} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarNav campaignId={currentId} />
      </SidebarContent>

      <SidebarFooter className="gap-3">
        {/* Aucun agent ne travaille pour l'instant (chapitres 8 à 12) : l'état est « au repos », dit en toutes
            lettres, avec la pastille grise de la charte (le jaune est réservé à « en cours » / « à valider »). */}
        <div className="rounded-lg border border-sidebar-border p-3 group-data-[collapsible=icon]:hidden">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <span aria-hidden="true" className="size-2 rounded-full bg-inactive" />
            Équipe IA
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">Tes agents sont au repos.</p>
        </div>
        <SidebarProfile user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
