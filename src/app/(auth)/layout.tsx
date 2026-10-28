import Link from "next/link";

import { OfficeScene } from "@/components/office/office-scene";
import { ThemeToggle } from "@/components/theme-toggle";

// Cadre des pages de connexion et d'inscription (PAGES.md, fiche 1).
// Le dossier (auth) entre parenthèses regroupe les pages sans apparaître dans l'adresse.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-2">
      <div className="flex flex-col bg-card px-4 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="inline-flex min-h-11 items-center text-xl font-extrabold tracking-tight text-foreground">
            Socialix
          </Link>
          <ThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
      </div>

      {/* Colonne droite, toujours en thème Nuit, masquée sur téléphone. */}
      <aside className="hidden flex-col justify-center gap-6 bg-nuit-fond p-10 lg:flex">
        <OfficeScene theme="nuit" />
        <p className="text-[20px] font-semibold text-nuit-encre">Ton équipe d’agents t’attend.</p>
      </aside>
    </div>
  );
}
