import "server-only"; // erreur de build si ce fichier est importé dans du code navigateur

import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { auth } from "@/lib/auth";
import { readConversation } from "@/lib/chat-service";
import { readPlans } from "@/lib/plan-queries";
import { queryOverviewUnchecked } from "@/lib/overview-queries";

// Couche d'accès aux données (DAL) : le vrai contrôle de sécurité, au plus près des données.
// Better Auth lit le cookie de session et vérifie en base que la session existe et n'a pas expiré.
// cache() : si plusieurs composants le demandent pendant une même requête, on ne lit la base qu'une fois.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

// À appeler en haut de chaque page privée : renvoie la session, ou redirige vers la connexion.
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
});

// Les projets de l'utilisateur connecté, le plus récent d'abord.
// Aucun paramètre « userId » : le propriétaire vient de la session, jamais de l'appelant. Il est donc
// impossible, par construction, de demander les projets de quelqu'un d'autre avec cette fonction.
export const getMyProjects = cache(async () => {
  const { user } = await verifySession();
  return db.select().from(projects).where(eq(projects.userId, user.id)).orderBy(desc(projects.createdAt));
});

// UN projet de l'utilisateur connecté, ou null. L'identifiant vient d'une adresse, donc d'un inconnu :
// - il doit avoir la forme d'un UUID, sinon on ne demande même pas à la base (une chaîne piégée ne l'atteint pas) ;
// - la recherche porte sur l'identifiant ET le propriétaire (la session) : un projet d'un autre ne se trouve pas.
// Dans les deux cas, le résultat est le même null : on ne révèle jamais qu'un projet existe chez quelqu'un d'autre.
export const getMyProject = cache(async (projectId: string) => {
  const { user } = await verifySession();
  if (!z.uuid().safeParse(projectId).success) return null;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);
  return project ?? null;
});

// Pour une page ou un layout : le projet, ou l'écran « introuvable » (404). À appeler au début de chaque
// page d'un projet.
export async function requireMyProject(projectId: string) {
  const project = await getMyProject(projectId);
  if (!project) notFound();
  return project;
}

// Les chiffres de la vue d'ensemble d'un projet. La propriété est vérifiée ICI, avant toute lecture des posts :
// queryOverviewUnchecked ne le fait pas (voir son avertissement), il ne doit être appelé que par cette fonction.
export const getOverview = cache(async (projectId: string) => {
  await requireMyProject(projectId);
  return queryOverviewUnchecked(projectId);
});

// La conversation de l'utilisateur connecté avec un agent d'une de ses projets (liste vide si le projet n'est pas à lui).
export const getConversation = cache(async (projectId: string, agentId: string) => {
  const { user } = await verifySession();
  return readConversation(user.id, projectId, agentId);
});

// Les plans du Maître pour un projet de l'utilisateur connecté (liste vide si le projet n'est pas à lui).
export const getPlans = cache(async (projectId: string) => {
  const { user } = await verifySession();
  return readPlans(user.id, projectId);
});
