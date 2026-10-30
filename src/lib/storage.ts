import "server-only";

import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { LogoFile } from "@/lib/logo-upload";

// Stockage des logos. On parle le protocole S3, que Supabase Storage comprend, mais aussi Cloudflare R2,
// MinIO ou AWS : changer de fournisseur = changer les variables S3_* de .env.local, pas ce fichier.
// Le bucket est public en lecture ; seul ce module (donc le serveur) y écrit, avec les clés S3.

function readConfig() {
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_LOGOS, S3_PUBLIC_BASE_URL } = process.env;
  if (!S3_ENDPOINT || !S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET_LOGOS) {
    throw new Error("Stockage non configuré : renseigner les variables S3_* dans .env.local (voir .env.example).");
  }
  // Adresse publique d'un objet (celle qu'on enregistre et qu'on affiche). Avec Supabase, on peut la déduire du
  // point d'accès S3. Avec tout autre fournisseur (Cloudflare R2, MinIO, AWS), le chemin Supabase
  // (/storage/v1/object/public/…) n'existe pas : l'envoi réussirait, mais l'adresse du logo pointerait dans le
  // vide, sans erreur. On exige donc S3_PUBLIC_BASE_URL dans ce cas, et on refuse de démarrer sans elle.
  // « || » et non « ?? » : une variable écrite vide (S3_PUBLIC_BASE_URL=) vaut une chaîne vide, que « ?? » garderait.
  const configuredBase = S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  // On reconnaît Supabase à son CHEMIN (/storage/v1/s3), pas à son domaine : l'instance hébergée
  // (https://<projet>.storage.supabase.co/storage/v1/s3) et celle lancée en local avec la CLI
  // (http://127.0.0.1:54321/storage/v1/s3) ont le même chemin, donc la même adresse publique.
  const endpoint = new URL(S3_ENDPOINT);
  const endpointPath = endpoint.pathname.replace(/\/$/, "");
  const isSupabase = endpointPath.endsWith("/storage/v1/s3");
  if (!configuredBase && !isSupabase) {
    throw new Error("Stockage non configuré : le point d'accès S3 ne ressemble pas à celui de Supabase (il ne se termine pas par /storage/v1/s3) : renseigner S3_PUBLIC_BASE_URL, l'adresse publique des fichiers (voir .env.example).");
  }
  // Adresse déduite du CHEMIN COMPLET du point d'accès, pas seulement de son origine : un Supabase auto-hébergé
  // derrière un proxy (https://hôte/préfixe/storage/v1/s3) garde son préfixe. On remplace seulement le « /s3 » final :
  // …/storage/v1/s3  →  …/storage/v1/object/public/<bucket>.
  const publicBase = configuredBase || `${endpoint.origin}${endpointPath.slice(0, -"/s3".length)}/object/public/${S3_BUCKET_LOGOS}`;
  return { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, bucket: S3_BUCKET_LOGOS, publicBase };
}

let client: S3Client | undefined;
function s3() {
  const c = readConfig();
  client ??= new S3Client({
    endpoint: c.S3_ENDPOINT,
    region: c.S3_REGION,
    credentials: { accessKeyId: c.S3_ACCESS_KEY_ID, secretAccessKey: c.S3_SECRET_ACCESS_KEY },
    forcePathStyle: true, // l'adresse contient /bucket/clé, ce qu'attend Supabase
  });
  return client;
}

// Les identifiants d'utilisateur de Better Auth sont alphanumériques. On le revérifie avant de s'en
// servir comme dossier : un identifiant contenant « / » ou « .. » pourrait sortir de son dossier.
const SAFE_USER_ID = /^[A-Za-z0-9_-]{1,64}$/;
const KEY_PATTERN = /^([A-Za-z0-9_-]{1,64})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

