import Image from "next/image";
import Link from "next/link";

import { CreatePostMenu } from "@/components/dashboard/create-post-menu";
import { Button } from "@/components/ui/button";
import { formatPostDate, platformLabel } from "@/lib/dates";
import type { ReviewItem } from "@/lib/overview-queries";

// Encart d'un projet qui n'a encore AUCUN post (PAGES.md, fiche 4 : « Rien de prévu pour l'instant », deux boutons).
export function EmptyBanner({ projectId }: { projectId: string }) {
  return (
    <section aria-labelledby="rien-de-prevu" className="rounded-xl border border-dashed border-border p-6">
      <h2 id="rien-de-prevu" className="text-[20px] font-semibold tracking-tight">
        Rien de prévu pour l’instant
      </h2>
      <p className="mt-1 text-[15px] text-muted-foreground">Ce projet n’a encore aucun post. Demande à ton équipe d’agents d’en préparer, ou crée-le toi-même.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {/* Boutons secondaires : le bouton principal de la page, c'est « Créer un post » de l'en-tête (un seul par page) */}
        <Button asChild variant="outline">
          <Link href={`/dashboard/${projectId}/agents`}>Demander à l’équipe IA</Link>
        </Button>
        <CreatePostMenu variant="outline" />
      </div>
    </section>
  );
}

// La liste « À valider » : les posts que l'équipe IA a remis à l'humain, du plus proche au plus lointain.
export function ReviewList({ items, projectId }: { items: ReviewItem[]; projectId: string }) {
  return (
    <section aria-labelledby="liste-valider">
      <h2 id="liste-valider" className="text-[13px] font-medium text-muted-foreground">
        À valider
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border p-5 text-[15px] text-muted-foreground">Rien à relire pour l’instant.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((post) => (
            <li key={post.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted text-lg font-bold">
                {post.imageUrl ? (
                  // unoptimized : image déjà préparée et contrôlée côté serveur (chapitre 12)
                  <Image src={post.imageUrl} alt="" width={48} height={48} unoptimized className="size-full object-cover" />
                ) : (
                  (Array.from(post.title.trim())[0] ?? "?").toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{post.title}</p>
                <p className="truncate font-mono text-[12px] text-muted-foreground">
                  {post.scheduledAt ? formatPostDate(post.scheduledAt) : "Date à choisir"}
                  {" · "}
                  {post.platforms.length > 0 ? post.platforms.map(platformLabel).join(", ") : "Réseau à choisir"}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/${projectId}/posts`}>
                  Relire<span className="sr-only"> « {post.title} »</span>
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// « Activité récente » : le journal de ce que font les agents. Il n'existe pas encore (les tâches des agents arrivent aux
// chapitres 10 et 11) : on le dit honnêtement au lieu d'inventer des lignes.
export function ActivityList() {
  return (
    <section aria-labelledby="liste-activite">
      <h2 id="liste-activite" className="text-[13px] font-medium text-muted-foreground">
        Activité récente
      </h2>
      <p className="mt-3 rounded-xl border border-dashed border-border p-5 text-[15px] text-muted-foreground">
        Aucune activité pour l’instant. Quand ton équipe d’agents travaillera, chaque étape apparaîtra ici.
      </p>
    </section>
  );
}
