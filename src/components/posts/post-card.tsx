import Link from "next/link";

import { deletePostAction, duplicatePostAction, unschedulePostAction, validatePostAction } from "@/app/dashboard/[projectId]/posts/actions";
import { DeletePost } from "@/components/posts/delete-post";
import { Button } from "@/components/ui/button";
import { formatPostDate, platformLabel } from "@/lib/dates";
import type { PostStatus, PostView } from "@/lib/post-queries";
import { cn } from "@/lib/utils";

// La carte d'un post (PAGES.md, fiche 6) : visuel, début de la légende, réseaux, date en mono, état, auteur, et les actions qui
// ont un sens pour cet état. Composant serveur : les boutons sont de vrais formulaires reliés à des actions serveur.
// « À valider » et « Brouillon » ne sont pas confirmés : bordure en pointillés (DESIGN.md).
export const POST_STATUS_LABEL: Record<PostStatus, string> = { to_review: "À valider", draft: "Brouillon", scheduled: "Programmé", published: "Publié", failed: "Échec" };
const STATUS_STYLE: Record<PostStatus, string> = {
  to_review: "bg-signal text-signal-foreground",
  draft: "border border-dashed border-muted-foreground text-muted-foreground",
  scheduled: "border border-foreground text-foreground",
  published: "border border-success text-success",
  failed: "border border-destructive text-destructive",
};

export function PostCard({ post, projectId }: { post: PostView; projectId: string }) {
  const edit = `/dashboard/${projectId}/posts/${post.id}`;
  const form = (action: (projectId: string, postId: string) => Promise<void>, label: string, variant: "default" | "outline" = "outline") => (
    <form action={action.bind(null, projectId, post.id)}>
      <Button type="submit" variant={variant}>
        {label}
        <span className="sr-only"> le post « {post.title} »</span>
      </Button>
    </form>
  );
  const editable = post.status !== "published";

  return (
    <article className={cn("flex flex-col gap-4 rounded-xl bg-card p-5 sm:flex-row", post.status === "to_review" || post.status === "draft" ? "border border-dashed border-muted-foreground" : "border border-border")}>
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- image de notre stockage, déjà réduite à l'envoi
        <img src={post.imageUrl} alt={`Visuel du post « ${post.title} »`} width={112} height={112} loading="lazy" className="size-28 shrink-0 rounded-md border border-border object-cover" />
      ) : (
        <div
          className="grid size-28 shrink-0 place-items-center rounded-md border border-dashed border-border text-center text-[12px] text-muted-foreground"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 8px, var(--border) 8px 9px)" }}
        >
          <span className="bg-card px-1">Pas d’image</span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 text-[17px] font-semibold break-words">{post.title}</h2>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold", STATUS_STYLE[post.status])}>{POST_STATUS_LABEL[post.status]}</span>
        </header>
        {post.caption.trim() !== "" ? <p className="line-clamp-3 text-[15px] break-words whitespace-pre-line text-muted-foreground">{post.caption}</p> : <p className="text-[15px] text-muted-foreground">Pas encore de légende.</p>}

        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-muted-foreground">
          <span>par {post.createdBy === "agent" ? "l’équipe IA" : "toi"}</span>
          {post.scheduledAt && <span className="font-mono text-[13px]">{formatPostDate(post.scheduledAt)}</span>}
          {post.platforms.length === 0 && <span>Aucun réseau choisi</span>}
        </p>
        {post.platforms.length > 0 && (
          <ul aria-label="Réseaux" className="flex flex-wrap gap-1.5">
            {post.platforms.map((p) => (
              <li key={p} className="rounded-full border border-border px-2.5 py-0.5 text-[13px]">
                {platformLabel(p)}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {post.status === "to_review" && form(validatePostAction, "Valider", "default")}
          {editable && (
            <Button asChild variant="outline">
              <Link href={edit}>
                {post.status === "scheduled" ? "Modifier et reprogrammer" : "Modifier"}
                <span className="sr-only"> le post « {post.title} »</span>
              </Link>
            </Button>
          )}
          {post.status === "scheduled" && form(unschedulePostAction, "Déprogrammer")}
          {form(duplicatePostAction, "Dupliquer")}
          {editable && <DeletePost title={post.title} action={deletePostAction.bind(null, projectId, post.id)} />}
        </div>
        {post.status === "failed" && <p className="text-[14px] text-muted-foreground">La nouvelle tentative de publication arrive avec le service de publication (chapitre 14).</p>}
      </div>
    </article>
  );
}
