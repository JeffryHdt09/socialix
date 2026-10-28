// Squelette gris affiché le temps de lire la session (PAGES.md : pas de roue qui tourne).
// Aux formes du formulaire : titre, deux champs, bouton.
export function FormSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="flex animate-pulse flex-col gap-5 motion-reduce:animate-none">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-64 rounded-md bg-muted" />
      <div className="mt-4 h-11 rounded-[10px] bg-muted" />
      <div className="h-11 rounded-[10px] bg-muted" />
      <div className="h-11 rounded-[10px] bg-muted" />
    </div>
  );
}
