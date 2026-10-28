import "server-only";

import { APICallError, type LanguageModel, RetryError, ToolLoopAgent } from "ai";

import { instructionsFor } from "@/lib/agent-instructions";
import type { AgentId } from "@/lib/agents";
import { CHAT_MODELS, getModel, providerOf } from "@/lib/models";

// Combien de messages de la conversation on renvoie au modèle (les plus récents) : au-delà, la requête grossit pour rien
// et consomme le quota gratuit.
export const MAX_HISTORY = 20;

export type ChatTurn = { role: "user" | "assistant"; content: string };

// La fenêtre d'historique envoyée au modèle : les MAX_HISTORY derniers échanges, SANS message d'assistant en tête. Gemini attend
// un historique qui commence par la personne (« first content must have role user », erreur 400 qui bloquait toute la
// conversation une fois la fenêtre tombée sur une réponse d'agent : remarque de CodeRabbit sur la PR n°8).
export function windowHistory(history: ChatTurn[]): ChatTurn[] {
  const recent = history.slice(-MAX_HISTORY);
  const firstUser = recent.findIndex((t) => t.role === "user");
  return firstUser === -1 ? [] : recent.slice(firstUser);
}

// Réglages d'un appel : la liste de modèles et la façon d'en fabriquer un. Les deux ont une valeur par défaut ; les tests
// les remplacent (liste inventée, faux modèle) pour vérifier le comportement sans appeler Gemini ni épuiser le quota.
// `teams` : les équipes activées du projet. Elles décident de la liste des agents annoncée dans les consignes.
// `extraInstructions` : consignes ajoutées après celles du rôle (l'exécution d'une tâche n'est pas une conversation).
// `onPlanCreated` : appelée après l'enregistrement d'un plan, pour lancer son exécution (par défaut : événement Inngest ;
// les tests la remplacent par une fonction vide).
export type ModelOptions = {
  models?: readonly string[];
  modelFactory?: (name: string) => LanguageModel;
  teams?: readonly string[];
  extraInstructions?: string;
  // Délai maximal d'une réponse, en millisecondes (30 s par défaut : quelqu'un attend). Une tâche de fond, que personne
  // n'attend, en demande davantage : les gros modèles gratuits d'OpenRouter mettent parfois plus de 30 s à répondre.
  timeoutMs?: number;
  onPlanCreated?: (planId: string) => Promise<void>;
};

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

// Un vrai modèle (« google:… », « openrouter:… ») qui vient de répondre « quota » (429) n'est pas réessayé pendant une minute :
// sans cela, chaque message (et chaque correction du Maître) reperdait ~10 secondes à retaper sur des modèles déjà épuisés
// (mesuré : 49 s pour un plan avec Gemini et deux modèles OpenRouter en quota). Mémoire du processus : une relance du serveur
// repart de zéro, ce qui est sans danger. Les noms sans préfixe (ceux des tests) ne sont jamais mis de côté.
export const QUOTA_COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();
const isRealModel = (name: string) => /^(google|openrouter):/.test(name);
export function clearModelCooldowns() {
  cooldownUntil.clear();
}

// Essaie `run` avec chaque modèle de la liste, dans l'ordre, jusqu'à ce que l'un réponde (`run` renvoie null pour dire
// « réponse vide, essaie le suivant »). Partagé par le chat simple et par le Maître : un seul endroit décide quand on
// change de modèle.
export async function withModelFallback<T>(models: readonly string[], run: (modelName: string) => Promise<T | null>): Promise<{ value: T; model: string }> {
  let sawQuota = false;
  let sawRefusal = false;
  // Fournisseurs dont la clé ou la requête a été refusée : leurs autres modèles feraient pareil, mais un AUTRE fournisseur
  // (OpenRouter après Gemini) a sa propre clé et peut très bien répondre.
  const refused = new Set<string>();
  const resting = models.filter((m) => isRealModel(m) && (cooldownUntil.get(m) ?? 0) > Date.now());
  // Si TOUS les modèles se reposent, on les essaie quand même : mieux vaut un 429 de plus qu'un refus sans essayer
  const candidates = resting.length === models.length ? models : models.filter((m) => !resting.includes(m));
  if (resting.length > 0 && candidates.length < models.length) sawQuota = true;
  for (const name of candidates) {
    if (refused.has(providerOf(name))) continue;
    try {
      const value = await run(name);
      if (value !== null) return { value, model: name };
    } catch (error) {
      const status = statusOf(error);
      if (status === 429) {
        sawQuota = true;
        if (isRealModel(name)) cooldownUntil.set(name, Date.now() + QUOTA_COOLDOWN_MS);
      }
      // Journal serveur : le nom du modèle et le statut, jamais l'en-tête de la requête (il contient la clé)
      console.error(`Chat : le modèle ${name} a échoué (${status ?? (error instanceof Error ? error.name : "?")})`);
      if (!canTryNextModel(error)) {
        refused.add(providerOf(name));
        sawRefusal = true;
      }
    }
  }
  // Quota seulement si rien d'autre ne l'explique : une clé refusée n'est pas « une pause », c'est une panne à corriger.
  throw new ChatError(sawQuota && !sawRefusal ? "quota" : "unavailable");
}

// Pose la question à l'agent, avec les consignes de son rôle et l'historique, en passant au modèle suivant si besoin.
export async function askAgent(agent: AgentId, history: ChatTurn[], options: ModelOptions = {}): Promise<{ text: string; model: string }> {
  const { models = CHAT_MODELS, modelFactory = getModel } = options;
  const { value, model } = await withModelFallback(models, async (name) => {
    // ToolLoopAgent : la boucle d'agent de l'AI SDK. Sans outil, elle fait un seul tour ; au chapitre 12, on lui
    // donnera des outils (`tools`) sans rien changer d'autre.
    const bot = new ToolLoopAgent({ id: agent, model: modelFactory(name), instructions: [instructionsFor(agent, options.teams), options.extraInstructions].filter(Boolean).join("\n\n"), maxRetries: 1 });
    const result = await bot.generate({ messages: windowHistory(history), timeout: options.timeoutMs ?? 30_000 });
    return result.text.trim() || null; // réponse vide (filtre de sécurité…) : on essaie le suivant
  });
  return { text: value, model };
}
