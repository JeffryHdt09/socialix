"use client";

import { useId, useRef, useState } from "react";

import { retouchImageAction } from "@/app/dashboard/[projectId]/posts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  AI_LABELS,
  AI_OPS,
  BACKGROUND_PROMPT_MAX,
  CROP_LABELS,
  CROPS,
  EMPTY_SPEC,
  type RetouchSpec,
  TEXT_COLOR_LABELS,
  TEXT_COLORS,
  TEXT_MAX_CHARS,
  TEXT_MAX_SIZE,
  TEXT_MIN_SIZE,
  TEXT_POSITION_LABELS,
  TEXT_POSITIONS,
  validateSpec,
} from "@/lib/retouch-rules";

// L'éditeur d'image (PAGES.md, fiche 7) : une fenêtre à droite avec les retouches possibles. « Appliquer » envoie la demande au serveur
// (ImageKit retouche, le résultat est rangé dans notre stockage) puis montre le résultat ; « Utiliser cette image » le choisit pour le
// post, « Autre réglage » repart de l'image d'origine. Les retouches ne se cumulent pas d'un essai à l'autre : chacune part de l'original.
function Choice({ type, name, checked, onChange, children }: { type: "radio" | "checkbox"; name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 text-[15px]">
      <input type={type} name={name} checked={checked} onChange={onChange} className="size-5 shrink-0 accent-[var(--primary)]" />
      {children}
    </label>
  );
}

