import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { documents } from "@/db/schema";
import { MAX_DOCUMENTS_PER_PROJECT } from "@/lib/documents";
import { getOwnedProject } from "@/lib/ownership";

// La page Documents (chapitre 12) : lire les documents d'un projet et en changer l'état. Comme partout, le propriétaire
// (`userId`) vient de la SESSION, jamais d'un paramètre de l'appelant, et le projet est revérifié ici.

export const DOCUMENT_STATUSES = ["to_review", "validated", "rejected"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export type DocumentView = {
  id: string;
  title: string;
  kind: string;
  content: string;
  status: DocumentStatus;
  author: string;
  createdAt: Date;
};

// Tous les documents du projet, du plus récent au plus ancien (le plafond par projet borne la liste).
// Liste vide si le projet n'est pas à la personne : on ne révèle pas qu'il existe.
export async function readProjectDocuments(userId: string, projectId: string): Promise<DocumentView[]> {
  if (!(await getOwnedProject(userId, projectId))) return [];
  const rows = await db
    .select({ id: documents.id, title: documents.title, kind: documents.kind, content: documents.content, status: documents.status, author: documents.author, createdAt: documents.createdAt })
    .from(documents)
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(documents.createdAt))
    .limit(MAX_DOCUMENTS_PER_PROJECT);
  return rows;
}

export type SetStatusResult = { ok: true } | { ok: false; error: string };

// Change l'état d'un document : à relire ↔ validé ↔ écarté. C'est la PERSONNE qui décide (un agent n'a aucun outil pour ça).
// Le document est cherché par son identifiant ET son projet ET le propriétaire du projet : un identifiant d'un autre projet
// ne trouve rien. Les valeurs qui arrivent d'une action serveur ne sont pas crues : elles sont revérifiées ici.
export async function setDocumentStatusAs(userId: string, projectId: string, documentId: string, to: string): Promise<SetStatusResult> {
  if (!z.uuid().safeParse(documentId).success || !(DOCUMENT_STATUSES as readonly string[]).includes(to)) return { ok: false, error: "Demande invalide." };
  if (!(await getOwnedProject(userId, projectId))) return { ok: false, error: "Projet introuvable." };
  const updated = await db
    .update(documents)
    .set({ status: to as DocumentStatus })
    .where(and(eq(documents.id, documentId), eq(documents.projectId, projectId), sql`${documents.status} <> ${to}`))
    .returning({ id: documents.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: "Ce document a déjà changé d’état ou n’existe plus." };
}
