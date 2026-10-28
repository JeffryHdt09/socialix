import { StatusDot } from "@/components/agents/status-dot";
import { Button } from "@/components/ui/button";
import { type Agent, type AgentStatus, STATUS_LABEL } from "@/lib/agents";
import { cn } from "@/lib/utils";

// LE composant de discussion, utilisé partout : dans l'onglet « Discussion » de la page Agents et dans le panneau qui
// s'ouvre depuis le bureau de la vue d'ensemble (PLAN.md, chapitre 8 : « même composant partout »).
// Le chat n'est pas encore branché à un modèle (chapitre 9). On ne fabrique donc ni conversation ni réponse : le journal
// des messages est vide et le dit, et la zone de saisie est désactivée avec la raison écrite juste dessous.
export function AgentChat({ agent, status = "idle", className }: { agent: Agent; status?: AgentStatus; className?: string }) {
  const fieldId = `message-${agent.id}`;
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

      {/* role="log" : quand les messages arriveront, les lecteurs d'écran les annonceront sans voler le focus */}
      <div role="log" aria-label="Messages" className="min-h-40 flex-1 overflow-y-auto rounded-xl border border-dashed border-border p-5">
        <p className="text-[15px] text-muted-foreground">Aucun message pour l’instant. Quand le chat sera branché, ta conversation avec {agent.name} apparaîtra ici.</p>
      </div>

      <form className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="sr-only">
          Message à {agent.name}
        </label>
        <textarea
          id={fieldId}
          disabled
          rows={2}
          placeholder={`Écrire à ${agent.name}…`}
          aria-describedby={`${fieldId}-aide`}
          className="min-h-16 w-full resize-none rounded-[10px] border border-input bg-card px-3 py-2 text-[15px] disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <p id={`${fieldId}-aide`} className="text-[13px] text-muted-foreground">
            Pas encore branché : l’équipe pourra répondre à partir du chapitre 9.
          </p>
          <Button type="submit" disabled>
            Envoyer
          </Button>
        </div>
      </form>
    </section>
  );
}
