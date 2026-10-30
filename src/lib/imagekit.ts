import "server-only";

import { sniffImageType } from "@/lib/image-tools";
import { buildTransformation, type RetouchSpec } from "@/lib/retouch-rules";

// ImageKit (chapitre 13) : un service qui transforme une image par une adresse (« …/tr:ar-4-5,w-1080/… »). Nous l'utilisons comme
// ATELIER, pas comme stockage : l'image à retoucher y est envoyée, transformée, récupérée, puis supprimée d'ImageKit ; le résultat
// est rangé dans NOTRE stockage. La clé privée ne quitte jamais le serveur.
//
// Vérifié avec un vrai compte le 30/10/2026 (scripts/check-imagekit-real.mjs) : l'adresse d'envoi, les champs du formulaire, l'adresse
// de suppression et les transformations recadrage, noir et blanc, détourage IA et texte. Pas encore essayés en vrai : agrandir,
// améliorer et changer le fond. ImageKit doit pouvoir télécharger l'image à son adresse (le stockage Supabase le permet).

const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const API_URL = "https://api.imagekit.io/v1/files";
export const IMAGEKIT_FOLDER = "/socialix-tmp"; // dossier d'ImageKit qui ne contient que des fichiers de passage
export const MAX_RESULT_BYTES = 5 * 1024 * 1024;
const PROCESSING_RETRIES = 8; // une transformation IA peut prendre de quelques secondes à une minute
const PROCESSING_PAUSE_MS = 6_000;
// Plafond de TOUTE la retouche (envoi, attente, récupération). Sans lui, 8 essais de 90 s plus les pauses pouvaient tenir une
// action serveur ouverte plus de 12 minutes, bien au-delà de ce qu'un hébergeur laisse durer.
const OVERALL_TIMEOUT_MS = 240_000;

export type ImageKitConfig = { endpoint: string; privateKey: string };

// Réglages lus dans .env.local : null si l'un manque (l'éditeur le dit alors honnêtement). L'adresse doit être en https.
export function imagekitConfig(env: NodeJS.ProcessEnv = process.env): ImageKitConfig | null {
  const endpoint = env.IMAGEKIT_URL_ENDPOINT?.trim().replace(/\/$/, "");
  const privateKey = env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!endpoint || !privateKey) return null;
  try {
    return new URL(endpoint).protocol === "https:" ? { endpoint, privateKey } : null;
  } catch {
    return null;
  }
}

const authHeader = (key: string) => `Basic ${Buffer.from(`${key}:`).toString("base64")}`;

// `now` : l'horloge, remplaçable pour tester le délai total sans attendre quatre minutes.
type Deps = { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; config?: ImageKitConfig | null; now?: () => number };

export type RetouchResult = { ok: true; bytes: Uint8Array; mediaType: "image/png" | "image/jpeg" | "image/webp" } | { ok: false; reason: "non_configure" | "indisponible" | "trop_long" | "refuse" };

// Envoie l'image (par son adresse publique chez nous : ImageKit va la chercher), applique la retouche, récupère le résultat, supprime
// le fichier de passage. `sourceUrl` doit être une image de NOTRE stockage : l'appelant l'a vérifié (projectImageKeyFromUrl).
export async function retouchImage(sourceUrl: string, spec: RetouchSpec, deps: Deps = {}): Promise<RetouchResult> {
  const config = "config" in deps ? deps.config : imagekitConfig();
  if (!config) return { ok: false, reason: "non_configure" };
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const now = deps.now ?? Date.now;
  const startedAt = now();
  let fileId: string | null = null;
  try {
    const form = new FormData();
    form.set("file", sourceUrl);
    form.set("fileName", `socialix-${crypto.randomUUID()}`);
    form.set("useUniqueFileName", "true");
    form.set("folder", IMAGEKIT_FOLDER);
    form.set("tags", "socialix-tmp");
    const up = await doFetch(UPLOAD_URL, { method: "POST", headers: { authorization: authHeader(config.privateKey) }, body: form, signal: AbortSignal.timeout(60_000) });
    if (!up.ok) return { ok: false, reason: up.status === 400 || up.status === 401 || up.status === 403 ? "refuse" : "indisponible" };
    const uploaded = (await up.json()) as { fileId?: string; filePath?: string };
    if (typeof uploaded.fileId !== "string" || typeof uploaded.filePath !== "string" || !uploaded.filePath.startsWith("/")) return { ok: false, reason: "indisponible" };
    fileId = uploaded.fileId;

    const url = `${config.endpoint}/tr:${buildTransformation(spec)}${uploaded.filePath.split("/").map(encodeURIComponent).join("/")}`;
    for (let attempt = 0; attempt < PROCESSING_RETRIES; attempt++) {
      const remaining = OVERALL_TIMEOUT_MS - (now() - startedAt);
      if (remaining < 5_000) return { ok: false, reason: "trop_long" };
      // Pas d'AVIF : notre vérification reconnaît PNG, JPEG et WebP
      const res = await doFetch(url, { headers: { accept: "image/png,image/jpeg,image/webp;q=0.9" }, signal: AbortSignal.timeout(Math.min(90_000, remaining)) });
      // ImageKit répond 200 avec une page « en préparation » tant que la transformation IA n'est pas finie
      const preparing = res.headers.get("is-intermediate-response") === "true" || /^text\//.test(res.headers.get("content-type") ?? "");
      if (res.ok && !preparing) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const type = sniffImageType(bytes);
        if (!type || bytes.length === 0 || bytes.length > MAX_RESULT_BYTES) return { ok: false, reason: "indisponible" };
        return { ok: true, bytes, mediaType: type };
      }
      if (!res.ok && res.status !== 202) return { ok: false, reason: res.status === 400 || res.status === 403 || res.status === 404 ? "refuse" : "indisponible" };
      await sleep(PROCESSING_PAUSE_MS);
    }
    return { ok: false, reason: "trop_long" };
  } catch (error) {
    console.error("ImageKit : la retouche a échoué", error instanceof Error ? error.name : "?");
    return { ok: false, reason: "indisponible" };
  } finally {
    // Le fichier de passage est toujours supprimé d'ImageKit, même si la retouche a échoué
    if (fileId) await doFetch(`${API_URL}/${encodeURIComponent(fileId)}`, { method: "DELETE", headers: { authorization: authHeader(config.privateKey) }, signal: AbortSignal.timeout(20_000) }).catch(() => undefined);
  }
}
