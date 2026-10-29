import { changeDocumentStatus } from "@/app/dashboard/[projectId]/documents/actions";
import { FormattedText } from "@/components/agents/formatted-text";
import { Button } from "@/components/ui/button";
import { AGENTS } from "@/lib/agents";
import { formatPostDate } from "@/lib/dates";
import type { DocumentStatus, DocumentView } from "@/lib/document-queries";
import { DOCUMENT_KIND_LABEL, type DocumentKind } from "@/lib/documents";
import { cn } from "@/lib/utils";

// La carte d'un document du projet (PAGES.md, fiche 6 bis). Composant serveur : pas de JavaScript côté navigateur, les
// boutons sont de vrais formulaires reliés à une action serveur. L'état est dit en toutes lettres (jamais la couleur seule) ;
// « à relire » = pas encore confirmé, donc bordure en pointillés (DESIGN.md).
const STATUS_LABEL: Record<DocumentStatus, string> = { to_review: "À relire", validated: "Validé", rejected: "Écarté" };
const STATUS_STYLE: Record<DocumentStatus, string> = {
  to_review: "bg-signal text-signal-foreground",
  validated: "border border-success text-success",
  rejected: "border border-border text-muted-foreground",
};

const authorName = (id: string) => (id === "user" ? "toi" : (AGENTS.find((a) => a.id === id)?.name ?? id));
const kindLabel = (kind: string) => DOCUMENT_KIND_LABEL[kind as DocumentKind] ?? kind;

export function DocumentCard({ doc, projectId }: { doc: DocumentView; projectId: string }) {
  // Un petit formulaire par bouton : l'action reçoit le projet, le document et le nouvel état (liés ici, pas saisis)
  const change = (to: DocumentStatus, label: string, variant: "default" | "outline") => (
    <form action={changeDocumentStatus.bind(null, projectId, doc.id, to)}>
      <Button type="submit" variant={variant}>
        {label}
        <span className="sr-only"> : {doc.title}</span>
      </Button>
    </form>
  );

  return (
    <article className={cn("flex flex-col gap-3 rounded-xl bg-card p-5", doc.status === "to_review" ? "border border-dashed border-muted-foreground" : "border border-border")}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 text-[17px] font-semibold break-words">{doc.title}</h2>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold", STATUS_STYLE[doc.status])}>{STATUS_LABEL[doc.status]}</span>
      </header>
      <p className="text-[14px] text-muted-foreground">
        {kindLabel(doc.kind)} · par {authorName(doc.author)} · <span className="font-mono text-[13px]">{formatPostDate(doc.createdAt)}</span>
      </p>

      <details className="text-[15px]">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
          Lire le document<span className="sr-only"> : {doc.title}</span>
        </summary>
        <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-4 break-words">
          <FormattedText text={doc.content} />
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        {doc.status === "to_review" && (
          <>
            {change("validated", "Valider", "default")}
            {change("rejected", "Écarter", "outline")}
          </>
        )}
        {doc.status !== "to_review" && change("to_review", "Remettre à relire", "outline")}
      </div>
    </article>
  );
}
