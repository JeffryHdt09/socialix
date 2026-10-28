"use client";

import { useRef, useState } from "react";

import { cancelPlan } from "@/app/dashboard/chat-actions";
import { StatusDot } from "@/components/agents/status-dot";
import { Button } from "@/components/ui/button";
import { AGENTS, type AgentStatus } from "@/lib/agents";
import { formatPostDate } from "@/lib/dates";
import { PLAN_STATUS_LABEL, type PlanView, summarizeTasks, TASK_STATUS_LABEL, type TaskStatus } from "@/lib/plan-types";
import { cn } from "@/lib/utils";

// La carte d'un plan du Maître (PAGES.md, fiche 5) : tâches numérotées, agent, état en toutes lettres, « après 02 »,
// consigne dépliable, et « Annuler le plan ». Utilisée dans la conversation avec le Maître et dans l'onglet Tâches.
const DOT: Record<TaskStatus, AgentStatus> = { pending: "idle", running: "working", done: "done", failed: "blocked", cancelled: "idle" };
const agentName = (id: string) => AGENTS.find((a) => a.id === id)?.name ?? id;
const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  plan: PlanView;
  campaignId: string;
  onChange: (plan: PlanView) => void;
  // Si fourni : on n'affiche que les tâches de cet agent (onglet Tâches d'un agent de travail), sans le bouton d'annulation
  onlyAgent?: string;
};

export function PlanCard({ plan, campaignId, onChange, onlyAgent }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);

  const tasks = onlyAgent ? plan.tasks.filter((t) => t.agent === onlyAgent) : plan.tasks;
  const allPending = plan.tasks.every((t) => t.status === "pending");
  const titleId = `plan-${plan.id}`;

  async function confirmCancel() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await cancelPlan(campaignId, plan.id);
      if (result.ok) {
        onChange(result.plan);
        setConfirming(false);
        // Les boutons disparaissent : le focus va au titre de la carte, pour ne pas se perdre en haut de la page
        requestAnimationFrame(() => headingRef.current?.focus());
      } else {
        setError(result.error);
      }
    } catch {
      setError("Impossible de joindre le serveur. Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // role="group" et non <section> : plusieurs plans de même titre dans la page feraient autant de repères identiques pour un
    // lecteur d'écran (axe : landmark-unique, déjà rencontré avec les cartes de la vue d'ensemble).
    <div role="group" aria-labelledby={titleId} className={cn("w-full rounded-xl border bg-card p-4 text-[14px]", plan.status === "cancelled" ? "border-dashed border-border" : "border-border")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={titleId} ref={headingRef} tabIndex={-1} className="text-[15px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-foreground">
            Plan de l’équipe
          </h3>
          <p className="font-mono text-[12px] text-muted-foreground">
            {PLAN_STATUS_LABEL[plan.status]} · {formatPostDate(new Date(plan.createdAt))}
          </p>
        </div>
      </header>
      <p className={cn("mt-2 break-words", plan.status === "cancelled" && "text-muted-foreground")}>{plan.summary}</p>
      <p className="mt-1 font-mono text-[12px] text-muted-foreground">{summarizeTasks(plan.tasks)}</p>

      {tasks.length === 0 ? (
        <p className="mt-3 text-muted-foreground">Aucune tâche dans ce plan.</p>
      ) : (
        <ol className="mt-3 divide-y divide-border border-y border-border">
          {tasks.map((t) => (
            <li key={t.id} className="py-2.5">
              <div className="flex items-start gap-3">
                <span className="font-mono text-[13px] text-muted-foreground">{pad(t.position)}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-semibold break-words", t.status === "cancelled" && "text-muted-foreground line-through")}>{t.title}</p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-muted-foreground">
                    <span>{agentName(t.agent)}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot status={DOT[t.status]} />
                      {TASK_STATUS_LABEL[t.status]}
                    </span>
                    {t.dependsOn.length > 0 && <span className="font-mono text-[12px]">après {t.dependsOn.map(pad).join(", ")}</span>}
                  </p>
                  <details className="mt-1 text-[13px]">
                    <summary className="inline-flex min-h-7 cursor-pointer items-center text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
                      Voir la consigne<span className="sr-only"> de la tâche {pad(t.position)}</span>
                    </summary>
                    <p className="mt-1 whitespace-pre-wrap break-words">{t.instruction}</p>
                  </details>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {plan.status === "active" && allPending && (
        <p className="mt-3 text-[13px] text-muted-foreground">Les tâches sont enregistrées. Leur exécution automatique n’est pas encore branchée : elle arrive au chapitre 11 du plan.</p>
      )}

      {!onlyAgent && plan.status === "active" && (
        <div className="mt-3">
          {confirming ? (
            <div role="group" aria-label="Confirmer l’annulation du plan" className="flex flex-col gap-2">
              <p className="text-[14px]">Annuler ce plan ? Les tâches terminées sont conservées, les autres sont annulées.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={confirmCancel}>
                  {busy ? "Annulation…" : "Oui, annuler le plan"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  ref={keepRef}
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    setError(null);
                    requestAnimationFrame(() => cancelRef.current?.focus());
                  }}
                >
                  Non, le garder
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              ref={cancelRef}
              onClick={() => {
                setConfirming(true);
                requestAnimationFrame(() => keepRef.current?.focus()); // le choix sans risque est focalisé d'abord
              }}
            >
              Annuler le plan
            </Button>
          )}
          {error && (
            <p role="alert" className="mt-2 rounded-lg border border-destructive px-3 py-2 text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
