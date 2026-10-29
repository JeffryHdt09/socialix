import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PostCard } from "@/components/posts/post-card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMyProject, verifySession } from "@/lib/dal";
import { type PostStatus, type PostView, readProjectPosts } from "@/lib/post-queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Posts · Socialix" };

// Les cinq onglets (PAGES.md, fiche 6) : l'adresse (?statut=) → l'état qu'il montre. Une valeur inconnue est ignorée.
const TABS = [
  { slug: "a-valider", label: "À valider", status: "to_review", empty: "Aucun post à valider." },
  { slug: "programmes", label: "Programmés", status: "scheduled", empty: "Aucun post programmé." },
  { slug: "brouillons", label: "Brouillons", status: "draft", empty: "Aucun brouillon." },
  { slug: "publies", label: "Publiés", status: "published", empty: "Aucun post publié pour l’instant." },
  { slug: "echecs", label: "Échecs", status: "failed", empty: "Aucun échec de publication." },
] as const satisfies readonly { slug: string; label: string; status: PostStatus; empty: string }[];

export default function PostsPage({ params, searchParams }: PageProps<"/dashboard/[projectId]/posts">) {
  return (
    <>
      <PageHeader title="Posts" subtitle="Tous les posts du projet : à valider, programmés, brouillons." />
      <Suspense fallback={<PostsSkeleton />}>
        <PostsContent params={params} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PostsContent({ params, searchParams }: Pick<PageProps<"/dashboard/[projectId]/posts">, "params" | "searchParams">) {
  const { projectId } = await params;
  const { statut } = await searchParams;
  const { user } = await verifySession();
  await requireMyProject(projectId); // 404 si le projet n'est pas à la personne
  const all = await readProjectPosts(user.id, projectId);

  const count = (s: PostStatus) => all.filter((p) => p.status === s).length;
  // Onglet ouvert : celui de l'adresse ; sinon le premier qui contient quelque chose (« À valider » en tête, PAGES.md)
  const current = TABS.find((t) => t.slug === statut) ?? TABS.find((t) => count(t.status) > 0) ?? TABS[0];
  const shown: PostView[] = all.filter((p) => p.status === current.status);
  // Les programmés se lisent dans l'ordre où ils partiront ; les autres du plus récent au plus ancien
  if (current.status === "scheduled") shown.sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0));

  if (all.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-8">
        <p className="text-[15px] font-semibold">Aucun post.</p>
        <p className="mt-1 text-[15px] text-muted-foreground">Demande à l’équipe IA ou crée-en un à la main.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/dashboard/${projectId}/agents?agent=maitre`} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90">
            Demander à l’équipe IA
          </Link>
          <Link href={`/dashboard/${projectId}/posts/new`} className="inline-flex min-h-11 items-center rounded-md border border-border bg-card px-4 text-[15px] font-semibold transition-colors duration-150 hover:border-foreground">
            Créer à la main
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <nav aria-label="Filtrer les posts par état" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.slug === current.slug;
          return (
            <Link
              key={t.slug}
              href={`/dashboard/${projectId}/posts?statut=${t.slug}`}
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
          {shown.map((p) => (
            <li key={p.id}>
              <PostCard post={p} projectId={projectId} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PostsSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4">
      <Skeleton className="h-11 w-96 max-w-full rounded-full" />
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}
