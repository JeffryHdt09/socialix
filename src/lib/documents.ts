import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { documents } from "@/db/schema";
import { scanForInjection } from "@/lib/prompt-safety";

// Les documents du projet (chapitre 12) : ce que les agents produisent et que l'étape suivante relit.
// Ces fonctions reçoivent le PROJET de l'extérieur (jamais du modèle) : l'appelant (un outil d'agent, une page) l'a déjà
// vérifié. Elles ne cherchent jamais « par identifiant seul » : tout filtre sur le projet.

// Les types de documents que les agents peuvent enregistrer. La liste grandira avec les domaines (une entrée par type).
export const DOCUMENT_KINDS = ["etude", "offre", "script", "page_vente", "proposition", "autre"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

// Le nom affiché de chaque type (page Documents, outils).
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  etude: "Étude",
  offre: "Offre",
  script: "Script",
  page_vente: "Page de vente",
  proposition: "Proposition",
  autre: "Autre",
};

export const MAX_DOCUMENT_CHARS = 20_000; // même plafond que la base (check documents_content_length)
export const MAX_TITLE_CHARS = 120;
// Plafonds contre une boucle de modèle qui enregistrerait sans fin : par tâche, et par projet.
export const MAX_DOCUMENTS_PER_TASK = 5;
export const MAX_DOCUMENTS_PER_PROJECT = 300;
// Ce qu'on remet à un agent quand il relit un document (le reste est coupé, avec une mention), et combien de documents d'un coup.
export const READ_CHARS_PER_DOCUMENT = 6_000;
export const MAX_READ_DOCUMENTS = 5;

export type SaveResult = { ok: true; id: string } | { ok: false; reason: "invalide" | "trop_de_documents" };

export async function saveDocument(input: { projectId: string; taskId?: string; author: string; kind: DocumentKind; title: string; content: string }): Promise<SaveResult> {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || title.length > MAX_TITLE_CHARS || !content || content.length > MAX_DOCUMENT_CHARS || !DOCUMENT_KINDS.includes(input.kind)) return { ok: false, reason: "invalide" };

  // Les plafonds et l'insertion sous un VERROU propre au projet (dans une transaction) : sans lui, dix appels simultanés
  // comptaient tous « 0 document » avant d'insérer, et la limite ne servait à rien. Le verrou se libère à la fin de la transaction.
  const taskLimit = input.taskId ? sql`(select count(*) from documents where task_id = ${input.taskId}) < ${MAX_DOCUMENTS_PER_TASK}` : sql`true`;
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.projectId}))`);
    return tx.execute(sql`
      insert into documents (project_id, task_id, kind, title, content, status, author)
      select ${input.projectId}, ${input.taskId ?? null}, ${input.kind}, ${title}, ${content}, 'to_review', ${input.author}
      where (select count(*) from documents where project_id = ${input.projectId}) < ${MAX_DOCUMENTS_PER_PROJECT} and ${taskLimit}
      returning id`);
  });
  const id = rows[0]?.id as string | undefined;
  return id ? { ok: true, id } : { ok: false, reason: "trop_de_documents" };
}

export type ReadableDocument = { id: string; titre: string; type: string; statut: "a_relire" | "valide"; auteur: string; contenu: string };

const STATUS_LABEL = { to_review: "a_relire", validated: "valide" } as const;

// Les documents qu'un agent peut relire : ceux du projet, sauf les écartés, du plus récent au plus ancien. Le statut est
// rendu avec le document : « valide » (la personne l'a approuvé) ou « a_relire » (pas encore). Un agent ne doit s'appuyer
// sans réserve que sur un document validé.
// Un document dont le texte ressemble à une consigne cachée est remplacé par une mention : l'agent suivant ne le lit pas.
export async function readDocuments(projectId: string, options: { kind?: DocumentKind; limit?: number } = {}): Promise<ReadableDocument[]> {
  const limit = Math.min(Math.max(options.limit ?? MAX_READ_DOCUMENTS, 1), MAX_READ_DOCUMENTS);
  const where = options.kind
    ? and(eq(documents.projectId, projectId), sql`${documents.status} <> 'rejected'`, eq(documents.kind, options.kind))
    : and(eq(documents.projectId, projectId), sql`${documents.status} <> 'rejected'`);
  const rows = await db.select().from(documents).where(where).orderBy(desc(documents.createdAt)).limit(limit);
  return rows.map((r) => {
    const safe = scanForInjection(r.content).safe;
    const clipped = r.content.length > READ_CHARS_PER_DOCUMENT ? `${r.content.slice(0, READ_CHARS_PER_DOCUMENT)}\n[… document coupé]` : r.content;
    return {
      id: r.id,
      titre: r.title,
      type: r.kind,
      statut: STATUS_LABEL[r.status as keyof typeof STATUS_LABEL],
      auteur: r.author,
      contenu: safe ? clipped : "(contenu écarté : il contenait des consignes suspectes)",
    };
  });
}
