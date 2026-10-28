import type { Metadata } from "next";
import { Suspense } from "react";

import { AgentRoster } from "@/components/agents/agent-roster";
import { AgentTabs } from "@/components/agents/agent-tabs";
import { LiveLog } from "@/components/agents/live-log";
import { PageHeader } from "@/components/dashboard/page-header";
import { AGENTS, findAgent } from "@/lib/agents";
import { getConversation } from "@/lib/dal";

export const metadata: Metadata = { title: "Agents IA · Socialix" };

// Page Agents (PAGES.md, fiche 5) : l'équipe à gauche, l'agent ouvert au centre, le journal à droite.
// Le chat est branché à Gemini (chapitre 9) ; Tâches, Historique, Réglages et le journal restent honnêtement vides.
export default function AgentsPage({ params, searchParams }: PageProps<"/dashboard/[campaignId]/agents">) {
  return (
    <>
      <PageHeader title="Agents IA" subtitle="Ton équipe d’agents et ses conversations." />
      {/* L'agent ouvert vient de l'adresse (?agent=) : lecture de searchParams, donc derrière un <Suspense> (Cache Components) */}
      <Suspense fallback={<AgentsSkeleton />}>
        <AgentsContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AgentsContent({ params, searchParams }: Pick<PageProps<"/dashboard/[campaignId]/agents">, "params" | "searchParams">) {
  const { campaignId } = await params;
  const { agent: wanted } = await searchParams;
  // Un identifiant inconnu (ou répété : ?agent=a&agent=b) n'est pas une erreur : on ouvre le Maître
  const current = findAgent(wanted) ?? AGENTS[0];
  // La conversation vient de la base ; getConversation vérifie que la campagne est bien à l'utilisateur
  const conversation = await getConversation(campaignId, current.id);

  return (
    // @container : les colonnes dépendent de la largeur de la zone (menu latéral ouvert ou replié), pas de l'écran
    <div className="@container">
      <div className="grid gap-6 @2xl:grid-cols-[200px_minmax(0,1fr)] @4xl:grid-cols-[200px_minmax(0,1fr)_220px]">
        <AgentRoster current={current} campaignId={campaignId} />
        {/* key : changer d'agent repart sur l'onglet Discussion, sans garder l'état de l'agent précédent */}
        <AgentTabs key={current.id} agent={current} campaignId={campaignId} initialMessages={conversation} />
        <div className="@2xl:col-span-2 @4xl:col-span-1">
          <LiveLog />
        </div>
      </div>
    </div>
  );
}

function AgentsSkeleton() {
  return (
    <div role="status" aria-label="Chargement des agents" className="grid animate-pulse gap-6 motion-reduce:animate-none @2xl:grid-cols-[200px_1fr]">
      <div className="h-64 rounded-xl bg-muted" />
      <div className="h-96 rounded-xl bg-muted" />
    </div>
  );
}
