// Essai RÉEL d'ImageKit (chapitre 13) : envoie une image publique, la retouche, récupère le résultat et vérifie le nettoyage.
// Usage : node scripts/check-imagekit-real.mjs [dossier-de-sortie]
// Demande IMAGEKIT_URL_ENDPOINT et IMAGEKIT_PRIVATE_KEY dans .env.local. N'affiche jamais la clé.
// Coût : la retouche IA (détourage) consomme une opération de l'offre gratuite d'ImageKit (quota mensuel limité).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { createLoader } from "./lib/load-ts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const outDir = process.argv[2] ?? path.join(root, ".next");

const load = createLoader(root);
const Kit = load("src/lib/imagekit.ts");
const { EMPTY_SPEC } = load("src/lib/retouch-rules.ts");

const config = Kit.imagekitConfig();
if (!config) {
  console.log("KO  ImageKit n'est pas configuré (IMAGEKIT_URL_ENDPOINT ou IMAGEKIT_PRIVATE_KEY manquant ou invalide)");
  process.exit(1);
}

// Dans les VRAIES conditions de l'application : l'image de départ est rangée dans NOTRE stockage (comme l'éditeur de post le fait),
// et ImageKit va la chercher à son adresse publique. L'image vient de ton compte ImageKit (« default-image.jpg », créée à l'inscription).
const Storage = load("src/lib/storage.ts");
const { sniffImageType } = load("src/lib/image-tools.ts");
const testUser = "imagekit-test";
const testProject = crypto.randomUUID();
const storedKeys = [];
let SOURCE = "";
let ok = 0;
let ko = 0;
const check = (name, cond, detail) => {
  if (cond) ok++;
  else ko++;
  console.log(cond ? "OK " : "KO ", name, cond || detail === undefined ? "" : `\n     ${detail}`);
};

async function run(label, spec) {
  const t0 = Date.now();
  const r = await Kit.retouchImage(SOURCE, spec);
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.ok) {
    const file = path.join(outDir, `imagekit-${label}.${r.mediaType === "image/png" ? "png" : r.mediaType === "image/webp" ? "webp" : "jpg"}`);
    fs.writeFileSync(file, r.bytes);
    console.log(`     ${label} : ${r.mediaType}, ${r.bytes.length} octets, ${seconds} s -> ${file}`);
  }
  return r;
}

// Combien de fichiers de passage restent chez ImageKit (il ne doit en rester aucun)
async function leftovers() {
  const res = await fetch(`https://api.imagekit.io/v1/files?path=${encodeURIComponent(Kit.IMAGEKIT_FOLDER)}&limit=50`, {
    headers: { authorization: `Basic ${Buffer.from(`${config.privateKey}:`).toString("base64")}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return { status: res.status, count: null };
  const list = await res.json();
  return { status: res.status, count: Array.isArray(list) ? list.length : null };
}

try {
  const sample = await fetch(`${config.endpoint}/default-image.jpg`, { signal: AbortSignal.timeout(30_000) });
  const sampleBytes = new Uint8Array(await sample.arrayBuffer());
  const sampleType = sniffImageType(sampleBytes);
  check("image d'exemple récupérée chez ImageKit", sample.ok && sampleType !== null, `HTTP ${sample.status}`);
  const key = await Storage.uploadPostImage(testUser, testProject, sampleBytes, sampleType);
  storedKeys.push(key);
  SOURCE = Storage.agentImageUrl(key);
  const reach = await fetch(SOURCE, { signal: AbortSignal.timeout(30_000) });
  check("l'image rangée dans notre stockage est lisible publiquement", reach.ok, `HTTP ${reach.status}`);

  const before = await leftovers();
  check("clé acceptée par l'API de gestion d'ImageKit (liste des fichiers)", before.status === 200, `HTTP ${before.status}`);

  const simple = await run("recadrage-noir-et-blanc", { ...EMPTY_SPEC, crop: "1:1", grayscale: true });
  check("retouche simple (recadrage 1:1 + noir et blanc) : image obtenue", simple.ok, JSON.stringify(simple));

  const ai = await run("detourage-ia", { ...EMPTY_SPEC, ai: "removebg" });
  check("retouche IA (détourage) : image obtenue", ai.ok, JSON.stringify(ai));

  const text = await run("texte", { ...EMPTY_SPEC, crop: "4:5", text: { enabled: true, content: "Bonjour Socialix", size: 64, color: "white", position: "bottom" } });
  check("texte superposé : image obtenue", text.ok, JSON.stringify(text));

  const after = await leftovers();
  check("aucun fichier de passage ne reste chez ImageKit", after.count === 0, `fichiers restants : ${after.count} (HTTP ${after.status})`);
} catch (error) {
  ko++;
  console.log("KO  erreur inattendue :", error instanceof Error ? `${error.name} ${error.message}` : error);
} finally {
  // Ménage : l'image de test ne doit pas rester dans le stockage
  for (const k of storedKeys) await Storage.deleteAgentImage(k).catch(() => console.log("ATTENTION : l'image de test n'a pas pu être supprimée du stockage :", k));
}
console.log(`\n${ok} réussis, ${ko} échoués`);
process.exit(ko ? 1 : 0);
