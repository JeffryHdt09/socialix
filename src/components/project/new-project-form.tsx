"use client";

import Image from "next/image";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { createProject, type CreateProjectState } from "@/app/projects/actions";
import { ProjectAvatar } from "@/components/project/project-avatar";
import { IconPicker } from "@/components/project/icon-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_TEAMS, TEAMS, type ActiveTeamId } from "@/lib/agents";
import { PROJECT_NAME_MAX, projectSchema, type ProjectIconKey } from "@/lib/project-rules";
import { detectLogoFormat, LOGO_ERROR, LOGO_FORMATS, LOGO_MAX_BYTES } from "@/lib/logo-check";

const ACCEPTED_TYPES: string[] = Object.values(LOGO_FORMATS).map((f) => f.contentType);
const initialState: CreateProjectState = {};

// Formulaire de création de projet en 2 étapes (PAGES.md, fiche 2).
// Les deux étapes restent dans la page (l'inactive est seulement cachée) : tous les champs sont envoyés
// ensemble à la fin. Les contrôles faits ici ne servent qu'à répondre vite ; le serveur refait tout.
export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, initialState);
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<ProjectIconKey | null>(null);
  const [teams, setTeams] = useState<ActiveTeamId[]>(DEFAULT_TEAMS);
  const [teamsError, setTeamsError] = useState<string>();
  const [preview, setPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string>();
  const [logoError, setLogoError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Quand le serveur répond par une erreur sur l'étape 1, on y revient. (Ajuster l'état pendant le rendu,
  // quand une nouvelle réponse arrive, est la méthode recommandée par React ; un effet ferait un rendu de trop.)
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    const errors = state.fieldErrors;
    if (errors?.name || errors?.icon || errors?.logo || errors?.teams) setStep(1);
  }

  // Au changement d'étape, le titre reçoit le focus : un lecteur d'écran annonce la nouvelle étape,
  // et un utilisateur au clavier n'est pas laissé sur un bouton qui vient de disparaître.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // L'aperçu local du logo est une adresse temporaire en mémoire : on la libère quand elle change.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function clearLogo() {
    if (fileRef.current) fileRef.current.value = "";
    setPreview(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    setLogoError(undefined);
    if (!file) return clearLogo();
    // Contrôle de confort, pour répondre tout de suite : la taille et le type annoncés viennent du navigateur,
    // mais on lit aussi les 16 premiers octets avec la MÊME fonction que le serveur (logo-check.ts). Un script
    // renommé « logo.png » est donc refusé ici, sans image cassée. Le serveur refait le contrôle de toute façon.
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (file.size > LOGO_MAX_BYTES || !ACCEPTED_TYPES.includes(file.type) || !detectLogoFormat(head)) {
      input.value = "";
      clearLogo();
      setLogoError(LOGO_ERROR);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setIcon(null); // logo téléversé et icône sont exclusifs
  }

  function pickIcon(key: ProjectIconKey) {
    setIcon(key);
    setLogoError(undefined);
    clearLogo();
  }

  function goNext() {
    // Mêmes règles que le serveur : celles de project-rules.ts.
    const result = projectSchema.shape.name.safeParse(name);
    if (!result.success) {
      setNameError(result.error.issues[0].message);
      return;
    }
    if (teams.length === 0) {
      setTeamsError("Choisis au moins un domaine.");
      return;
    }
    setNameError(undefined);
    setStep(2);
  }

  // On gère l'envoi nous-mêmes plutôt que par l'attribut « action » du formulaire : React viderait alors
  // les champs non contrôlés (le fichier choisi) à chaque réponse, même une erreur.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) return goNext(); // « Entrée » dans le champ du nom passe à l'étape 2, sans envoyer
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const shownNameError = nameError ?? state.fieldErrors?.name;
  const shownLogoError = logoError ?? state.fieldErrors?.logo;
  const shownTeamsError = teamsError ?? state.fieldErrors?.teams;

  function toggleTeam(id: ActiveTeamId, checked: boolean) {
    setTeamsError(undefined);
    setTeams((all) => (checked ? [...all.filter((t) => t !== id), id] : all.filter((t) => t !== id)));
  }

  return (
    <section className="w-full max-w-xl rounded-xl border border-border bg-card p-6 sm:p-8">
      <ol aria-label="Étapes" className="flex items-center gap-4 font-mono text-[13px]">
        {[
          { n: 1, label: "Identité" },
          { n: 2, label: "Bureau" },
        ].map(({ n, label }) => (
          <li
            key={n}
            aria-current={step === n ? "step" : undefined}
            className={step === n ? "font-medium text-foreground" : "text-muted-foreground"}
          >
            <span
              className={`mr-2 inline-grid size-6 place-items-center rounded-full border ${step === n ? "border-foreground bg-primary text-primary-foreground" : "border-border"}`}
            >
              {n}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-[28px] font-bold tracking-tight outline-none">
        {step === 1 ? "Nouveau projet" : "Choisis ton bureau"}
      </h1>
      <p className="mt-1 text-[15px] text-muted-foreground">
        {step === 1
          ? "Un projet, c’est un espace de travail pour une marque ou un client."
          : "C’est là que travaillent tes agents. Tu pourras le changer plus tard."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6">
        <input type="hidden" name="icon" value={icon ?? ""} />

        {/* ÉTAPE 1 : identité */}
        <div hidden={step !== 1}>
          <div className="flex flex-col gap-6">
            <div className="flex items-end gap-4">
              <ProjectAvatar name={name} iconKey={icon} imageUrl={preview} />
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="name">Nom du projet</Label>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(undefined);
                  }}
                  maxLength={PROJECT_NAME_MAX}
                  autoComplete="off"
                  required
                  aria-invalid={shownNameError ? true : undefined}
                  aria-describedby={shownNameError ? "name-error" : undefined}
                />
              </div>
            </div>
            {shownNameError && (
              <p id="name-error" role="alert" className="-mt-4 text-[13px] font-medium text-destructive">
                {shownNameError}
              </p>
            )}

            <fieldset className="flex flex-col gap-3">
              <legend className="text-[13px] font-medium">Logo (facultatif)</legend>
              <IconPicker value={icon} onChange={pickIcon} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  Téléverser une image
                </Button>
                {preview && (
                  <Button type="button" variant="ghost" onClick={clearLogo}>
                    Retirer l’image
                  </Button>
                )}
                {icon && !preview && (
                  <Button type="button" variant="ghost" onClick={() => setIcon(null)}>
                    Aucune icône
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  name="logo"
                  accept={ACCEPTED_TYPES.join(",")}
                  onChange={handleFile}
                  className="hidden"
                  aria-label="Téléverser une image"
                />
              </div>
              <p className={`text-[13px] ${shownLogoError ? "font-medium text-destructive" : "text-muted-foreground"}`} role={shownLogoError ? "alert" : undefined}>
                {shownLogoError ?? LOGO_ERROR}
              </p>
            </fieldset>

            {/* Les domaines : chacun apporte ses agents au projet (src/lib/agents.ts). Le Maître et Recherche sont toujours là. */}
            <fieldset className="flex flex-col gap-3" aria-describedby={shownTeamsError ? "teams-error" : undefined}>
              <legend className="text-[13px] font-medium">Domaines du projet</legend>
              <p className="text-[13px] text-muted-foreground">Chaque domaine apporte ses agents. Tu pourras en ajouter plus tard.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEAMS.map((team) => (
                  <label
                    key={team.id}
                    className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-checked:border-foreground has-checked:bg-card has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                  >
                    <input
                      type="checkbox"
                      name="teams"
                      value={team.id}
                      checked={teams.includes(team.id)}
                      onChange={(e) => toggleTeam(team.id, e.target.checked)}
                      className="mt-1 size-4 accent-foreground"
                    />
                    <span>
                      <span className="block text-[15px] font-semibold">{team.name}</span>
                      <span className="block text-[13px] text-muted-foreground">{team.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              {shownTeamsError && (
                <p id="teams-error" role="alert" className="text-[13px] font-medium text-destructive">
                  {shownTeamsError}
                </p>
              )}
            </fieldset>
          </div>
        </div>

        {/* ÉTAPE 2 : bureau */}
        <div hidden={step !== 2}>
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Décor du bureau</legend>

            <label className="flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-muted p-2 has-checked:border-foreground has-checked:bg-card has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
              <input type="radio" name="office" value="wooden" defaultChecked className="sr-only" />
              <span className="relative block aspect-[1376/768] overflow-hidden rounded-md">
                {/* Deux images dans le HTML, le CSS affiche celle du thème : pas de saut au chargement.
                    loading="eager" : une image paresseuse dans une zone cachée (étape 2) ne se chargerait qu'à l'affichage. */}
                <Image src="/office/atelier-jour.webp" alt="" fill sizes="240px" loading="eager" className="object-cover [image-rendering:pixelated] dark:hidden" />
                <Image src="/office/atelier-nuit.webp" alt="" fill sizes="240px" loading="eager" className="hidden object-cover [image-rendering:pixelated] dark:block" />
              </span>
              <span className="px-1 pb-1">
                <span className="block text-[15px] font-semibold">Atelier bois</span>
                <span className="block text-[13px] text-muted-foreground">Un atelier chaleureux, en pixel art.</span>
              </span>
            </label>

            {/* Pas encore dessiné : on le montre honnêtement, hachuré (= pas encore confirmé, DESIGN.md). */}
            <label aria-disabled="true" className="flex cursor-not-allowed flex-col gap-2 rounded-lg border border-dashed border-border p-2">
              <input type="radio" name="office" value="modern" disabled className="sr-only" />
              <span
                className="grid aspect-[1376/768] place-items-center rounded-md border border-border"
                style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 8px, var(--border) 8px 9px)" }}
              >
                <span className="rounded-full border border-border bg-card px-3 py-1 text-[13px] font-medium text-muted-foreground">Bientôt</span>
              </span>
              <span className="px-1 pb-1">
                <span className="block text-[15px] font-semibold text-muted-foreground">Bureau moderne</span>
                <span className="block text-[13px] text-muted-foreground">Pas encore disponible.</span>
              </span>
            </label>
          </fieldset>
          {state.fieldErrors?.office && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">
              {state.fieldErrors.office}
            </p>
          )}
        </div>

        {state.message && (
          <p role="alert" className="mt-6 text-[14px] font-medium text-destructive">
            {state.message}
          </p>
        )}

        <div className="mt-8 flex justify-end gap-3">
          {step === 2 && (
            <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={pending}>
              Retour
            </Button>
          )}
          {/* key : « Continuer » et « Créer » sont à la même place. Sans clés distinctes, React réutiliserait le
              même bouton HTML en changeant son type pendant le clic, et le navigateur enverrait le formulaire
              avant que l'utilisateur ait vu l'étape 2. Avec des clés, l'ancien bouton est retiré. */}
          {step === 1 ? (
            <Button key="next" type="button" onClick={goNext}>
              Continuer
            </Button>
          ) : (
            <Button key="submit" type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer le projet"}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
