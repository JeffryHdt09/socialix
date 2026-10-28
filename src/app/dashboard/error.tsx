"use client";

import { Button } from "@/components/ui/button";

// État « erreur » du tableau de bord (PAGES.md : ce qui s'est passé + comment réessayer).
// On n'affiche jamais le message technique de l'erreur : il peut révéler des détails de la base.
// Next le journalise déjà côté serveur.
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-4 px-4 py-10 sm:px-10">
      <h1 className="text-[28px] font-bold tracking-tight">Tes campagnes n’ont pas pu être chargées</h1>
      <p className="text-[15px] text-muted-foreground">
        Le problème vient de notre côté ou de ta connexion. Réessaie dans un instant.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </main>
  );
}
