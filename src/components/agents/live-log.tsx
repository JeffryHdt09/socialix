// Le « Journal en direct » (PAGES.md, fiche 5) : heure · agent · événement, en mono. Il n'existe pas encore, les
// événements viendront des tâches des agents (chapitres 10 et 11) : on le dit au lieu d'inventer des lignes.
export function LiveLog() {
  return (
    <section aria-labelledby="journal-titre">
      <h2 id="journal-titre" className="text-[13px] font-medium text-muted-foreground">
        Journal en direct
      </h2>
      <p className="mt-3 rounded-xl border border-dashed border-border p-5 font-mono text-[13px] leading-relaxed text-muted-foreground">
        Rien pour l’instant. Chaque événement des agents s’affichera ici : heure, agent, ce qu’il fait.
      </p>
    </section>
  );
}
