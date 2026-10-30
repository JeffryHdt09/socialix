"use client";

import { useEffect, useRef, useState } from "react";

import { sendMessage } from "@/app/dashboard/chat-actions";
import { FormattedText } from "@/components/agents/formatted-text";
import { PlanCard } from "@/components/agents/plan-card";
import { StatusDot } from "@/components/agents/status-dot";
import { Button } from "@/components/ui/button";
import { type Agent, STATUS_LABEL } from "@/lib/agents";
import { type ChatMessage, MAX_MESSAGE_LENGTH } from "@/lib/chat-types";
import { formatClock, formatPostDate } from "@/lib/dates";
import type { PlanView } from "@/lib/plan-types";
import { cn } from "@/lib/utils";

// LE composant de discussion, utilisé partout : dans l'onglet « Discussion » de la page Agents et dans le panneau qui
// s'ouvre depuis le bureau de la vue d'ensemble (PLAN.md, chapitre 8 : « même composant partout »).
// La conversation de départ vient du serveur (initialMessages) ; ensuite le composant la fait vivre :
// - ton message s'affiche tout de suite (provisoire), puis est remplacé par les deux vrais messages enregistrés ;
// - si l'envoi échoue, le message provisoire disparaît, l'erreur est annoncée et ton texte revient dans la saisie.
// `plans` et `onPlanChange` : les plans du Maître, dont l'état (par exemple « annulé ») est tenu par le parent pour être partagé avec l'onglet Tâches.
type Props = { agent: Agent; projectId: string; initialMessages: ChatMessage[]; plans: PlanView[]; onPlanChange: (plan: PlanView) => void; className?: string };

export function AgentChat({ agent, projectId, initialMessages, plans, onPlanChange, className }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false); // garde contre un double envoi (deux clics avant le premier rendu)
  const fieldId = `message-${agent.id}`;

  // La conversation défile vers le dernier message à chaque nouveauté
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, sending]);

  async function submit() {
    const text = draft.trim();
    if (!text || busy.current) return;
    busy.current = true;
    setSending(true);
    setError(null);
    const temp: ChatMessage = { id: `provisoire-${Date.now()}`, role: "user", content: text, createdAt: new Date().toISOString(), planId: null };
    setMessages((m) => [...m, temp]);
    setDraft("");
    try {
      const result = await sendMessage(projectId, agent.id, text);
      if (result.ok) {
        setMessages((m) => [...m.filter((x) => x.id !== temp.id), ...result.messages]);
        if (result.plan) onPlanChange(result.plan); // la carte du plan s'affiche tout de suite sous la réponse du Maître
      } else {
        setMessages((m) => m.filter((x) => x.id !== temp.id));
        setDraft((d) => (d ? `${text}\n${d}` : text)); // ton texte revient, rien n'est perdu
        setError(result.error);
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== temp.id));
      setDraft((d) => (d ? `${text}\n${d}` : text));
      setError("Impossible de joindre le serveur. Vérifie ta connexion et réessaie.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  }

  const status = sending ? "working" : "idle";
  const left = MAX_MESSAGE_LENGTH - draft.length;

  return (
    <section aria-label={`Discussion avec ${agent.name}`} className={cn("flex min-h-0 flex-col gap-4", className)}>
      <header className="flex items-start gap-3 border-b border-border pb-4">
        <StatusDot status={status} className="mt-2" />
        <div className="min-w-0">
          {/* h2 : sous le h1 de la page ; dans le panneau, le titre caché de la boîte de dialogue est lui aussi un h2 */}
          <h2 className="text-[17px] font-semibold">{agent.name}</h2>
          <p className="text-[14px] text-muted-foreground">{agent.role}</p>
          <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">{STATUS_LABEL[status]}</p>
        </div>
      </header>

      {/* role="log" : les nouveaux messages sont annoncés par les lecteurs d'écran sans voler le focus. tabIndex 0 : quand la
          conversation déborde, on doit pouvoir la faire défiler au clavier (axe : scrollable-region-focusable). */}
      <div ref={logRef} role="log" aria-label="Messages" aria-busy={sending} tabIndex={0} className="min-h-40 flex-1 overflow-y-auto rounded-xl border border-dashed border-border p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
        {messages.length === 0 && !sending ? (
          <p className="text-[15px] text-muted-foreground">Aucun message pour l’instant. Écris à {agent.name} ci-dessous.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[88%] rounded-xl px-3.5 py-2.5 text-[15px] leading-relaxed",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card",
                  )}
                >
                  <span className="sr-only">{m.role === "user" ? "Toi" : agent.name} : </span>
                  {m.role === "user" ? <p className="break-words whitespace-pre-wrap">{m.content}</p> : <FormattedText text={m.content} />}
                </div>
                <time dateTime={m.createdAt} title={formatPostDate(new Date(m.createdAt))} className="font-mono text-[11px] text-muted-foreground">
                  {formatClock(new Date(m.createdAt))}
                </time>
                {m.planId && plans.some((p) => p.id === m.planId) && (
                  <div className="mt-1 w-full">
                    <PlanCard plan={plans.find((p) => p.id === m.planId)!} projectId={projectId} onChange={onPlanChange} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {sending && (
          <p role="status" className="mt-3 flex items-center gap-2 text-[14px] text-muted-foreground">
            <StatusDot status="working" />
            {agent.name} réfléchit…
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive px-3 py-2 text-[14px] text-destructive">
          {error}
        </p>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={fieldId} className="sr-only">
          Message à {agent.name}
        </label>
        <textarea
          id={fieldId}
          data-chat-input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Entrée envoie, Maj+Entrée fait un retour à la ligne (et on ne coupe pas la saisie d'un accent en cours : isComposing)
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={`Écrire à ${agent.name}…`}
          aria-describedby={`${fieldId}-aide`}
          className="min-h-16 w-full resize-none rounded-[10px] border border-input bg-card px-3 py-2 text-[15px] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        />
        <div className="flex items-start justify-between gap-3">
          <p id={`${fieldId}-aide`} className="text-[13px] text-muted-foreground">
            Entrée pour envoyer, Maj+Entrée pour passer à la ligne. N’envoie ni mot de passe ni donnée de client : l’offre gratuite de l’IA peut servir à améliorer ses modèles.
            {left <= 500 && <span className="ml-1 font-mono">{left.toLocaleString("fr-FR")} caractères restants.</span>}
          </p>
          <Button type="submit" disabled={sending || draft.trim() === ""}>
            {sending ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </form>
    </section>
  );
}
