import "server-only";

import { google } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Les modèles que les agents peuvent utiliser, du premier choix au dernier recours (PLAN.md, décision D9 : une LISTE
// ordonnée, jamais un modèle écrit en dur dans le code des agents). Quand un modèle répond par une erreur de quota (429),
// de panne ou de modèle retiré (404), on essaie le suivant (voir chat.ts) : c'est ainsi qu'OpenRouter « prend la relève »
// quand l'offre gratuite de Gemini est épuisée.
//
// Un nom de modèle s'écrit « fournisseur:modèle » (« google:gemini-2.5-flash », « openrouter:google/gemma-4-31b-it:free »).
// Sans préfixe, c'est Google : les anciens messages en base gardent leur nom d'origine.
const GOOGLE_MODELS = ["google:gemini-2.5-flash", "google:gemini-3.5-flash"];

// Modèles OpenRouter, séparés par des virgules dans OPENROUTER_MODELS (.env.local). Par défaut : des modèles GRATUITS (nom
// terminé par « :free »), choisis parce qu'ils savent produire une sortie structurée, ce dont le Maître a besoin.
// Mesuré le 28/10/2026 sur l'annuaire public d'OpenRouter : la liste gratuite change souvent, un modèle retiré donne un 404
// et on passe simplement au suivant. Pour des modèles payants plus puissants, on les écrit ici AVANT les gratuits.
const DEFAULT_OPENROUTER_MODELS = ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "nvidia/nemotron-3-ultra-550b-a55b:free"];

export function openRouterModels(env: NodeJS.ProcessEnv = process.env): string[] {
  const custom = env.OPENROUTER_MODELS?.split(",").map((m) => m.trim()).filter(Boolean);
  return (custom && custom.length > 0 ? custom : DEFAULT_OPENROUTER_MODELS).map((m) => `openrouter:${m}`);
}

// La liste complète. OpenRouter n'y figure que si sa clé est présente : sans clé, on ne perd pas de temps à l'appeler.
export function buildChatModels(env: NodeJS.ProcessEnv = process.env): string[] {
  return [...GOOGLE_MODELS, ...(env.OPENROUTER_API_KEY ? openRouterModels(env) : [])];
}

export const CHAT_MODELS = buildChatModels();

// Le fournisseur d'un nom de modèle (« google » par défaut). Sert à savoir si deux modèles dépendent de la même clé.
export function providerOf(name: string): string {
  const i = name.indexOf(":");
  return i > 0 && ["google", "openrouter"].includes(name.slice(0, i)) ? name.slice(0, i) : "google";
}

// LE seul endroit qui connaît les fournisseurs. En ajouter un, c'est installer son paquet et ajouter une branche ici : le
// reste (consignes, historique, repli, base de données) ne bouge pas. Les messages sont enregistrés en simple texte.
export function getModel(name: string) {
  const provider = providerOf(name);
  const bare = name.startsWith(`${provider}:`) ? name.slice(provider.length + 1) : name;
  if (provider === "openrouter") return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })(bare);
  return google(bare);
}
