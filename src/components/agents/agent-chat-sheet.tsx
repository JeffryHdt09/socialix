"use client";

import { usePathname, useRouter } from "next/navigation";

import { AgentChat } from "@/components/agents/agent-chat";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Agent } from "@/lib/agents";
import type { ChatMessage } from "@/lib/chat-types";

// Le panneau de chat à gauche, ouvert depuis le bureau de la vue d'ensemble (PAGES.md, fiche 4). Son état vit dans
// l'adresse (?chat=agent) : le panneau survit à un rechargement, se partage, et le serveur n'a rien à deviner.
// Radix gère le reste : focus piégé dans le panneau, Échap pour fermer, page derrière rendue inerte.
export function AgentChatSheet({ agent, campaignId, initialMessages }: { agent: Agent | undefined; campaignId: string; initialMessages: ChatMessage[] }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Sheet
      open={agent !== undefined}
      onOpenChange={(open) => {
        // On enlève ?chat= de l'adresse sans empiler d'historique ni remonter la page
        if (!open) router.replace(pathname, { scroll: false });
      }}
    >
      {agent && (
        <SheetContent
          side="left"
          className="gap-0 p-5 data-[side=left]:sm:max-w-md"
          onOpenAutoFocus={(event) => {
            // À l'ouverture, le curseur va directement dans la zone de saisie (et non sur « Fermer ») : on vient pour écrire
            event.preventDefault();
            (event.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-chat-input]")?.focus();
          }}
          onCloseAutoFocus={(event) => {
            // Rendre le focus au lien de l'agent qu'on vient de quitter (il n'y a pas de bouton « déclencheur » Radix).
            // Deux liens existent (étiquette ou liste, selon la largeur) : on prend celui qui est affiché.
            event.preventDefault();
            const links = document.querySelectorAll<HTMLElement>(`[data-agent-link="${agent.id}"]`);
            Array.from(links).find((el) => el.offsetParent !== null)?.focus();
          }}
        >
          <SheetTitle className="sr-only">Discussion avec {agent.name}</SheetTitle>
          <SheetDescription className="sr-only">Panneau de discussion avec l’agent {agent.name}. Appuie sur Échap pour le fermer.</SheetDescription>
          <AgentChat key={agent.id} agent={agent} campaignId={campaignId} initialMessages={initialMessages} className="mt-8 min-h-0 flex-1" />
        </SheetContent>
      )}
    </Sheet>
  );
}
