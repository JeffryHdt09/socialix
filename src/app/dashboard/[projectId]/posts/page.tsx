import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireMyProject, verifySession } from "@/lib/dal";
import { type PostStatus, readPostCounts, readProjectPosts } from "@/lib/post-queries";
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

// Pourquoi une action (valider, déprogrammer, dupliquer, supprimer) a échoué : l'adresse porte un CODE (?erreur=etat), jamais un
// texte. Un code inconnu n'affiche rien : une adresse trafiquée ne peut pas faire écrire n'importe quoi sur la page.
const ERRORS: Record<string, string> = {
  etat: "Ce post a changé entre-temps (autre onglet, déjà traité ou publié). La liste est à jour : vérifie son état avant de recommencer.",
  limite: "Ce projet a atteint la limite de 500 posts. Supprime-en avant d’en dupliquer ou d’en créer.",
  introuvable: "Ce post est introuvable : il a peut-être été supprimé.",
  publication: "Le service de publication n’a pas répondu ou a refusé. Rien n’a été modifié : réessaie dans un instant.",
  compte: "Aucun compte n’est lié à ce projet pour l’un des réseaux de ce post. Ajoute-le dans « Comptes », ou retire ce réseau du post.",
};

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
  const { statut, erreur } = await searchParams;
  const { user } = await verifySession();
  await requireMyProject(projectId); // 404 si le projet n'est pas à la personne
  // Les compteurs viennent d'une requête qui ne transporte aucune légende ; seul l'onglet ouvert charge ses posts.
  const counts = await readPostCounts(user.id, projectId);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const message = typeof erreur === "string" && Object.hasOwn(ERRORS, erreur) ? ERRORS[erreur] : null;
  const banner = message ? (
    <p role="alert" className="rounded-lg border border-destructive px-3 py-2 text-[14px] text-destructive">
      {message}
    </p>
  ) : null;

  const count = (s: PostStatus) => counts[s];
  // Onglet ouvert : celui de l'adresse ; sinon le premier qui contient quelque chose (« À valider » en tête, PAGES.md)
  const current = TABS.find((t) => t.slug === statut) ?? TABS.find((t) => count(t.status) > 0) ?? TABS[0];
  // Les programmés se lisent dans l'ordre où ils partiront, les autres du plus récent au plus ancien (voir readProjectPosts)
  const shown = total === 0 ? [] : await readProjectPosts(user.id, projectId, current.status);

  if (total === 0) {
    return (
      <section className="rounded-xl border border-dashed border-border p-8">
        <p className="text-[15px] font-semibold">Aucun post.</p>
        {banner}
        <p className="mt-1 text-[15px] text-muted-foreground">Demande à l’équipe IA ou crée-en un à la main.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/dashboard/${projectId}/agents?agent=maitre`}>Demander à l’équipe IA</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/dashboard/${projectId}/posts/new`}>Créer à la main</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <>
      {banner}
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
