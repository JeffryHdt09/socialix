"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition } from "react";

import { selectCampaign } from "@/app/dashboard/actions";
import { CampaignAvatar } from "@/components/campaign/campaign-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { CampaignIconKey } from "@/lib/campaign-rules";

// Ce que le serveur transmet pour chaque campagne : de quoi dessiner son médaillon, rien d'autre.
export type CampaignOption = { id: string; name: string; iconKey: CampaignIconKey | null; imageUrl: string | null };

// Sélecteur de campagne, en haut du menu : la campagne courante, la liste des autres, et « Nouvelle campagne ».
export function CampaignSwitcher({ campaigns, currentId }: { campaigns: CampaignOption[]; currentId: string }) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const current = campaigns.find((c) => c.id === currentId) ?? campaigns[0];
  // /dashboard/<id>/<section> : on garde la section en changeant de campagne
  const section = pathname.split("/")[3] ?? "overview";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={current.name} className="rounded-lg group-data-[collapsible=icon]:justify-center">
              <CampaignAvatar name={current.name} iconKey={current.iconKey} imageUrl={current.imageUrl} className="size-8 rounded-md text-sm" />
              {/* Replié, le nom est caché À L'ŒIL (sinon un bout dépasse à côté du médaillon) mais gardé pour les lecteurs
                  d'écran : « hidden » le retirerait aussi d'eux, et le bouton n'aurait plus aucun nom accessible. */}
              <span className="min-w-0 flex-1 truncate font-semibold group-data-[collapsible=icon]:sr-only">{current.name}</span>
              <ChevronsUpDown className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={isMobile ? "bottom" : "right"} className="min-w-64">
            <DropdownMenuLabel className="text-[13px] font-medium text-muted-foreground">Tes campagnes</DropdownMenuLabel>
            {campaigns.map((campaign) => (
              <DropdownMenuItem
                key={campaign.id}
                aria-current={campaign.id === currentId ? "true" : undefined}
                // Choisir la campagne déjà ouverte ne fait rien ; sinon l'action serveur mémorise puis redirige.
                onSelect={() => campaign.id !== currentId && startTransition(() => selectCampaign(campaign.id, section))}
              >
                <CampaignAvatar name={campaign.name} iconKey={campaign.iconKey} imageUrl={campaign.imageUrl} className="size-7 rounded-md text-[13px]" />
                <span className="min-w-0 flex-1 truncate">{campaign.name}</span>
                {campaign.id === currentId && <Check className="text-foreground" aria-label="Campagne ouverte" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/campaigns/new">
                <Plus aria-hidden="true" />
                Nouvelle campagne
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
