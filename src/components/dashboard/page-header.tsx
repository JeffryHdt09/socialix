import { CreatePostMenu } from "@/components/dashboard/create-post-menu";

// En-tête d'une page d'un projet (PAGES.md, fiche 3) : titre et sous-titre à gauche, bouton « Créer un post »
// à droite. Chaque page l'affiche elle-même : le titre appartient à la page, pas au cadre.
// Pas de champ de recherche pour l'instant : il n'y a encore rien à chercher (ni post, ni agent). Il
// arrivera avec le chapitre 13 ; un champ qui ne cherche rien serait un faux contrôle.
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>
      </div>
      <CreatePostMenu />
    </header>
  );
}
