import "server-only";

import { and, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { campaigns, messages } from "@/db/schema";
import { findAgent } from "@/lib/agents";
import { askAgent, ChatError, type ChatTurn, MAX_HISTORY, type ModelOptions } from "@/lib/chat";
import { type ChatMessage, MAX_MESSAGE_LENGTH, type SendResult } from "@/lib/chat-types";
import { MasterPlanError, runMaster } from "@/lib/master";
import { ownsCampaign } from "@/lib/ownership";
import type { PlanDraft, ValidPlan } from "@/lib/plan";
import { readPlans } from "@/lib/plan-queries";
import { savePlan } from "@/lib/plan-service";

// Le cœur du chat, SANS rien de propre à Next (ni cookies, ni session) : le propriétaire (`userId`) est un paramètre,
// que l'action serveur prend dans la session et que les tests donnent à la main. Seules l'action serveur et la DAL
// doivent appeler ces fonctions : le propriétaire vient toujours de la session, jamais d'une adresse ou d'un formulaire.

// Limite par personne (toutes campagnes confondues) : l'offre gratuite de Gemini a un quota partagé, et une boucle
// ou un clic fou ne doit pas le vider pour tout le monde.
export const MAX_MESSAGES_PER_MINUTE = 10;

const toChatMessage = (m: typeof messages.$inferSelect): ChatMessage => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.toISOString(), planId: m.planId });

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
export async function sendMessageAs(userId: string, campaignId: string, agentId: string, rawText: string, options: ModelOptions = {}): Promise<SendResult> {
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
  const turns: ChatTurn[] = [...previous.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: text }];

  // Le Maître passe par runMaster (il peut répondre, poser une question ou produire un plan) ; les autres agents par askAgent.
  let reply: { text: string; model: string; plan?: { valid: ValidPlan; raw: PlanDraft } };
  try {
    if (agent.id === "maitre") {
      const m = await runMaster(turns, options);
      reply = { text: m.message, model: m.model, plan: m.plan && m.rawPlan ? { valid: m.plan, raw: m.rawPlan } : undefined };
    } else {
      reply = await askAgent(agent.id, turns, options);
    }
  } catch (error) {
    if (error instanceof ChatError && error.reason === "quota") return { ok: false, error: "L’équipe fait une pause : la limite gratuite de l’IA est atteinte. Réessaie un peu plus tard." };
    if (error instanceof MasterPlanError) return { ok: false, error: "Le Maître n’a pas réussi à établir un plan valide. Reformule ou précise ta demande." };
    return { ok: false, error: "L’agent n’a pas pu répondre pour le moment. Réessaie dans un instant." };
  }

  // Tout dans UNE transaction (tout ou rien) : ton message, le plan et ses tâches s'il y en a un, puis la réponse qui le présente.
  // Dates explicites : dans une transaction, now() est figé, les deux messages auraient la même date et l'ordre serait ambigu.
  try {
    const [userRow, agentRow] = await db.transaction(async (tx) => {
      const [u] = await tx.insert(messages).values({ campaignId, agent: agent.id, role: "user", content: text, createdAt: askedAt }).returning();
      const planId = reply.plan ? await savePlan(tx, campaignId, text, reply.plan.valid, reply.plan.raw) : null;
      const [a] = await tx.insert(messages).values({ campaignId, agent: agent.id, role: "assistant", content: reply.text, model: reply.model, planId, createdAt: new Date() }).returning();
      return [u, a];
    });
    // Le plan complet repart avec la réponse : l'interface affiche sa carte tout de suite, sans second aller-retour
    const [createdPlan] = agentRow.planId ? await readPlans(userId, campaignId, { onlyPlanId: agentRow.planId }) : [];
    return { ok: true, messages: [toChatMessage(userRow), toChatMessage(agentRow)], plan: createdPlan };
  } catch (error) {
    // Par exemple une campagne supprimée pendant que le modèle réfléchissait : rien n'est enregistré, et on le dit.
    // On ne journalise JAMAIS error.message : celui de la base recopie les paramètres de la requête, donc le texte écrit par la
    // personne (constaté en test). Seul le code d'erreur PostgreSQL (« 23503 »…) part dans le journal.
    const code = (error as { cause?: { code?: string } }).cause?.code;
    console.error("Chat : l'enregistrement a échoué", code ?? (error instanceof Error ? error.name : "?"));
    return { ok: false, error: "La réponse n’a pas pu être enregistrée. Réessaie dans un instant." };
  }
}
