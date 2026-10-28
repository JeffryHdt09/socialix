import type { AgentStatus } from "@/lib/agents";
import { cn } from "@/lib/utils";

// Pastille d'état (DESIGN.md) : gris = au repos, jaune « signal » qui respire = en cours, vert = terminé, rouge = bloqué.
// La couleur n'est jamais seule : le texte de l'état est toujours donné à côté (STATUS_LABEL).
export const DOT: Record<AgentStatus, string> = {
  idle: "bg-inactive",
  working: "bg-signal motion-safe:animate-pulse",
  done: "bg-success",
  blocked: "bg-destructive",
};

export function StatusDot({ status, className }: { status: AgentStatus; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", DOT[status], className)} />;
}