// Envoie un logo déjà contrôlé (readLogoFile). Le nom est généré ici : on n'utilise JAMAIS celui du fichier
// reçu, qui peut être piégé (« ../../x »). Le type vient de la signature du fichier, pas du navigateur.
// Renvoie la clé de l'objet, à ranger dans projects.icon sous la forme « upload:<clé> ».
export async function uploadLogo(userId: string, logo: LogoFile): Promise<string> {
  if (!SAFE_USER_ID.test(userId)) throw new Error("Identifiant d'utilisateur inattendu.");
  const key = `${userId}/${randomUUID()}.${logo.extension}`;
  await s3().send(
    new PutObjectCommand({
      Bucket: readConfig().bucket,
      Key: key,
      Body: logo.bytes,
      ContentType: logo.contentType,
      // La clé est unique et ne change jamais : le navigateur peut garder l'image un an.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return key;
}

// Supprime un logo, à condition qu'il appartienne bien à cet utilisateur : la clé doit avoir exactement
// la forme générée par uploadLogo ET commencer par son propre dossier. Sans cela, une clé falsifiée
// permettrait d'effacer le logo d'un autre.
export async function deleteLogo(userId: string, key: string): Promise<void> {
  const match = KEY_PATTERN.exec(key);
  if (!SAFE_USER_ID.test(userId) || !match || match[1] !== userId) {
    throw new Error("Ce logo n'appartient pas à cet utilisateur.");
  }
  await s3().send(new DeleteObjectCommand({ Bucket: readConfig().bucket, Key: key }));
}

// Adresse publique d'un logo, pour l'afficher.
export function logoUrl(key: string): string {
  if (!KEY_PATTERN.test(key)) throw new Error("Clé de logo invalide.");
  return `${readConfig().publicBase}/${key}`;
}

// ── Images produites par les agents (chapitre 12) ────────────────────────────────────────────────────────────────────
// Même bucket que les logos, autre dossier : « agent/<utilisateur>/<projet>/<uuid>.<ext> ». La clé est générée ici (jamais
// un nom venu du modèle) et contient le propriétaire ET le projet, donc un post ne peut référencer que les images de son
// propre projet (voir isAgentImageKeyFor).
export const AGENT_IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;
export type AgentImageType = keyof typeof AGENT_IMAGE_TYPES;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const AGENT_KEY_PATTERN = /^(?:agent|post)\/([A-Za-z0-9_-]{1,64})\/([0-9a-f-]{36})\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

async function uploadProjectImage(prefix: "agent" | "post", userId: string, projectId: string, bytes: Uint8Array, contentType: AgentImageType): Promise<string> {
  if (!SAFE_ID.test(userId) || !UUID.test(projectId)) throw new Error("Identifiant inattendu.");
  const key = `${prefix}/${userId}/${projectId}/${randomUUID()}.${AGENT_IMAGE_TYPES[contentType]}`;
  await s3().send(new PutObjectCommand({ Bucket: readConfig().bucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
  return key;
}

// Image produite par un agent (« agent/… ») ou téléversée / retouchée par la personne dans l'éditeur de post (« post/… »).
export const uploadAgentImage = (userId: string, projectId: string, bytes: Uint8Array, contentType: AgentImageType) => uploadProjectImage("agent", userId, projectId, bytes, contentType);
export const uploadPostImage = (userId: string, projectId: string, bytes: Uint8Array, contentType: AgentImageType) => uploadProjectImage("post", userId, projectId, bytes, contentType);

// Cette clé est-elle bien une image (d'agent ou de post) de CE projet et de CETTE personne ?
export function isAgentImageKeyFor(key: string, userId: string, projectId: string): boolean {
  const m = AGENT_KEY_PATTERN.exec(key);
  return m !== null && m[1] === userId && m[2] === projectId;
}

export function agentImageUrl(key: string): string {
  if (!AGENT_KEY_PATTERN.test(key)) throw new Error("Clé d'image invalide.");
  return `${readConfig().publicBase}/${key}`;
}

// L'adresse publique d'une image du projet → sa clé, ou null si ce n'est PAS une image de ce projet et de cette personne.
// Une adresse écrite dans le formulaire d'un post n'est jamais crue : seule une image de NOTRE stockage et de CE projet passe
// (sinon une adresse choisie à la main ferait charger n'importe quoi dans l'aperçu et dans les posts).
export function projectImageKeyFromUrl(url: string, userId: string, projectId: string): string | null {
  const base = `${readConfig().publicBase}/`;
  if (!url.startsWith(base)) return null;
  const key = url.slice(base.length);
  return isAgentImageKeyFor(key, userId, projectId) ? key : null;
}

export async function deleteAgentImage(key: string): Promise<void> {
  if (!AGENT_KEY_PATTERN.test(key)) throw new Error("Clé d'image invalide.");
  await s3().send(new DeleteObjectCommand({ Bucket: readConfig().bucket, Key: key }));
}
