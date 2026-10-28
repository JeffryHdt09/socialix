// En-tête d'une page d'une campagne : titre et sous-titre à gauche (PAGES.md, fiche 3).
// Chaque page l'affiche elle-même : le titre appartient à la page, pas au cadre. À l'étape 6.4, la droite
// accueillera le bouton « Créer un post ».
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>
      </div>
    </header>
  );
}
