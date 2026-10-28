import "server-only";

import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { campaigns, messages } from "@/db/schema";
import { findAgent } from "@/lib/agents";
import { askAgent, ChatError, MAX_HISTORY } from "@/lib/chat";
import { type ChatMessage, MAX_MESSAGE_LENGTH, type SendResult } from "@/lib/chat-types";

// Le cœur du chat, SANS rien de propre à Next (ni cookies, ni session) : le propriétaire (`userId`) est un paramètre,
// que l'action serveur prend dans la session et que les tests donnent à la main. Seules l'action serveur et la DAL
// doivent appeler ces fonctions : le propriétaire vient toujours de la session, jamais d'une adresse ou d'un formulaire.

// Limite par personne (toutes campagnes confondues) : l'offre gratuite de Gemini a un quota partagé, et une boucle
// ou un clic fou ne doit pas le vider pour tout le monde.
export const MAX_MESSAGES_PER_MINUTE = 10;

const toChatMessage = (m: typeof messages.$inferSelect): ChatMessage => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString() });

// La campagne est-elle bien à cette personne ? Même règle d'isolation que partout : identifiant ET propriétaire.
async function ownsCampaign(userId: string, campaignId: string): Promise<boolean> {
  if (!z.uuid().safeParse(campaignId).success) return false;
  const [row] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))).limit(1);
  return !!row;
}

// Les derniers messages d'une conversation, du plus ancien au plus récent. Liste vide si la campagne n'est pas à la
// personne ou si l'agent n'existe pas (on ne révèle rien).
export async function readConversation(userId: string, campaignId: string, agentId: string, limit = 50): Promise<ChatMessage[]> {
  const agent = findAgent(agentId);
  if (!agent || !(await ownsCampaign(userId, campaignId))) return [];
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.campaignId, campaignId), eq(messages.agent, agent.id)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(limit);
  return rows.reverse().map(toChatMessage);
}

// Envoie un message à un agent : valide, vérifie la propriété, limite le débit, interroge le modèle, enregistre les deux
// messages. Si le modèle échoue, RIEN n'est enregistré (pas de message orphelin sans réponse) et la personne garde son
// texte dans la zone de saisie pour réessayer.
export async function sendMessageAs(userId: string, campaignId: string, agentId: string, rawText: string, models?: readonly string[]): Promise<SendResult> {
  const agent = findAgent(agentId);
  if (!agent || !(await ownsCampaign(userId, campaignId))) return { ok: false, error: "Cette conversation est introuvable." };

  const text = rawText.trim();
  if (text.length === 0) return { ok: false, error: "Écris un message avant d’envoyer." };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Message trop long : ${MAX_MESSAGE_LENGTH.toLocaleString("fr-FR")} caractères au maximum.` };

  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(campaigns, eq(campaigns.id, messages.campaignId))
    .where(and(eq(campaigns.userId, userId), eq(messages.role, "user"), gt(messages.createdAt, sql`now() - interval '1 minute'`)));
  if (recent >= MAX_MESSAGES_PER_MINUTE) return { ok: false, error: `Doucement : ${MAX_MESSAGES_PER_MINUTE} messages par minute au maximum. Réessaie dans un instant.` };

  const previous = await readConversation(userId, campaignId, agent.id, MAX_HISTORY - 1);
  const askedAt = new Date();

  let answer: { text: string; model: string };
  try {
    answer = await askAgent(agent.id, [...previous.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: text }], models);
  } catch (error) {
    if (error instanceof ChatError && error.reason === "quota") return { ok: false, error: "L’équipe fait une pause : la limite gratuite de l’IA est atteinte. Réessaie un peu plus tard." };
    return { ok: false, error: "L’agent n’a pas pu répondre pour le moment. Réessaie dans un instant." };
  }

  // Les deux messages dans UNE transaction (les deux ou aucun). Dates explicites : dans une transaction, now() est figé,
  // les deux messages auraient la même date et l'ordre de la conversation serait ambigu.
  const [userRow, agentRow] = await db.transaction(async (tx) => {
    const [u] = await tx.insert(messages).values({ campaignId, agent: agent.id, role: "user", content: text, createdAt: askedAt }).returning();
    const [a] = await tx.insert(messages).values({ campaignId, agent: agent.id, role: "assistant", content: answer.text, model: answer.model, createdAt: new Date() }).returning();
    return [u, a];
  });
  return { ok: true, messages: [toChatMessage(userRow), toChatMessage(agentRow)] };
}
