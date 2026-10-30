"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession } from "@/lib/dal";
import { setDocumentStatusAs } from "@/lib/document-queries";

// Valide, écarte ou remet « à relire » un document. Une action serveur est une adresse publique : la session est
// revérifiée (même si la page l'était déjà), le propriétaire vient de la session, et tout le reste est revérifié dans
// setDocumentStatusAs. Les trois premiers paramètres sont liés au formulaire par la carte (`.bind`), pas saisis par la personne.
export async function changeDocumentStatus(projectId: string, documentId: string, to: string): Promise<void> {
  const session = await getSession();
  // Le projet doit avoir la forme d'un UUID avant d'entrer dans une adresse à rafraîchir
  if (!session || !z.uuid().safeParse(projectId).success || typeof documentId !== "string" || typeof to !== "string") return;
  await setDocumentStatusAs(session.user.id, projectId, documentId, to);
  // Qu'il ait réussi ou non, la page se relit et montre l'état réel (un document déjà changé ailleurs s'affiche tel qu'il est).
  revalidatePath(`/dashboard/${projectId}/documents`);
}
