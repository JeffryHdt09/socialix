import "server-only";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { flowEnabled, flowImage } from "@/lib/flow-image";
import { AGENT_IMAGE_TYPES, type AgentImageType, agentImageUrl, uploadAgentImage } from "@/lib/storage";

// Génération d'image pour les agents (chapitre 12). Le modèle d'image et le stockage sont des paramètres : les tests les
// remplacent, et changer de modèle ne touche pas aux outils.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PROMPT_CHARS = 600;

// Les modèles d'image essayés dans l'ordre (IMAGE_MODELS="a,b" dans .env.local pour en changer). Un nom s'écrit
// « fournisseur:modèle » : « openrouter:openai/gpt-image-2 » (payant au centime, mesuré par OpenRouter à environ 0,006 $ l'image
// 1024×1024) ou « google:gemini-2.5-flash-image ». Les modèles d'image de Gemini ne sont pas dans l'offre gratuite de l'API : sans
// facturation, ils répondent 429. Sans crédits chez OpenRouter, l'API répond 402. L'outil le dit alors, sans rien inventer.
export function imageModels(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.IMAGE_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  if (configured.length > 0) return configured;
  // Flow (gratuit, local) passe en premier SI la personne l'a activé (FLOW_IMAGES=1), puis les API payantes ou limitées
  return [...(flowEnabled(env) ? ["flow:nano-banana"] : []), "openrouter:openai/gpt-image-2", "google:gemini-2.5-flash-image"];
}

export type GeneratedImage = { bytes: Uint8Array; mediaType: string };
export type ImageGenerator = (model: string, prompt: string) => Promise<GeneratedImage | null>;

const geminiImage: ImageGenerator = async (model, prompt) => {
  const r = await generateText({ model: google(model), prompt, maxRetries: 0, timeout: 60_000 });
  const file = r.files.find((f) => f.mediaType.startsWith("image/"));
  return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
};

// L'API d'images d'OpenRouter : POST /api/v1/images, l'image revient en base64 dans data[0].b64_json. Un statut d'erreur est
// joint à l'erreur (402 = plus de crédits, 429 = limite) pour que generateAgentImage sache pourquoi. Sans clé, on passe au suivant.
export async function openRouterImage(model: string, prompt: string, deps: { fetch?: typeof fetch; apiKey?: string | undefined } = {}): Promise<GeneratedImage | null> {
  const apiKey = "apiKey" in deps ? deps.apiKey : process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  const doFetch = deps.fetch ?? fetch;
  const res = await doFetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, prompt, aspect_ratio: "1:1", resolution: "1K" }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw Object.assign(new Error("openrouter"), { statusCode: res.status });
  const body = (await res.json()) as { data?: { b64_json?: string; media_type?: string }[] };
  const item = body.data?.[0];
  if (!item?.b64_json) return null;
  return { bytes: Uint8Array.from(Buffer.from(item.b64_json, "base64")), mediaType: item.media_type ?? "image/png" };
}

// Aiguillage selon le fournisseur écrit dans le nom du modèle (sans préfixe : Google, comme avant).
const defaultGenerator: ImageGenerator = (model, prompt) => {
  if (model.startsWith("flow:")) return flowEnabled() ? flowImage(prompt) : Promise.resolve(null); // jamais sans l'accord de la personne
  return model.startsWith("openrouter:") ? openRouterImage(model.slice("openrouter:".length), prompt) : geminiImage(model.replace(/^google:/, ""), prompt);
};

// Reconnaît le vrai format d'après les premiers octets : le type annoncé par un fournisseur n'est pas cru.
export function sniffImageType(b: Uint8Array): AgentImageType | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export type ImageResult = { ok: true; key: string; url: string; model: string } | { ok: false; reason: "invalide" | "indisponible" | "quota" | "credits" };

export async function generateAgentImage(
  input: { userId: string; projectId: string; description: string },
  deps: { models?: string[]; generate?: ImageGenerator; upload?: typeof uploadAgentImage; urlOf?: (key: string) => string } = {},
): Promise<ImageResult> {
  const description = input.description.trim();
  if (!description || description.length > MAX_IMAGE_PROMPT_CHARS) return { ok: false, reason: "invalide" };
  const { models = imageModels(), generate = defaultGenerator, upload = uploadAgentImage, urlOf = agentImageUrl } = deps;
  // Consigne ajoutée par NOUS, en anglais (les modèles d'image la comprennent mieux) : pas de texte lisible (ils écrivent mal),
  // pas de marque existante, pas de personne réelle identifiable
  const prompt = `${description}\n\nThe image must contain no readable text or letters, no logos or existing brands, and no identifiable real person.`;
  let sawQuota = false;
  let sawCredits = false;
  for (const model of models) {
    try {
      const img = await generate(model, prompt);
      if (!img || img.bytes.length === 0 || img.bytes.length > MAX_IMAGE_BYTES) continue;
      const type = sniffImageType(img.bytes);
      if (!type || !(type in AGENT_IMAGE_TYPES)) continue;
      const key = await upload(input.userId, input.projectId, img.bytes, type);
      return { ok: true, key, url: urlOf(key), model };
    } catch (error) {
      const status = (error as { statusCode?: number; lastError?: { statusCode?: number } }).statusCode ?? (error as { lastError?: { statusCode?: number } }).lastError?.statusCode;
      if (status === 429) sawQuota = true;
      if (status === 402) sawCredits = true;
      // Journal : le modèle et le statut, jamais le texte de l'erreur (il peut contenir la requête)
      console.error(`Image : le modèle ${model} a échoué (${status ?? (error instanceof Error ? error.name : "?")})`);
    }
  }
  return { ok: false, reason: sawCredits ? "credits" : sawQuota ? "quota" : "indisponible" };
}
