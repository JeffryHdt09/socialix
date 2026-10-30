"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { savePostAction, uploadPostImageAction } from "@/app/dashboard/[projectId]/posts/actions";
import { PostPreview, type PreviewAvatar } from "@/components/posts/post-preview";
import { RetouchDialog } from "@/components/posts/retouch-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPostDate, parisToUtc, utcToParisInput } from "@/lib/dates";
import { CAPTION_LIMITS, cleanHashtags, HASHTAGS_MAX, networkName, type Platform, PLATFORMS, type PostErrors, TITLE_MAX, validatePost, VIDEO_ONLY } from "@/lib/post-rules";
import { LOGO_ERROR, LOGO_MAX_BYTES } from "@/lib/logo-check";
import { cn } from "@/lib/utils";

// L'éditeur de post (PAGES.md, fiche 7) : le formulaire à gauche, l'aperçu en direct à droite, « Enregistrer en brouillon » et « Programmer »
// en bas. Les mêmes règles (post-rules.ts) servent ici pour répondre tout de suite et sur le serveur pour décider : le navigateur peut mentir.
export type EditorInitial = { id: string | null; title: string; caption: string; hashtags: string[]; platforms: string[]; imageUrl: string | null; day: string; time: string; published: boolean };

type Props = { projectId: string; avatar: PreviewAvatar; initial: EditorInitial; teamImages: string[]; retouchConfigured: boolean; focusDate: boolean };

const STATUS_TAB = { draft: "brouillons", scheduled: "programmes" } as const;

