import "server-only";

import { APICallError, RetryError, ToolLoopAgent } from "ai";

import { instructionsFor } from "@/lib/agent-instructions";
import type { AgentId } from "@/lib/agents";
import { CHAT_MODELS, getModel } from "@/lib/models";

// Combien de messages de la conversation on renvoie au modèle (les plus récents) : au-delà, la requête grossit pour rien
// et consomme le quota gratuit.
export const MAX_HISTORY = 20;

export type ChatTurn = { role: "user" | "assistant"; content: string };

// Pourquoi aucun modèle n'a répondu : « quota » (limite gratuite atteinte, réessayer plus tard) ou « unavailable » (panne,
// clé refusée, modèles retirés…). On ne transmet jamais le texte de l'erreur d'origine : il peut contenir des détails internes.
export class ChatError extends Error {
  constructor(readonly reason: "quota" | "unavailable") {
    super(reason);
  }
}

// Le code HTTP de l'erreur d'un fournisseur, ou undefined si ce n'est pas une erreur d'API (réseau coupé, délai dépassé…).
// L'AI SDK ENVELOPPE l'erreur dans un RetryError dès qu'une relance est autorisée (maxRetries) : sans le déballer, un 429
// (quota) n'était pas reconnu et la personne lisait « n'a pas pu répondre » au lieu de « l'équipe fait une pause »
// (trouvé avec un vrai quota épuisé, pas avec les tests qui simulaient l'erreur).
export function statusOf(error: unknown): number | undefined {
  const inner = RetryError.isInstance(error) ? error.lastError : error;
  return APICallError.isInstance(inner) ? inner.statusCode : undefined;
}

// Faut-il essayer le modèle suivant ? Oui pour : modèle retiré (404), quota (429), délai dépassé, panne du fournisseur (5xx),
// réseau coupé, réponse vide. Non pour : requête refusée (400), clé refusée (401/403) : un autre modèle de la même clé
// ferait pareil, mieux vaut s'arrêter tout de suite.
export function canTryNextModel(error: unknown): boolean {
  const status = statusOf(error);
  return !(status !== undefined && [400, 401, 403].includes(status));
}

// Pose la question à l'agent, avec les consignes de son rôle et l'historique, en passant au modèle suivant si besoin.
// `models` est paramétrable pour les tests ; par défaut, la liste de models.ts.
export async function askAgent(agent: AgentId, history: ChatTurn[], models: readonly string[] = CHAT_MODELS): Promise<{ text: string; model: string }> {
  let sawQuota = false;
  for (const name of models) {
    try {
      // ToolLoopAgent : la boucle d'agent de l'AI SDK. Sans outil, elle fait un seul tour ; au chapitre 12, on lui
      // donnera des outils (`tools`) sans rien changer d'autre.
      const bot = new ToolLoopAgent({ id: agent, model: getModel(name), instructions: instructionsFor(agent), maxRetries: 1 });
      const result = await bot.generate({ messages: history.slice(-MAX_HISTORY), timeout: 30_000 });
      const text = result.text.trim();
      if (text) return { text, model: name };
      // Réponse vide (filtre de sécurité, modèle qui n'a rien dit) : on essaie le suivant
    } catch (error) {
      const status = statusOf(error);
      if (status === 429) sawQuota = true;
      // Journal serveur : le nom du modèle et le statut, jamais l'en-tête de la requête (il contient la clé)
      console.error(`Chat : le modèle ${name} a échoué (${status ?? (error instanceof Error ? error.name : "?")})`);
      if (!canTryNextModel(error)) throw new ChatError("unavailable");
    }
  }
  throw new ChatError(sawQuota ? "quota" : "unavailable");
}
