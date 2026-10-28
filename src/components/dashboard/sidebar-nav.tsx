"use client";

import { Bot, CalendarDays, ChartColumn, FileText, LayoutDashboard, type LucideIcon, Settings, Share2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SidebarGroup, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { CAMPAIGN_SECTIONS, type SectionSlug } from "@/lib/campaign-sections";

// Une icône par section. Record<SectionSlug, …> : TypeScript refuse de compiler si on ajoute une section au menu
// sans lui donner son icône.
const ICONS: Record<SectionSlug, LucideIcon> = {
  overview: LayoutDashboard,
  agents: Bot,
  posts: FileText,
  calendar: CalendarDays,
  analytics: ChartColumn,
  accounts: Share2,
  settings: Settings,
};

// Les liens du menu. Pas de compteur (« 1 actif », « 3 à valider ») tant qu'il n'y a ni agent ni post : un faux
// « 0 » serait un faux contenu (DESIGN.md). Ils arriveront avec les chapitres concernés.
export function SidebarNav({ campaignId }: { campaignId: string }) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {CAMPAIGN_SECTIONS.map(({ slug, label }) => {
          const href = `/dashboard/${campaignId}/${slug}`;
          const active = pathname === href;
          const Icon = ICONS[slug];
          return (
            <SidebarMenuItem key={slug}>
              {/* tooltip : le libellé apparaît au survol quand le menu est replié (icônes seules) */}
              <SidebarMenuButton asChild isActive={active} tooltip={label}>
                {/* sur téléphone, choisir une page referme le tiroir */}
                <Link href={href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
