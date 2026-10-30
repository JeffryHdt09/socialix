"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { session as sessionTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { PROJECT_SECTIONS } from "@/lib/project-sections";
import { getMyProject, getSession } from "@/lib/dal";
import { rememberProject } from "@/lib/last-project";

// Déconnexion qui ne ment pas. authClient.signOut() de Better Auth efface le cookie et répond « succès »
// même si la suppression de la session en base a échoué (il note l'erreur dans le journal, c'est tout).
// Le jeton resterait alors utilisable par quiconque l'aurait copié. Ici, on supprime d'abord la session
// en base, et on n'efface le cookie qu'après : si la base échoue, on le dit.
export async function signOutAction(): Promise<{ ok: boolean }> {
  const current = await getSession();
  if (!current) return { ok: true }; // déjà déconnecté

  try {
    await db.delete(sessionTable).where(eq(sessionTable.token, current.session.token));
  } catch (error) {
    console.error("Déconnexion : la session n'a pas pu être supprimée en base", error);
    return { ok: false };
  }

  // Session supprimée en base : on peut effacer le cookie (nextCookies() le permet dans une action serveur).
  await auth.api.signOut({ headers: await headers() });
  return { ok: true };
}

// Change de projet depuis le sélecteur du menu : mémorise le choix (cookie), puis ouvre la MÊME section
// dans la nouveau projet (on reste sur « Calendrier » en passant d'une marque à l'autre).
// Une action serveur est une adresse publique : rien de ce qui arrive n'est cru.
// - le projet est recherchée par identifiant ET propriétaire (getMyProject) ; sinon retour à /dashboard,
//   sans dire si elle existe ;
// - la section doit figurer dans la liste du menu, sinon on retombe sur la vue d'ensemble : impossible de
//   rediriger vers une adresse inventée.
export async function selectProject(projectId: string, section: string): Promise<void> {
  const project = await getMyProject(projectId);
  if (!project) redirect("/dashboard");
  const safeSection = PROJECT_SECTIONS.find((s) => s.slug === section)?.slug ?? "overview";
  await rememberProject(project.id);
  redirect(`/dashboard/${project.id}/${safeSection}`);
}
