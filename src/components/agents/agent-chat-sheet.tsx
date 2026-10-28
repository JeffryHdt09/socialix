"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { AgentChat } from "@/components/agents/agent-chat";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { Agent } from "@/lib/agents";
import type { ChatMessage } from "@/lib/chat-types";
import type { PlanView } from "@/lib/plan-types";

// Le panneau de chat à gauche, ouvert depuis le bureau de la vue d'ensemble (PAGES.md, fiche 4). Son état vit dans
// l'adresse (?chat=agent) : le panneau survit à un rechargement, se partage, et le serveur n'a rien à deviner.
// Radix gère le reste : focus piégé dans le panneau, Échap pour fermer, page derrière rendue inerte.
type Props = { agent: Agent | undefined; projectId: string; initialMessages: ChatMessage[]; initialPlans: PlanView[] };

export function AgentChatSheet({ agent, projectId, initialMessages, initialPlans }: Props) {
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
          <SheetChat key={agent.id} agent={agent} projectId={projectId} initialMessages={initialMessages} initialPlans={initialPlans} />
        </SheetContent>
      )}
    </Sheet>
  );
}

// Le contenu du panneau, avec ses plans en mémoire. Un composant à part, démonté à la fermeture : à chaque ouverture, il
// repart des plans fraîchement lus par le serveur (sinon l'état de la visite précédente resterait affiché).
function SheetChat({ agent, projectId, initialMessages, initialPlans }: { agent: Agent; projectId: string; initialMessages: ChatMessage[]; initialPlans: PlanView[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const upsert = (plan: PlanView) => setPlans((all) => (all.some((p) => p.id === plan.id) ? all.map((p) => (p.id === plan.id ? plan : p)) : [plan, ...all]));
  return <AgentChat agent={agent} projectId={projectId} initialMessages={initialMessages} plans={plans} onPlanChange={upsert} className="mt-8 min-h-0 flex-1" />;
}
