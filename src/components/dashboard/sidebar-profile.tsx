"use client";

import { ChevronsUpDown, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";

import { signOutAction } from "@/app/dashboard/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

// Le profil, en bas du menu : nom, choix du thème Jour / Nuit / Système, et déconnexion (PAGES.md, fiche 3).
export function SidebarProfile({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = (Array.from(user.name.trim())[0] ?? "?").toUpperCase();

  async function handleSignOut() {
    setFailed(false);
    setPending(true);
    try {
      // Action serveur : supprime la session en base, puis efface le cookie (voir actions.ts).
      const { ok } = await signOutAction();
      if (!ok) throw new Error("session non supprimée");
    } catch {
      // On ne redirige qu'après un succès réel : sinon /sign-in retrouverait la session encore active
      // et renverrait ici, alors que l'utilisateur croit être déconnecté.
      setFailed(true);
      setPending(false);
      return;
    }
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={user.name} className="rounded-lg group-data-[collapsible=icon]:justify-center">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-muted text-sm font-bold">
                {initial}
              </span>
              {/* masqué quand le menu est replié : seul l'initiale reste, centrée */}
              <span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate font-mono text-[12px] font-normal text-muted-foreground">{user.email}</span>
              </span>
              <ChevronsUpDown className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={isMobile ? "top" : "right"} className="min-w-60">
            <DropdownMenuLabel className="text-[13px] font-medium text-muted-foreground">Thème</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun aria-hidden="true" />
                Jour
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon aria-hidden="true" />
                Nuit
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor aria-hidden="true" />
                Système
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            {/* preventDefault : le menu reste ouvert pendant la déconnexion, et si elle échoue le message est visible ici */}
            <DropdownMenuItem
              disabled={pending}
              onSelect={(event) => {
                event.preventDefault();
                void handleSignOut();
              }}
            >
              <LogOut aria-hidden="true" />
              {pending ? "Déconnexion…" : "Se déconnecter"}
            </DropdownMenuItem>
            {failed && (
              <p role="alert" className="px-2.5 py-1.5 text-[13px] font-medium text-destructive">
                La déconnexion a échoué, réessaie.
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
