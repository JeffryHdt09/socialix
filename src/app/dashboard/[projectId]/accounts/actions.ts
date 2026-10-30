"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { linkAccountAs, unlinkAccountAs } from "@/lib/account-service";
import { getSession } from "@/lib/dal";
import { isUuid } from "@/lib/post-queries";

// Lier et retirer un compte (chapitre 14). Comme toutes les actions : le propriétaire vient de la SESSION, jamais d'un paramètre, et le
// projet est revérifié dans le service. Une action qui échoue ne reste pas muette : on revient sur la page avec un CODE court, que la
// page traduit en texte fixe (jamais un texte venu de l'adresse).

const accountsPath = (projectId: string) => `/dashboard/${projectId}/accounts`;

function done(projectId: string, result: { ok: boolean; code?: string }) {
  revalidatePath(accountsPath(projectId));
  revalidatePath(`/dashboard/${projectId}/posts`); // la liste des réseaux utilisables par un post en dépend
  if (!result.ok && result.code) redirect(`${accountsPath(projectId)}?erreur=${result.code}`);
}

export async function linkAccountAction(projectId: string, channelId: string): Promise<void> {
  const session = await getSession();
  if (!session || !isUuid(projectId) || typeof channelId !== "string" || channelId.length === 0 || channelId.length > 200) return;
  done(projectId, await linkAccountAs(session.user.id, projectId, channelId));
}

export async function unlinkAccountAction(projectId: string, accountId: string): Promise<void> {
  const session = await getSession();
  if (!session || !isUuid(projectId) || !isUuid(accountId)) return;
  done(projectId, await unlinkAccountAs(session.user.id, projectId, accountId));
}
