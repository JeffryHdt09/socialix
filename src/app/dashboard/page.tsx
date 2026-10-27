import type { Metadata } from "next";
import { Suspense } from "react";

import { verifySession } from "@/lib/dal";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Tableau de bord · Socialix" };

// Page privée provisoire : le vrai tableau de bord (menu, campagnes) arrive aux chapitres 5 et 6.
// L'en-tête est statique et part tout de suite ; seule la carte dépend de la session, d'où le <Suspense>.
export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:px-10">
      <header className="flex items-center justify-between gap-4">
        <span className="text-xl font-extrabold tracking-tight">Socialix</span>
        <SignOutButton />
      </header>

      <Suspense fallback={<WelcomeSkeleton />}>
        <Welcome />
      </Suspense>
    </main>
  );
}

async function Welcome() {
  // Contrôle de sécurité : sans session valide en base, redirection vers /sign-in.
  const { user } = await verifySession();

  return (
    <section className="rounded-2xl border border-filet bg-surface p-6">
      <h1 className="text-[28px] font-bold tracking-tight">Bonjour, {user.name}</h1>
      <p className="mt-1 text-[15px] text-secondaire">
        Connecté avec <span className="font-mono text-[13px]">{user.email}</span>
      </p>
      <p className="mt-6 text-[15px]">
        Aucune campagne pour l’instant. La création de campagne arrive dans un prochain chapitre.
      </p>
    </section>
  );
}

function WelcomeSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className="flex animate-pulse flex-col gap-3 rounded-2xl border border-filet bg-surface p-6 motion-reduce:animate-none"
    >
      <div className="h-8 w-56 rounded-md bg-surface-2" />
      <div className="h-4 w-72 rounded-md bg-surface-2" />
      <div className="mt-4 h-4 w-full rounded-md bg-surface-2" />
    </div>
  );
}
