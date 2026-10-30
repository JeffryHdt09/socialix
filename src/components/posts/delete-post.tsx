"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

// « Supprimer » avec confirmation (PAGES.md, fiche 6) : un premier clic demande confirmation, le second supprime. Le focus passe sur
// « Garder » (le choix sans danger) quand la question apparaît, et revient sur « Supprimer » si on renonce. `action` est une action
// serveur déjà liée au projet et au post par la page.
export function DeletePost({ title, action }: { title: string; action: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const keepRef = useRef<HTMLButtonElement>(null);
  const askRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) keepRef.current?.focus();
    else if (wasConfirming.current) askRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <Button ref={askRef} type="button" variant="outline" onClick={() => setConfirming(true)}>
        Supprimer<span className="sr-only"> le post « {title} »</span>
      </Button>
    );
  }
  return (
    <div role="group" aria-label={`Confirmer la suppression de « ${title} »`} className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive p-2">
      <p className="px-2 text-[14px]">Supprimer ce post ? C’est définitif.</p>
      <form action={action}>
        <Button type="submit" variant="destructive">
          Oui, supprimer
        </Button>
      </form>
      <Button ref={keepRef} type="button" variant="outline" onClick={() => setConfirming(false)}>
        Garder
      </Button>
    </div>
  );
}
