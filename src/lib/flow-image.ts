import "server-only";

import { readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";

import type { GeneratedImage } from "@/lib/image-tools";

// Génération d'image par Google Flow, via le programme local « flow-mcp » (C:\dev\flow-mcp) : il pilote une vraie fenêtre Chrome
// connectée au compte de la personne et clique les vrais boutons de Flow. Les images (Nano Banana) ne coûtent AUCUN crédit.
//
// Règles de ce fournisseur :
// - il est réservé à la machine de la personne (adresse 127.0.0.1) et à SES projets : on ne l'active que si elle l'a décidé
//   (FLOW_IMAGES=1 dans .env.local). Jamais pour le compte d'un client, jamais sur un serveur hébergé.
// - il ne dépense jamais de crédits : chaque demande porte max_credits = 0, Flow annule la scène s'il annonce un prix.
// - une seule génération à la fois (Flow n'a qu'une fenêtre et une file) : voir `exclusive`.
// - s'il n'est pas disponible (programme éteint, pas de projet ouvert), on renvoie null et le fournisseur suivant prend le relais.

export function flowEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.FLOW_IMAGES === "1";
}

const FLOW_PROJECT = "socialix"; // le dossier de sortie : <flow-mcp-out>/socialix
export const FLOW_TOTAL_TIMEOUT_MS = 240_000; // une image prend 1 à 2 minutes ; au-delà, on abandonne et on annule
const WAIT_SECONDS = 40; // Flow ne bloque jamais plus de 45 s par appel d'attente

function flowBase(env: NodeJS.ProcessEnv = process.env): string {
  const port = Number(env.FLOW_MCP_PORT ?? 8787);
  return `http://127.0.0.1:${Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 8787}`; // toujours la boucle locale
}

async function readToken(env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  try {
    const home = env.FLOW_MCP_HOME ?? join(homedir(), ".flow-mcp");
    return (await readFile(join(home, "token"), "utf-8")).trim() || null;
  } catch {
    return null;
  }
}

// Une seule génération Flow à la fois dans ce processus
let chain: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

type Deps = { fetch?: typeof fetch; env?: NodeJS.ProcessEnv; now?: () => number; totalTimeoutMs?: number };
type Job = { id: string; status: string; files?: string[]; error?: string };

export async function flowImage(prompt: string, deps: Deps = {}): Promise<GeneratedImage | null> {
  const { fetch: doFetch = fetch, env = process.env, now = Date.now, totalTimeoutMs = FLOW_TOTAL_TIMEOUT_MS } = deps;
  const token = await readToken(env);
  if (!token) return null;
  const base = flowBase(env);

  return exclusive(async () => {
    // Le programme est-il lancé ? (sans jeton : c'est la seule route publique)
    try {
      const health = await doFetch(`${base}/api/health`, { signal: AbortSignal.timeout(1_500) });
      if (!health.ok || ((await health.json()) as { name?: string }).name !== "flow-mcp") return null;
    } catch {
      return null;
    }

    const call = async <T>(method: string, args: unknown, timeoutMs = 60_000): Promise<T> => {
      const res = await doFetch(`${base}/api/${method}`, { method: "POST", headers: { "content-type": "application/json", "x-flow-token": token }, body: JSON.stringify(args), signal: AbortSignal.timeout(timeoutMs) });
      const body = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) throw Object.assign(new Error("flow"), { statusCode: res.status });
      return body;
    };

    // Les images déjà présentes dans le projet Flow : si la génération réussit mais que le téléchargement automatique échoue
    // (constaté : « le menu de la tuile ne s'ouvre pas »), l'image nouvelle est la différence avec cette liste.
    let before: Set<string> | null = null;
    try {
      before = new Set((await call<{ name: string }[]>("assets", { kind: "image" })).map((a) => a.name));
    } catch {
      before = null; // file occupée par autre chose : pas de reprise possible, mais la génération reste tentée
    }

    let job: Job;
    let outputDir: string;
    try {
      // max_credits 0 : si Flow annonçait un prix, la scène serait ignorée et rien ne serait dépensé
      const started = await call<{ output_dir: string; jobs: Job[] }>("generate", { project: FLOW_PROJECT, scenes: [{ type: "image", prompt, aspect_ratio: "1:1", max_credits: 0, variants: 1 }] });
      job = started.jobs[0];
      outputDir = started.output_dir;
    } catch {
      return null; // pas de projet ouvert, Flow occupé, etc. : on passe au fournisseur suivant
    }

    const deadline = now() + totalTimeoutMs;
    let last: Job = job;
    while (now() < deadline) {
      try {
        const waited = await call<{ finished: boolean; jobs: Job[] }>("wait", { job_ids: [job.id], timeout_seconds: WAIT_SECONDS }, (WAIT_SECONDS + 20) * 1_000);
        last = waited.jobs[0] ?? last;
        if (waited.finished) break;
      } catch {
        break;
      }
    }
    if (last.status === "queued" || last.status === "running") {
      await call("cancel", { job_id: job.id }, 10_000).catch(() => undefined); // trop long : on annule
      return null;
    }

    // Cas normal : Flow a téléchargé le fichier
    let files = last.status === "done" ? (last.files ?? []) : [];
    // Reprise : l'image existe peut-être dans le projet sans avoir été téléchargée
    if (files.length === 0 && before) {
      try {
        const after = await call<{ name: string }[]>("assets", { kind: "image" });
        const fresh = after.map((a) => a.name).find((n) => !before.has(n));
        if (fresh) {
          const dl = await call<{ dir: string; files: string[] }>("download", { project: FLOW_PROJECT, assets: [fresh], quality: "original" });
          files = dl.files ?? [];
          outputDir = dl.dir ?? outputDir;
        }
      } catch {
        return null;
      }
    }
    const file = files[0];
    if (!file) return null;

    // Le chemin vient d'un programme local : on ne lit que ce qui se trouve bien dans son dossier de sortie
    try {
      const [realFile, realDir] = await Promise.all([realpath(file), realpath(outputDir)]);
      if (!realFile.startsWith(realDir + sep)) return null;
      const bytes = new Uint8Array(await readFile(realFile));
      const lower = realFile.toLowerCase();
      return { bytes, mediaType: lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : "image/jpeg" };
    } catch {
      return null;
    }
  });
}
