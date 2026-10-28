"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition } from "react";

import { selectProject } from "@/app/dashboard/actions";
import { ProjectAvatar } from "@/components/project/project-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import type { ProjectIconKey } from "@/lib/project-rules";

// Ce que le serveur transmet pour chaque projet : de quoi dessiner son médaillon, rien d'autre.
export type ProjectOption = { id: string; name: string; iconKey: ProjectIconKey | null; imageUrl: string | null };

// Sélecteur de projet, en haut du menu : le projet courant, la liste des autres, et « Nouveau projet ».
export function ProjectSwitcher({ projects, currentId }: { projects: ProjectOption[]; currentId: string }) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const current = projects.find((c) => c.id === currentId) ?? projects[0];
  // /dashboard/<id>/<section> : on garde la section en changeant de projet
  const section = pathname.split("/")[3] ?? "overview";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={current.name} className="rounded-lg group-data-[collapsible=icon]:justify-center">
              <ProjectAvatar name={current.name} iconKey={current.iconKey} imageUrl={current.imageUrl} className="size-8 rounded-md text-sm" />
              {/* Replié, le nom est caché À L'ŒIL (sinon un bout dépasse à côté du médaillon) mais gardé pour les lecteurs
                  d'écran : « hidden » le retirerait aussi d'eux, et le bouton n'aurait plus aucun nom accessible. */}
              <span className="min-w-0 flex-1 truncate font-semibold group-data-[collapsible=icon]:sr-only">{current.name}</span>
              <ChevronsUpDown className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={isMobile ? "bottom" : "right"} className="min-w-64">
            <DropdownMenuLabel className="text-[13px] font-medium text-muted-foreground">Tes projets</DropdownMenuLabel>
            {projects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                aria-current={project.id === currentId ? "true" : undefined}
                // Choisir le projet déjà ouvert ne fait rien ; sinon l'action serveur mémorise puis redirige.
                onSelect={() => project.id !== currentId && startTransition(() => selectProject(project.id, section))}
              >
                <ProjectAvatar name={project.name} iconKey={project.iconKey} imageUrl={project.imageUrl} className="size-7 rounded-md text-[13px]" />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.id === currentId && <Check className="text-foreground" aria-label="Projet ouvert" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/projects/new">
                <Plus aria-hidden="true" />
                Nouveau projet
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
