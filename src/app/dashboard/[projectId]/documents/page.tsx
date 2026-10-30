import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { DocumentCard } from "@/components/documents/document-card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMyProject, verifySession } from "@/lib/dal";
import { type DocumentStatus, type DocumentView, readProjectDocuments } from "@/lib/document-queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Documents · Socialix" };

// Les trois onglets : l'adresse (?statut=) → l'état qu'il montre. Une valeur inconnue est ignorée.
const TABS = [
  { slug: "a-relire", label: "À relire", status: "to_review", empty: "Aucun document à relire." },
  { slug: "valides", label: "Validés", status: "validated", empty: "Aucun document validé pour l’instant." },
  { slug: "ecartes", label: "Écartés", status: "rejected", empty: "Aucun document écarté." },
] as const satisfies readonly { slug: string; label: string; status: DocumentStatus; empty: string }[];

// Les documents d'un projet (PAGES.md, fiche 6 bis) : ce que l'équipe a produit, à relire, valider ou écarter.
export default function DocumentsPage({ params, searchParams }: PageProps<"/dashboard/[projectId]/documents">) {
  return (
    <>
      <PageHeader title="Documents" subtitle="Ce que l’équipe produit : études, offres, scripts. Rien n’est validé sans toi." />
      <Suspense fallback={<DocumentsSkeleton />}>
        <DocumentsContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DocumentsContent({ params, searchParams }: Pick<PageProps<"/dashboard/[projectId]/documents">, "params" | "searchParams">) {
  const { projectId } = await params;
  const { statut } = await searchParams;
  const { user } = await verifySession();
  await requireMyProject(projectId); // 404 si le projet n'est pas à la personne
  const docs = await readProjectDocuments(user.id, projectId);

  const count = (s: DocumentStatus) => docs.filter((d) => d.status === s).length;
  // Onglet ouvert : celui de l'adresse s'il existe ; sinon « À relire » s'il y a quelque chose à relire, sinon « Validés »
  const requested = TABS.find((t) => t.slug === statut);
  const current = requested ?? (count("to_review") === 0 && count("validated") > 0 ? TABS[1] : TABS[0]);
  const shown: DocumentView[] = docs.filter((d) => d.status === current.status);

  if (docs.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-8">
        <p className="text-[15px] font-semibold">Aucun document pour l’instant.</p>
        <p className="mt-1 text-[15px] text-muted-foreground">Quand un agent enregistre une étude, une offre ou un script, il apparaît ici, à relire. Demande un plan au Maître pour que l’équipe s’y mette.</p>
        <Link
          href={`/dashboard/${projectId}/agents?agent=maitre`}
          className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
        >
          Parler au Maître
        </Link>
      </section>
    );
  }

  return (
    <>
      <nav aria-label="Filtrer les documents par état" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.slug === current.slug;
          return (
            <Link
              key={t.slug}
              href={`/dashboard/${projectId}/documents?statut=${t.slug}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-medium transition-colors duration-150",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground",
              )}
            >
              {t.label}
              <span className="font-mono text-[13px]">{count(t.status)}</span>
            </Link>
          );
        })}
      </nav>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-[15px] text-muted-foreground">{current.empty}</p>
      ) : (
        <ul className="grid gap-4">
          {shown.map((d) => (
            <li key={d.id}>
              <DocumentCard doc={d} projectId={projectId} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DocumentsSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4">
      <Skeleton className="h-11 w-72 rounded-full" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
