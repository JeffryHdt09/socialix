// Lecture seule : liste les canaux Buffer avec l'adaptateur de l'application (src/lib/buffer.ts). Ne programme rien, ne publie rien.
// Usage : node scripts/check-buffer-channels.mjs        (BUFFER_API_KEY dans .env.local). N'affiche jamais la clé.
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { createLoader } from "./lib/load-ts.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local"), quiet: true });
const { publisher } = createLoader(root)("src/lib/buffer.ts");

const r = await publisher.listChannels();
if (!r.ok) {
  console.log(`KO  ${r.reason} : ${r.message}${r.detail ? ` (${r.detail})` : ""}`);
  process.exit(1);
}
console.log(`${r.channels.length} canal(aux) chez Buffer :`);
for (const c of r.channels) console.log(`  - ${c.service.padEnd(10)} ${c.name}  ->  ${c.platform ? `réseau « ${c.platform} »` : "réseau non géré par Socialix"}${c.disconnected ? "  [DÉCONNECTÉ]" : ""}${c.locked ? "  [VERROUILLÉ]" : ""}`);
