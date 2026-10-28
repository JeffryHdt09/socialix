import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getMyProjects } from "@/lib/dal";
import { LAST_PROJECT_COOKIE } from "@/lib/last-project";

export const metadata: Metadata = { title: "Socialix" };

// /dashboard n'affiche rien lui-même : il envoie vers le bon endroit (PAGES.md, fiche 1).
// Sans projet, vers le formulaire de création ; sinon vers la vue d'ensemble du projet ouvert en dernier.
export default function DashboardPage() {
  // Lire la session et les cookies se fait à chaque requête : derrière un <Suspense> (Cache Components).
  return (
    <Suspense fallback={<RedirectSkeleton />}>
      <GoToProject />
    </Suspense>
  );
}

// Promise<never> : cette fonction se termine toujours par une redirection, elle ne renvoie jamais rien à afficher.
async function GoToProject(): Promise<never> {
  const projects = await getMyProjects(); // vérifie aussi la session ; le plus récent d'abord
  if (projects.length === 0) redirect("/projects/new");

  // Le cookie n'est qu'une préférence : on le compare aux projets de l'utilisateur connecté.
  // Absent, périmé, falsifié ou venant d'un autre compte, il est ignoré et on prend le plus récent.
  const remembered = (await cookies()).get(LAST_PROJECT_COOKIE)?.value;
  const target = projects.find((project) => project.id === remembered) ?? projects[0];

  redirect(`/dashboard/${target.id}/overview`);
}

function RedirectSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10 sm:px-10">
      <div role="status" aria-label="Chargement" className="h-8 w-56 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
    </main>
  );
}
