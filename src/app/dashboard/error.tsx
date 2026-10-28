"use client";

import { Button } from "@/components/ui/button";

// État « erreur » du tableau de bord (PAGES.md : ce qui s'est passé + comment réessayer).
// On n'affiche jamais le message technique de l'erreur : il peut révéler des détails de la base.
// Next le journalise déjà côté serveur.
// retry() redemande les données au serveur puis refait le rendu (guide « error.js » de Next 16 : à préférer à
// reset(), qui efface seulement l'erreur sans rien recharger, donc inutile si la panne vient de la base).
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-4 px-4 py-10 sm:px-10">
      <h1 className="text-[28px] font-bold tracking-tight">Tes campagnes n’ont pas pu être chargées</h1>
      <p className="text-[15px] text-muted-foreground">
        Le problème vient de notre côté ou de ta connexion. Réessaie dans un instant.
      </p>
      <Button onClick={() => retry()}>Réessayer</Button>
    </main>
  );
}
