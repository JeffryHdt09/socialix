"use server";

import { getSession } from "@/lib/dal";
import { sendMessageAs } from "@/lib/chat-service";
import type { SendResult } from "@/lib/chat-types";
import { cancelPlanAs } from "@/lib/plan-queries";
import type { CancelResult } from "@/lib/plan-types";

// Envoie un message à un agent. Une action serveur est une adresse publique : rien de ce qui arrive n'est cru.
// Le propriétaire vient de la SESSION, jamais d'un paramètre ; la campagne, l'agent et le texte sont revérifiés
// dans sendMessageAs. Le navigateur ne parle jamais à Gemini : la clé reste ici, sur le serveur.
export async function sendMessage(campaignId: string, agentId: string, text: string): Promise<SendResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (typeof campaignId !== "string" || typeof agentId !== "string" || typeof text !== "string") return { ok: false, error: "Message invalide." };
  return sendMessageAs(session.user.id, campaignId, agentId, text);
}

// Annule un plan de la campagne (et ses tâches pas encore terminées). Mêmes règles : session obligatoire, propriétaire pris dans la session.
export async function cancelPlan(campaignId: string, planId: string): Promise<CancelResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (typeof campaignId !== "string" || typeof planId !== "string") return { ok: false, error: "Demande invalide." };
  return cancelPlanAs(session.user.id, campaignId, planId);
}
