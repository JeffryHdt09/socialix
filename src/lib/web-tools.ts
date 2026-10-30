import "server-only";

import { lookup } from "node:dns/promises";

import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import { scanForInjection } from "@/lib/prompt-safety";
import { checkUrlResolved, type Lookup } from "@/lib/url-safety";

// Les deux outils web des agents (chapitre 12) : chercher (rechercher_web) et lire une page (lire_page).
// Tout ce qui revient d'Internet est une DONNÉE non fiable : filtré contre les consignes cachées, borné en taille, et jamais
// obéi. L'adresse d'une page est vérifiée avant CHAQUE requête, redirections comprises (url-safety.ts, remarque de CodeRabbit).

export const MAX_QUERY_CHARS = 200;
export const MAX_PAGE_BYTES = 1_500_000;
export const MAX_PAGE_TEXT = 8_000;
export const MAX_REDIRECTS = 5;
export const PAGE_TIMEOUT_MS = 10_000;
const USER_AGENT = "SocialixBot/0.1 (lecture ponctuelle demandée par un utilisateur de Socialix)";

// ── Lire une page ────────────────────────────────────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", agrave: "à", ecirc: "ê", ccedil: "ç" };

// Du HTML au texte lisible : sans exécuter quoi que ce soit, par simples remplacements. Suffisant pour lire un article ;
// ce n'est pas un navigateur (une page qui s'affiche par JavaScript donnera peu de texte).
export function htmlToText(html: string): { title: string; text: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const decode = (s: string) =>
    s
      .replace(/&#(\d{1,6});/g, (_, n: string) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
      .replace(/&#x([0-9a-f]{1,6});/gi, (_, n: string) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
      .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
  const text = decode(body)
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: decode(title).replace(/\s+/g, " ").trim().slice(0, 200), text };
}

export type PageResult = { ok: true; url: string; titre: string; texte: string; tronque: boolean } | { ok: false; raison: string };

const dnsLookup: Lookup = async (host) => (await lookup(host, { all: true })).map((a) => a.address);

// Lit le corps de la réponse en s'arrêtant à `max` octets : une page géante ne remplit pas la mémoire du serveur.
async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => undefined);
  const out = new Uint8Array(Math.min(total, max));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, out.length - at);
    out.set(part, at);
    at += part.length;
    if (at >= out.length) break;
  }
  return out;
}

export async function readPage(rawUrl: string, deps: { lookup?: Lookup; fetch?: typeof fetch } = {}): Promise<PageResult> {
  const { lookup: resolve = dnsLookup, fetch: doFetch = fetch } = deps;
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Vérifié AVANT chaque requête, y compris celle d'une redirection : une page publique peut renvoyer vers http://localhost
    const check = await checkUrlResolved(current, resolve);
    if (!check.ok) return { ok: false, raison: `adresse refusée (${check.reason})` };
    let res: Response;
    try {
      res = await doFetch(check.url, { redirect: "manual", headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain;q=0.9" }, signal: AbortSignal.timeout(PAGE_TIMEOUT_MS) });
    } catch {
      return { ok: false, raison: "page injoignable ou trop lente" };
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { ok: false, raison: "redirection sans destination" };
      try {
        current = new URL(location, check.url).toString();
      } catch {
        return { ok: false, raison: "redirection invalide" };
      }
      continue;
    }
    if (!res.ok) return { ok: false, raison: `page inaccessible (code ${res.status})` };
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!/^(text\/html|text\/plain|application\/xhtml\+xml)/.test(type)) return { ok: false, raison: "ce n’est pas une page de texte" };
    const bytes = await readCapped(res, MAX_PAGE_BYTES);
    const charset = /charset=([\w-]+)/.exec(type)?.[1] ?? "utf-8";
    let raw: string;
    try {
      raw = new TextDecoder(charset).decode(bytes);
    } catch {
      raw = new TextDecoder("utf-8").decode(bytes);
    }
    const { title, text } = type.startsWith("text/plain") ? { title: "", text: raw.trim() } : htmlToText(raw);
    if (!text) return { ok: false, raison: "la page ne contient pas de texte lisible" };
    if (!scanForInjection(text).safe || !scanForInjection(title).safe) return { ok: false, raison: "page écartée : elle contient des consignes suspectes" };
    return { ok: true, url: check.url.toString(), titre: title, texte: text.slice(0, MAX_PAGE_TEXT), tronque: text.length > MAX_PAGE_TEXT };
  }
  return { ok: false, raison: "trop de redirections" };
}

// ── Chercher sur le web ──────────────────────────────────────────────────────────────────────────────────────────────

export type SearchSource = { titre: string; url: string };
export type SearchResult = { ok: true; resume: string; sources: SearchSource[] } | { ok: false; raison: "invalide" | "quota" | "indisponible" };
export type Searcher = (query: string) => Promise<{ text: string; sources: SearchSource[] }>;

// La recherche passe par la recherche Google intégrée à Gemini (une clé de moins à gérer). Elle se fait dans un appel SÉPARÉ
// de la boucle de l'agent : Gemini refuse de combiner cet outil avec des outils de fonction dans une même requête.
const geminiSearch: Searcher = async (query) => {
  const r = await generateText({
    model: google(process.env.SEARCH_MODEL?.trim() || "gemini-2.5-flash"),
    tools: { google_search: google.tools.googleSearch({}) },
    prompt: `Cherche sur le web et réponds en français, de façon factuelle et brève (dix lignes au plus). Ne donne que ce que les sources disent, sans rien ajouter. Sujet : ${query}`,
    maxRetries: 0,
    timeout: 45_000,
  });
  const seen = new Set<string>();
  const sources: SearchSource[] = [];
  for (const s of r.sources) {
    if (s.type !== "source" || s.sourceType !== "url" || seen.has(s.url)) continue;
    seen.add(s.url);
    sources.push({ titre: (s.title ?? "").slice(0, 120) || new URL(s.url).hostname, url: s.url });
  }
  return { text: r.text, sources: sources.slice(0, 6) };
};

export async function searchWeb(query: string, deps: { search?: Searcher } = {}): Promise<SearchResult> {
  const q = query.trim();
  if (!q || q.length > MAX_QUERY_CHARS) return { ok: false, raison: "invalide" };
  try {
    const { text, sources } = await (deps.search ?? geminiSearch)(q);
    const resume = text.trim();
    // Un résumé qui contient des consignes cachées est écarté ; les sources restent (l'agent peut lire les pages)
    return { ok: true, resume: resume && scanForInjection(resume).safe ? resume.slice(0, 4_000) : "(résumé écarté ou vide : lis les sources)", sources };
  } catch (error) {
    const e = error as { statusCode?: number; lastError?: { statusCode?: number } };
    const status = e.statusCode ?? e.lastError?.statusCode;
    console.error(`Recherche web : échec (${status ?? (error instanceof Error ? error.name : "?")})`);
    return { ok: false, raison: status === 429 ? "quota" : "indisponible" };
  }
}
