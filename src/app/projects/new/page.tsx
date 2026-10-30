import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NewProjectForm } from "@/components/project/new-project-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { verifySession } from "@/lib/dal";

export const metadata: Metadata = { title: "Nouveau projet · Socialix" };

// Création de projet (PAGES.md, fiche 2). Page privée : sans session valide, redirection vers /sign-in.
export default function NewProjectPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col px-4 py-6 sm:px-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex min-h-11 items-center text-xl font-extrabold tracking-tight">
          Socialix
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center py-8">
        {/* La lecture de la session passe derrière un <Suspense> (Cache Components) */}
        <Suspense fallback={<FormSkeleton />}>
          <Form />
        </Suspense>
      </main>
    </div>
  );
}

async function Form() {
  await verifySession();
  return <NewProjectForm />;
}

function FormSkeleton() {
  return (
    <div
      role="status"
      aria-label="Chargement"
      className="flex w-full max-w-xl animate-pulse flex-col gap-4 rounded-xl border border-border bg-card p-8 motion-reduce:animate-none"
    >
      <div className="h-6 w-40 rounded-md bg-muted" />
      <div className="h-8 w-64 rounded-md bg-muted" />
      <div className="h-14 rounded-lg bg-muted" />
      <div className="h-24 rounded-lg bg-muted" />
    </div>
  );
}
