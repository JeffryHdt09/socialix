"use client";

import { Tabs } from "radix-ui";

import { AgentChat } from "@/components/agents/agent-chat";
import type { Agent } from "@/lib/agents";
import type { ChatMessage } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

// Les quatre onglets de l'agent ouvert (PAGES.md, fiche 5). Radix donne le clavier de la norme ARIA : flèches gauche/droite
// pour passer d'un onglet à l'autre, Tab pour entrer dans le contenu. Les onglets sans données réelles affichent un état
// vide honnête (pas de fausse liste), avec le chapitre où le contenu arrive.
const TABS = [
  { value: "discussion", label: "Discussion" },
  { value: "taches", label: "Tâches" },
  { value: "historique", label: "Historique" },
  { value: "reglages", label: "Réglages" },
] as const;

const PANEL = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-5 text-[15px] text-muted-foreground">{children}</p>;
}

export function AgentTabs({ agent, campaignId, initialMessages }: { agent: Agent; campaignId: string; initialMessages: ChatMessage[] }) {
  return (
    <Tabs.Root defaultValue="discussion" className="flex min-w-0 flex-col gap-5">
      <Tabs.List aria-label={`Onglets de ${agent.name}`} className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <Tabs.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "-mb-px min-h-11 border-b-2 border-transparent px-3 text-[15px] text-muted-foreground transition-colors duration-150",
              "hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-foreground",
              "data-[state=active]:border-foreground data-[state=active]:font-semibold data-[state=active]:text-foreground",
            )}
          >
            {t.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* forceMount : la discussion reste en mémoire quand on change d'onglet (sinon elle repartirait de la liste du serveur et
          perdrait ce qu'on vient d'écrire) ; `hidden` la masque tant qu'elle n'est pas l'onglet courant. */}
      <Tabs.Content value="discussion" forceMount className={cn(PANEL, "data-[state=inactive]:hidden")}>
        <AgentChat agent={agent} campaignId={campaignId} initialMessages={initialMessages} />
      </Tabs.Content>
      <Tabs.Content value="taches" className={PANEL}>
        <Empty>Aucune tâche pour l’instant. Les tâches que le Maître répartit à {agent.name} apparaîtront ici, avec leur état (chapitres 10 et 11).</Empty>
      </Tabs.Content>
      <Tabs.Content value="historique" className={PANEL}>
        <Empty>Aucun historique pour l’instant. Ce que {agent.name} aura fait sera daté et listé ici.</Empty>
      </Tabs.Content>
      <Tabs.Content value="reglages" className={cn("flex flex-col gap-4", PANEL)}>
        <div>
          <h2 className="text-[13px] font-medium text-muted-foreground">Rôle de {agent.name}</h2>
          <p className="mt-1 text-[15px]">{agent.role}.</p>
        </div>
        <Empty>Les instructions de {agent.name} et son activation seront modifiables ici au chapitre 9. Pour l’instant, rien à régler.</Empty>
      </Tabs.Content>
    </Tabs.Root>
  );
}
