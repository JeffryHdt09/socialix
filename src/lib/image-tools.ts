import "server-only";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { AGENT_IMAGE_TYPES, type AgentImageType, agentImageUrl, uploadAgentImage } from "@/lib/storage";

// Génération d'image pour les agents (chapitre 12). Le modèle d'image et le stockage sont des paramètres : les tests les
// remplacent, et changer de modèle ne touche pas aux outils.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_PROMPT_CHARS = 600;

// Les modèles d'image essayés dans l'ordre (IMAGE_MODELS="a,b" dans .env.local pour en changer). Les modèles d'image de Gemini
// ne sont pas dans l'offre gratuite de l'API : sans facturation, ils répondent 429 et l'outil le dit, sans rien inventer.
export function imageModels(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = (env.IMAGE_MODELS ?? "").split(",").map((m) => m.trim()).filter(Boolean);
  return configured.length > 0 ? configured : ["gemini-2.5-flash-image"];
}

export type GeneratedImage = { bytes: Uint8Array; mediaType: string };
export type ImageGenerator = (model: string, prompt: string) => Promise<GeneratedImage | null>;

const geminiImage: ImageGenerator = async (model, prompt) => {
  const r = await generateText({ model: google(model), prompt, maxRetries: 0, timeout: 60_000 });
  const file = r.files.find((f) => f.mediaType.startsWith("image/"));
  return file ? { bytes: file.uint8Array, mediaType: file.mediaType } : null;
};

// Reconnaît le vrai format d'après les premiers octets : le type annoncé par un fournisseur n'est pas cru.
export function sniffImageType(b: Uint8Array): AgentImageType | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export type ImageResult = { ok: true; key: string; url: string; model: string } | { ok: false; reason: "invalide" | "indisponible" | "quota" };

export async function generateAgentImage(
  input: { userId: string; projectId: string; description: string },
  deps: { models?: string[]; generate?: ImageGenerator; upload?: typeof uploadAgentImage; urlOf?: (key: string) => string } = {},
): Promise<ImageResult> {
  const description = input.description.trim();
  if (!description || description.length > MAX_IMAGE_PROMPT_CHARS) return { ok: false, reason: "invalide" };
  const { models = imageModels(), generate = geminiImage, upload = uploadAgentImage, urlOf = agentImageUrl } = deps;
  // Consigne de sécurité ajoutée par NOUS : pas de texte lisible (les modèles d'image écrivent mal) ni de marque existante
  const prompt = `${description}\n\nImage sans aucun texte lisible, sans logo ni marque existante, sans visage de personne réelle identifiable.`;
  let sawQuota = false;
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
      // Journal : le modèle et le statut, jamais le texte de l'erreur (il peut contenir la requête)
      console.error(`Image : le modèle ${model} a échoué (${status ?? (error instanceof Error ? error.name : "?")})`);
    }
  }
  return { ok: false, reason: sawQuota ? "quota" : "indisponible" };
}
