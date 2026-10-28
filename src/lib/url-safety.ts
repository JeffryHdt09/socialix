// Protection SSRF (idée reprise d'Hermes Agent) : avant qu'un outil web (chapitre 12) ouvre une adresse choisie par un agent
// ou par une page, on vérifie qu'elle vise Internet et non notre réseau interne. Sans cela, un texte piégé peut pousser
// l'agent à lire http://localhost, le réseau privé ou les métadonnées du fournisseur de cloud.
//
// Deux étapes, parce que le nom ne suffit pas : `checkUrl` (pure) juge l'adresse écrite ; `checkUrlResolved` juge aussi
// les adresses IP vers lesquelles le nom mène (un nom public peut pointer vers 127.0.0.1).

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

// Adresses IPv4 non publiques : boucle locale, réseaux privés, lien local (dont les métadonnées cloud 169.254.169.254),
// partage opérateur, 0.0.0.0, multicast et réservées.
export function isPrivateIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v); // IPv4 déguisée en IPv6
  if (mapped) return isPrivateIPv4(mapped[1]);
  // new URL() réécrit ::ffff:127.0.0.1 en ::ffff:7f00:1 (deux groupes hexadécimaux) : on reconstruit l'IPv4
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v);
  if (hex) {
    const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith("ff"); // privée (fc00::/7), lien local, multicast
}

export function checkUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "adresse invalide" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "protocole non autorisé" };
  if (url.username || url.password) return { ok: false, reason: "identifiants dans l'adresse" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "" || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "adresse interne" };
  }
  // new URL() normalise déjà 0x7f.1 ou 2130706433 en 127.0.0.1 : on juge donc la forme normalisée
  if (isPrivateIPv4(host) || isPrivateIPv6(host)) return { ok: false, reason: "adresse réseau privée" };
  return { ok: true, url };
}

export type Lookup = (hostname: string) => Promise<string[]>;

export async function checkUrlResolved(raw: string, lookup: Lookup): Promise<UrlCheck> {
  const first = checkUrl(raw);
  if (!first.ok) return first;
  const host = first.url.hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return first; // déjà une adresse IP, jugée plus haut
  let ips: string[];
  try {
    ips = await lookup(host);
  } catch {
    return { ok: false, reason: "nom introuvable" };
  }
  if (ips.length === 0) return { ok: false, reason: "nom introuvable" };
  if (ips.some((ip) => isPrivateIPv4(ip) || isPrivateIPv6(ip))) return { ok: false, reason: "le nom mène à une adresse privée" };
  return first;
}
