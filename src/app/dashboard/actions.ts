"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { session as sessionTable } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/dal";

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