export function PostEditor({ projectId, avatar, initial, teamImages, retouchConfigured, focusDate }: Props) {
  const uid = useId();
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [caption, setCaption] = useState(initial.caption);
  const [hashtags, setHashtags] = useState<string[]>(initial.hashtags);
  const [tagDraft, setTagDraft] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(initial.platforms);
  const [imageUrl, setImageUrl] = useState<string | null>(initial.imageUrl);
  const [day, setDay] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [errors, setErrors] = useState<PostErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"draft" | "schedule" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewNetwork, setPreviewNetwork] = useState<Platform>("instagram");
  const fileRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const todayParis = utcToParisInput(new Date()).day;

  // Arrivé par « Valider » sur un post incomplet : on amène la personne à la date
  useEffect(() => {
    if (focusDate) dateRef.current?.focus();
  }, [focusDate]);

  const selected = platforms.filter((p): p is Platform => (PLATFORMS as readonly string[]).includes(p));
  const shownNetwork = selected.includes(previewNetwork) ? previewNetwork : (selected[0] ?? "instagram");
  const when = parisToUtc(day, time);
  const whenLabel = when ? `${formatPostDate(when)} · Paris` : "Date à choisir";

  const togglePlatform = (p: string) => setPlatforms((all) => (all.includes(p) ? all.filter((x) => x !== p) : [...all, p]));
  const addTags = (raw: string) => {
    const next = cleanHashtags([...hashtags, ...raw.split(/[\s,]+/)]);
    setHashtags(next);
    setTagDraft("");
  };

  async function upload(file: File) {
    setUploadError(null);
    // On vide le champ fichier dans TOUS les cas (refus, erreur, succès) : sinon choisir de nouveau le même fichier, après l'avoir
    // allégé, ne déclenche aucun événement et rien ne se passe.
    const resetInput = () => {
      if (fileRef.current) fileRef.current.value = "";
    };
    // Refus rapide ; le serveur revérifie la taille ET le vrai format du fichier (pas seulement son nom)
    if (file.size > LOGO_MAX_BYTES) {
      resetInput();
      return setUploadError(`Image trop lourde. ${LOGO_ERROR}`);
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("image", file);
      const r = await uploadPostImageAction(projectId, form);
      if (r.ok) {
        setImageUrl(r.url);
        setErrors((e) => ({ ...e, image: undefined }));
      } else setUploadError(r.error);
    } catch {
      // Réseau coupé, session expirée, fichier refusé avant d'arriver : sans ce filet, « Envoi… » restait affiché pour toujours
      setUploadError("Impossible de joindre le serveur. Réessaie dans un instant.");
    } finally {
      setUploading(false);
      resetInput();
    }
  }

  async function save(mode: "draft" | "schedule") {
    setFormError(null);
    const input = { title, caption, hashtags, platforms, imageUrl, day, time };
    // Mêmes règles que le serveur : on répond tout de suite, sans aller-retour, quand c'est évident
    const local = validatePost(input, mode);
    if (!local.ok) {
      setErrors(local.errors);
      summaryRef.current?.focus();
      return;
    }
    setErrors({});
    setSaving(mode);
    try {
      const r = await savePostAction(projectId, initial.id, input, mode);
      if (r.ok) {
        router.push(`/dashboard/${projectId}/posts?statut=${STATUS_TAB[r.status === "scheduled" ? "scheduled" : "draft"]}`);
        router.refresh();
        return;
      }
      setErrors(r.errors ?? {});
      setFormError(r.error ?? (r.errors ? null : "Le post n’a pas pu être enregistré."));
    } catch {
      // L'action a levé une erreur (connexion coupée, texte refusé par la base, déploiement remplacé) : les boutons ne restent pas
      // bloqués sur « Enregistrement… », et le texte saisi est toujours là.
      setFormError("Impossible de joindre le serveur. Réessaie dans un instant : ce que tu as écrit est toujours là.");
    } finally {
      setSaving(null);
    }
    summaryRef.current?.focus();
  }

  const errorList = Object.entries(errors).filter(([, m]) => m) as [keyof PostErrors, string][];
  const FIELD_ID: Record<keyof PostErrors, string> = { title: `${uid}-title`, caption: `${uid}-caption`, hashtags: `${uid}-tags`, platforms: `${uid}-platforms`, image: `${uid}-image`, date: `${uid}-day` };
  const describe = (f: keyof PostErrors) => (errors[f] ? `${FIELD_ID[f]}-err` : undefined);
  const err = (f: keyof PostErrors) => (errors[f] ? <p id={`${FIELD_ID[f]}-err`} className="text-[14px] text-destructive">{errors[f]}</p> : null);

  if (initial.published) {
    return (
      <section className="rounded-xl border border-border p-6">
        <p className="text-[15px] font-semibold">Ce post est publié : il ne peut plus être modifié.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/dashboard/${projectId}/posts?statut=publies`}>Retour aux posts</Link>
        </Button>
      </section>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form
        noValidate
        onSubmit={(e) => {
          // Entrée dans un champ (titre, jour, heure) ne doit JAMAIS programmer le post : seuls les deux boutons enregistrent.
          e.preventDefault();
        }}
        className="flex min-w-0 flex-col gap-6"
      >
        {(errorList.length > 0 || formError) && (
          <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-md border border-destructive p-4 text-[14px]">
            <p className="font-semibold text-destructive">{formError ?? "Il reste des points à corriger avant d’enregistrer."}</p>
            {errorList.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {errorList.map(([f, m]) => (
                  <li key={f}>
                    <a href={`#${FIELD_ID[f]}`} className="underline underline-offset-2">
                      {m}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-title`}>Titre interne</Label>
          <Input id={`${uid}-title`} value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} aria-describedby={describe("title")} />
          <p className="text-[13px] text-muted-foreground">Pour te repérer. Il n’est pas publié.</p>
          {err("title")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-caption`}>Légende</Label>
          <Textarea id={`${uid}-caption`} rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} aria-invalid={!!errors.caption} aria-describedby={`${uid}-count ${describe("caption") ?? ""}`.trim()} />
          {/* Compteur par réseau choisi : X coupe à 280, Instagram à 2 200… (mono, il s'aligne) */}
          <ul id={`${uid}-count`} aria-label="Longueur de la légende par réseau" className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[13px]">
            {(selected.length > 0 ? selected : [null]).map((p) => {
              const limit = p ? CAPTION_LIMITS[p] : null;
              const over = limit !== null && caption.trim().length > limit;
              return (
                <li key={p ?? "none"} className={cn(over ? "text-destructive" : "text-muted-foreground")}>
                  {p ? `${networkName(p)} : ` : ""}
                  {caption.trim().length}
                  {limit !== null ? ` / ${limit}` : ""}
                  {over ? " (trop long)" : ""}
                </li>
              );
            })}
          </ul>
          {err("caption")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${uid}-tags`}>Hashtags</Label>
          {hashtags.length > 0 && (
            <ul aria-label="Hashtags du post" className="flex flex-wrap gap-1.5">
              {hashtags.map((h) => (
                <li key={h} className="flex items-center rounded-full border border-border bg-card pl-3 text-[14px]">
                  #{h}
                  <button type="button" onClick={() => setHashtags(hashtags.filter((x) => x !== h))} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground">
                    <span aria-hidden="true">×</span>
                    <span className="sr-only">Retirer #{h}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Input
            id={`${uid}-tags`}
            value={tagDraft}
            disabled={hashtags.length >= HASHTAGS_MAX}
            placeholder={hashtags.length >= HASHTAGS_MAX ? `${HASHTAGS_MAX} hashtags au plus` : "Écris un mot, puis Entrée"}
            onChange={(e) => setTagDraft(e.target.value.includes(",") ? (addTags(e.target.value), "") : e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // Entrée ajoute le hashtag, elle n'envoie pas le formulaire
                if (tagDraft.trim()) addTags(tagDraft);
              }
            }}
            onBlur={() => tagDraft.trim() && addTags(tagDraft)}
            aria-describedby={describe("hashtags")}
          />
          {err("hashtags")}
        </div>

        <fieldset id={`${uid}-platforms`} className="flex flex-col gap-1" aria-describedby={describe("platforms")}>
          <legend className="mb-1 text-[14px] font-medium">Réseaux</legend>
          <div className="flex flex-wrap gap-x-5">
            {PLATFORMS.map((p) => {
              const video = VIDEO_ONLY.includes(p);
              return (
                <label key={p} className={cn("flex min-h-11 items-center gap-2.5 text-[15px]", video ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer")}>
                  <input type="checkbox" checked={platforms.includes(p)} disabled={video && !platforms.includes(p)} onChange={() => togglePlatform(p)} className="size-5 accent-[var(--primary)]" />
                  {networkName(p)}
                  {video && <span className="text-[12px]">(vidéo : phase 3)</span>}
                </label>
              );
            })}
          </div>
          <p className="text-[13px] text-muted-foreground">Seuls les comptes connectés seront proposés au chapitre 14 ; pour l’instant, tous les réseaux le sont.</p>
          {err("platforms")}
        </fieldset>

        <div id={`${uid}-image`} className="flex flex-col gap-3">
          <p className="text-[14px] font-medium">Image</p>
          {imageUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- image de notre stockage */}
              <img src={imageUrl} alt="Image du post" width={96} height={96} className="size-24 rounded-md border border-border object-cover" />
              <Button type="button" variant="outline" onClick={() => setImageUrl(null)}>
                Retirer l’image
              </Button>
            </div>
          ) : (
            <p className="text-[14px] text-muted-foreground">Aucune image.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-label="Choisir une image à téléverser" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "Envoi…" : "Téléverser une image"}
            </Button>
            <RetouchDialog projectId={projectId} imageUrl={imageUrl} configured={retouchConfigured} onUse={setImageUrl} />
            <Button asChild variant="outline">
              <Link href={`/dashboard/${projectId}/agents?agent=createur`}>Demander une image à l’équipe IA</Link>
            </Button>
          </div>
          <p className="text-[13px] text-muted-foreground">PNG, JPG ou WebP, 3 Mo au plus.</p>
          {uploadError && (
            <p role="alert" className="text-[14px] text-destructive">
              {uploadError}
            </p>
          )}
          {err("image")}
          {teamImages.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[14px] font-medium">Images de l’équipe</p>
              <ul className="flex flex-wrap gap-2">
                {teamImages.map((src, i) => (
                  <li key={src}>
                    <button type="button" aria-pressed={imageUrl === src} onClick={() => setImageUrl(src)} className={cn("block rounded-md border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground", imageUrl === src ? "border-foreground" : "border-transparent")}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- image de notre stockage */}
                      <img src={src} alt={`Image de l’équipe n°${i + 1}`} width={72} height={72} loading="lazy" className="size-[72px] rounded-sm object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <fieldset className="flex flex-col gap-1.5" aria-describedby={describe("date")}>
          <legend className="mb-1 text-[14px] font-medium">Date et heure de publication</legend>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-day`}>Jour</Label>
              <Input ref={dateRef} id={`${uid}-day`} type="date" min={todayParis} value={day} onChange={(e) => setDay(e.target.value)} aria-invalid={!!errors.date} className="w-44 font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${uid}-time`}>Heure</Label>
              <Input id={`${uid}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-invalid={!!errors.date} className="w-32 font-mono" />
            </div>
            <p className="pb-3 text-[14px] text-muted-foreground">Fuseau : Paris</p>
          </div>
          {err("date")}
        </fieldset>

        <div className="flex flex-wrap gap-2 border-t border-border pt-5">
          <Button type="button" variant="outline" disabled={saving !== null} onClick={() => void save("draft")}>
            {saving === "draft" ? "Enregistrement…" : "Enregistrer en brouillon"}
          </Button>
          <Button type="button" disabled={saving !== null} onClick={() => void save("schedule")}>
            {saving === "schedule" ? "Programmation…" : "Programmer"}
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/dashboard/${projectId}/posts`}>Annuler</Link>
          </Button>
        </div>
      </form>

      <aside aria-label="Aperçu du post" className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Aperçu</h2>
          {selected.length > 1 && (
            <div role="group" aria-label="Réseau de l’aperçu" className="flex flex-wrap gap-1">
              {selected.map((p) => (
                <button key={p} type="button" aria-pressed={shownNetwork === p} onClick={() => setPreviewNetwork(p)} className={cn("min-h-9 rounded-full border px-3 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-foreground", shownNetwork === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                  {networkName(p)}
                </button>
              ))}
            </div>
          )}
        </div>
        <PostPreview network={shownNetwork} caption={caption} hashtags={hashtags} imageUrl={imageUrl} avatar={avatar} whenLabel={whenLabel} />
        <p className="text-[13px] text-muted-foreground">L’aperçu reprend la forme et la coupure de chaque réseau ; le rendu exact peut varier.</p>
      </aside>
    </div>
  );
}
