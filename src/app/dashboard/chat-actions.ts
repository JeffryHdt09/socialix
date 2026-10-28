"use server";

import { getSession } from "@/lib/dal";
import { sendMessageAs } from "@/lib/chat-service";
import type { SendResult } from "@/lib/chat-types";

// Envoie un message à un agent. Une action serveur est une adresse publique : rien de ce qui arrive n'est cru.
// Le propriétaire vient de la SESSION, jamais d'un paramètre ; la campagne, l'agent et le texte sont revérifiés
// dans sendMessageAs. Le navigateur ne parle jamais à Gemini : la clé reste ici, sur le serveur.
export async function sendMessage(campaignId: string, agentId: string, text: string): Promise<SendResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (typeof campaignId !== "string" || typeof agentId !== "string" || typeof text !== "string") return { ok: false, error: "Message invalide." };
  return sendMessageAs(session.user.id, campaignId, agentId, text);
}