export function RetouchDialog({ projectId, imageUrl, configured, onUse }: { projectId: string; imageUrl: string | null; configured: boolean; onUse: (url: string) => void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [spec, setSpec] = useState<RetouchSpec>(EMPTY_SPEC);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  // Numéro de la retouche en cours : fermer la fenêtre l'incrémente, et une réponse qui arrive APRÈS la fermeture est ignorée
  // (sinon elle réapparaissait à la réouverture, à la place des réglages).
  const run = useRef(0);

  const reason = !imageUrl ? "Ajoute d’abord une image pour pouvoir la retoucher." : !configured ? "La retouche n’est pas configurée : renseigne IMAGEKIT_URL_ENDPOINT et IMAGEKIT_PRIVATE_KEY dans .env.local." : null;
  if (reason || !imageUrl) {
    return (
      <div className="flex flex-col gap-1">
        <Button type="button" variant="outline" disabled aria-describedby={`${uid}-why`} className="self-start">
          Retoucher
        </Button>
        <p id={`${uid}-why`} className="text-[13px] text-muted-foreground">
          {reason}
        </p>
      </div>
    );
  }

  const set = (patch: Partial<RetouchSpec>) => setSpec((s) => ({ ...s, ...patch }));
  const setText = (patch: Partial<RetouchSpec["text"]>) => setSpec((s) => ({ ...s, text: { ...s.text, ...patch } }));

  async function apply() {
    setError(null);
    const checked = validateSpec(spec);
    if (!checked.ok) return setError(checked.error); // les mêmes règles que le serveur, pour répondre tout de suite
    const mine = ++run.current;
    setPending(true);
    try {
      const r = await retouchImageAction(projectId, imageUrl as string, checked.spec);
      if (mine !== run.current) return; // la fenêtre a été fermée entre-temps
      if (r.ok) setResult(r.url);
      else setError(r.error);
    } catch {
      if (mine === run.current) setError("Impossible de joindre le serveur. Réessaie dans un instant.");
    } finally {
      if (mine === run.current) setPending(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          run.current++; // une retouche encore en route ne doit plus rien afficher
          setPending(false);
          setResult(null);
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button type="button" variant="outline">
          Retoucher
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-[20px] font-bold">Retoucher l’image</SheetTitle>
          <SheetDescription>Choisis les retouches, puis applique. Tu vois le résultat avant de le garder.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 pb-6">
          {/* L'image : l'originale, ou le résultat de la dernière retouche. Pendant le travail, elle est estompée et « Retouche… » s'affiche. */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- image de notre stockage */}
            <img src={result ?? imageUrl} alt={result ? "Résultat de la retouche" : "Image d’origine"} className={`max-h-80 w-full rounded-md border border-border bg-muted object-contain ${pending ? "opacity-40" : ""}`} />
            {pending && (
              <p role="status" className="absolute inset-0 grid place-items-center text-[15px] font-semibold">
                <span className="rounded-full bg-card px-4 py-1.5">Retouche…</span>
              </p>
            )}
          </div>

          {result ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  onUse(result);
                  setOpen(false);
                  setResult(null);
                }}
              >
                Utiliser cette image
              </Button>
              <Button type="button" variant="outline" onClick={() => setResult(null)}>
                Autre réglage
              </Button>
            </div>
          ) : (
            <>
              <fieldset className="flex flex-col">
                <legend className="mb-1 text-[14px] font-semibold">Recadrage</legend>
                <Choice type="radio" name={`${uid}-crop`} checked={spec.crop === null} onChange={() => set({ crop: null })}>
                  Garder le format
                </Choice>
                {CROPS.map((c) => (
                  <Choice key={c} type="radio" name={`${uid}-crop`} checked={spec.crop === c} onChange={() => set({ crop: c })}>
                    {CROP_LABELS[c]}
                  </Choice>
                ))}
              </fieldset>

              <fieldset className="flex flex-col">
                <legend className="mb-1 text-[14px] font-semibold">Retouche par l’IA (une seule à la fois)</legend>
                {AI_OPS.map((op) => (
                  <Choice key={op} type="radio" name={`${uid}-ai`} checked={spec.ai === op} onChange={() => set({ ai: op })}>
                    {AI_LABELS[op]}
                  </Choice>
                ))}
                {spec.ai === "changebg" && (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <Label htmlFor={`${uid}-bg`}>Décris le nouveau fond (en anglais, de préférence)</Label>
                    <Input id={`${uid}-bg`} maxLength={BACKGROUND_PROMPT_MAX} value={spec.background} onChange={(e) => set({ background: e.target.value })} placeholder="a sunny wooden market table" />
                  </div>
                )}
              </fieldset>

              <Choice type="checkbox" name={`${uid}-bw`} checked={spec.grayscale} onChange={() => set({ grayscale: !spec.grayscale })}>
                Noir et blanc
              </Choice>

              <fieldset className="flex flex-col">
                <legend className="sr-only">Texte par-dessus</legend>
                <Choice type="checkbox" name={`${uid}-text`} checked={spec.text.enabled} onChange={() => setText({ enabled: !spec.text.enabled })}>
                  Ajouter un texte par-dessus
                </Choice>
                {spec.text.enabled && (
                  <div className="mt-1 flex flex-col gap-3 pl-1">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${uid}-t`}>Texte</Label>
                      <Input id={`${uid}-t`} maxLength={TEXT_MAX_CHARS} value={spec.text.content} onChange={(e) => setText({ content: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`${uid}-s`}>
                        Taille : <span className="font-mono text-[13px]">{spec.text.size}</span>
                      </Label>
                      <input id={`${uid}-s`} type="range" min={TEXT_MIN_SIZE} max={TEXT_MAX_SIZE} step={4} value={spec.text.size} onChange={(e) => setText({ size: Number(e.target.value) })} className="h-11 w-full accent-[var(--primary)]" />
                    </div>
                    <fieldset className="flex flex-wrap gap-x-4">
                      <legend className="mb-1 text-[14px] font-semibold">Position</legend>
                      {(Object.keys(TEXT_POSITIONS) as (keyof typeof TEXT_POSITIONS)[]).map((p) => (
                        <Choice key={p} type="radio" name={`${uid}-pos`} checked={spec.text.position === p} onChange={() => setText({ position: p })}>
                          {TEXT_POSITION_LABELS[p]}
                        </Choice>
                      ))}
                    </fieldset>
                    <fieldset className="flex flex-wrap gap-x-4">
                      <legend className="mb-1 text-[14px] font-semibold">Couleur</legend>
                      {(Object.keys(TEXT_COLORS) as (keyof typeof TEXT_COLORS)[]).map((c) => (
                        <Choice key={c} type="radio" name={`${uid}-col`} checked={spec.text.color === c} onChange={() => setText({ color: c })}>
                          {TEXT_COLOR_LABELS[c]}
                        </Choice>
                      ))}
                    </fieldset>
                  </div>
                )}
              </fieldset>

              {error && (
                <p role="alert" className="rounded-md border border-destructive p-3 text-[14px] text-destructive">
                  {error}
                </p>
              )}
              <Button type="button" onClick={apply} disabled={pending} className="self-start">
                {pending ? "Retouche…" : "Appliquer"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
