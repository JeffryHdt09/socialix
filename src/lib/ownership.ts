import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { activeTeams, type ActiveTeamId } from "@/lib/agents";

// Ce projet est-il bien à cette personne ? Même règle d'isolation que partout : identifiant ET propriétaire.
// L'identifiant vient d'une adresse ou d'un formulaire : s'il n'a pas la forme d'un UUID, on ne le donne même pas à la base.
// À n'appeler qu'avec un `userId` pris dans la SESSION.
// Renvoie aussi les équipes activées : c'est d'elles que dépendent les agents que le projet peut employer.
export async function getOwnedProject(userId: string, projectId: string): Promise<{ id: string; teams: ActiveTeamId[] } | null> {
  if (!z.uuid().safeParse(projectId).success) return null;
  const [row] = await db.select({ id: projects.id, teams: projects.teams }).from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  return row ? { id: row.id, teams: activeTeams(row.teams) } : null;
}

export async function ownsProject(userId: string, projectId: string): Promise<boolean> {
  return (await getOwnedProject(userId, projectId)) !== null;
}
