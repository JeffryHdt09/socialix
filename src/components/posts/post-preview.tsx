import { ProjectAvatar } from "@/components/project/project-avatar";
import { networkName, type Platform, PLATFORMS } from "@/lib/post-rules";
import type { ProjectIconKey } from "@/lib/project-rules";
import { cn } from "@/lib/utils";

// L'aperçu du post tel qu'il apparaîtra chez le réseau choisi (PAGES.md, fiche 7). Instagram d'abord : visuel carré en haut, légende
// coupée après quelques mots (« … plus »). Les autres réseaux montrent le texte d'abord, puis l'image. Ce n'est qu'un aperçu : il reprend
// la forme et la coupure de chaque réseau, pas leur apparence exacte (les réseaux la changent souvent).
export type PreviewAvatar = { name: string; iconKey: ProjectIconKey | null; imageUrl: string | null };

// Nombre de caractères visibles avant « … plus » (Instagram coupe vers 125, LinkedIn vers 210, Facebook vers 480) ;
// X ne coupe pas, il refuse au-delà de 280 (l'éditeur l'indique par ailleurs)
const VISIBLE: Partial<Record<Platform, number>> = { instagram: 125, linkedin: 210, facebook: 480 };

export const isPreviewNetwork = (p: string): p is Platform => (PLATFORMS as readonly string[]).includes(p);

export function PostPreview({ network, caption, hashtags, imageUrl, avatar, whenLabel }: { network: Platform; caption: string; hashtags: readonly string[]; imageUrl: string | null; avatar: PreviewAvatar; whenLabel: string }) {
  const limit = VISIBLE[network];
  const text = caption.trim();
  const cut = limit !== undefined && text.length > limit;
  const shown = cut ? `${text.slice(0, limit).trimEnd()}…` : text;
  const tags = hashtags.map((h) => `#${h}`).join(" ");
  const media = imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- aperçu d'une image de notre stockage
    <img src={imageUrl} alt="Image du post" className={cn("w-full bg-muted object-cover", network === "instagram" ? "aspect-square" : "aspect-video rounded-md")} />
  ) : (
    <div
      className={cn("grid w-full place-items-center border border-dashed border-border text-[13px] text-muted-foreground", network === "instagram" ? "aspect-square" : "aspect-video rounded-md")}
      style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 8px, var(--border) 8px 9px)" }}
    >
      <span className="bg-card px-2">Aucune image</span>
    </div>
  );
  const body = (
    <div className="space-y-1 text-[14px] break-words">
      {shown ? (
        <p className="whitespace-pre-line">
          {network === "instagram" && <strong>{avatar.name} </strong>}
          {shown}
          {cut && <span className="text-muted-foreground"> plus</span>}
        </p>
      ) : (
        <p className="text-muted-foreground">La légende apparaîtra ici.</p>
      )}
      {tags && <p className="text-muted-foreground">{tags}</p>}
    </div>
  );

  return (
    <figure aria-label={`Aperçu pour ${networkName(network)}`} className="m-0 overflow-hidden rounded-xl border border-border bg-card">
      <figcaption className="flex items-center gap-2.5 p-3">
        <ProjectAvatar {...avatar} className="size-9 text-sm" />
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold">{avatar.name}</span>
          <span className="block font-mono text-[12px] text-muted-foreground">{whenLabel}</span>
        </span>
      </figcaption>
      {network === "instagram" ? (
        <>
          {media}
          <div className="p-3">{body}</div>
        </>
      ) : (
        <div className="space-y-3 p-3 pt-0">
          {body}
          {media}
        </div>
      )}
    </figure>
  );
}
