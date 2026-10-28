import Link from "next/link";

import { StatusDot } from "@/components/agents/status-dot";
import { type Agent, type AgentStatus, STATUS_LABEL } from "@/lib/agents";
import { cn } from "@/lib/utils";

// La colonne de l'équipe : les agents, leur rôle et leur état en une ligne. L'agent ouvert est encadré (encre) avec une
// barre jaune « signal » ; il est aussi marqué aria-current, donc jamais signalé par la couleur seule.
// Chaque agent est un lien vers ?agent=… : l'adresse se partage et le bouton « retour » du navigateur fonctionne.
export function AgentRoster({ agents, current, projectId, statuses = {} }: { agents: readonly Agent[]; current: Agent; projectId: string; statuses?: Partial<Record<Agent["id"], AgentStatus>> }) {
  return (
    <nav aria-label="Équipe d’agents">
      <ul className="grid grid-cols-2 gap-2 @2xl:grid-cols-1">
        {agents.map((agent) => {
          const active = agent.id === current.id;
          const status = statuses[agent.id] ?? "idle";
          return (
            <li key={agent.id}>
              <Link
                href={`/dashboard/${projectId}/agents?agent=${agent.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col gap-0.5 overflow-hidden rounded-lg border p-3 pl-4 transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                  active ? "border-foreground bg-card" : "border-border hover:bg-card",
                )}
              >
                {active && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-signal" />}
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <StatusDot status={status} />
                  {agent.name}
                </span>
                <span className="font-mono text-[12px] text-muted-foreground">{STATUS_LABEL[status]}</span>
                <span className="hidden text-[13px] text-muted-foreground @2xl:block">{agent.role}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
