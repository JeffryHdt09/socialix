// Affichage des dates (PLAN.md, « Règle des dates ») : la base garde tout en UTC, l'écran montre l'heure de Paris.
// Fichier sans dépendance : utilisable côté serveur comme côté navigateur, et testable seul.
export const APP_TIMEZONE = "Europe/Paris";

const dayAndMonth = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: APP_TIMEZONE });
const clock = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: APP_TIMEZONE });

// « lun. 2 nov. · 08:00 » : l'heure du post à Paris, quelle que soit la machine qui affiche.
export function formatPostDate(date: Date): string {
  return `${dayAndMonth.format(date)} · ${clock.format(date)}`;
}

// « 14:32 » : l’heure à Paris, pour l’étiquette d’un message de conversation.
export const formatClock = (date: Date): string => clock.format(date);

// Un « jour civil » comme « 2026-11-02 » (celui de la bande des 7 jours) n'a pas d'heure : on le lit à midi UTC et on
// l'affiche en UTC, pour qu'aucun fuseau ne le décale d'un jour.
const asNoonUtc = (day: string) => new Date(`${day}T12:00:00Z`);
const weekdayShort = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const dayNumber = new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export const shortWeekday = (day: string) => weekdayShort.format(asNoonUtc(day)); // « lun. »
export const dayOfMonth = (day: string) => dayNumber.format(asNoonUtc(day)); //       « 2 »
export const longDay = (day: string) => dayLong.format(asNoonUtc(day)); //            « lundi 2 novembre »

const PLATFORMS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  threads: "Threads",
  pinterest: "Pinterest",
  youtube: "YouTube",
};

// « instagram » → « Instagram ». Un réseau inconnu garde son nom avec une majuscule plutôt que de disparaître.
export function platformLabel(platform: string): string {
  // Object.hasOwn : sans lui, « constructor » ou « toString » retrouveraient une fonction héritée d'Object au lieu du repli
  const key = platform.toLowerCase();
  return Object.hasOwn(PLATFORMS, key) ? PLATFORMS[key] : platform.charAt(0).toUpperCase() + platform.slice(1);
}

export const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

// ── Saisie d'une date « heure de Paris » (éditeur de post, chapitre 13) ─────────────────────────────────────────────────
// Le formulaire donne un jour (« 2026-11-02 ») et une heure (« 08:00 ») SANS fuseau : ce sont des heures de Paris
// (PLAN.md, « Règle des dates »). La base veut un instant en UTC. L'écart avec Paris change deux fois par an (UTC+1 l'hiver,
// UTC+2 l'été), donc on ne peut pas ajouter un nombre fixe d'heures : on interroge le fuseau lui-même.
const parisFields = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function parisParts(date: Date): { day: string; time: string; asUtcMs: number } {
  const o = Object.fromEntries(parisFields.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}`, asUtcMs: Date.UTC(Number(o.year), Number(o.month) - 1, Number(o.day), Number(o.hour), Number(o.minute)) };
}

// « 2026-11-02 » + « 08:00 » (heure de Paris) → l'instant correspondant, ou null si le jour n'existe pas (30 février), si l'heure
// n'existe pas (la nuit du passage à l'heure d'été, 02:30 saute) ou si le format est mauvais. À l'heure doublée de l'automne,
// l'heure revient deux fois : on garde l'un des deux instants (celui de l'heure d'hiver).
export function parisToUtc(day: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const wanted = Date.UTC(y, m - 1, d, h, mi);
  if (Number.isNaN(wanted)) return null;
  const offsetAt = (instantMs: number) => parisParts(new Date(instantMs)).asUtcMs - instantMs;
  const first = wanted - offsetAt(wanted);
  const guess = new Date(wanted - offsetAt(first)); // deuxième passe : l'écart peut différer à cheval sur un changement d'heure
  const back = parisParts(guess);
  return back.day === day && back.time === time ? guess : null;
}

// L'inverse : un instant → le jour et l'heure de Paris, pour remplir les champs du formulaire.
export function utcToParisInput(date: Date): { day: string; time: string } {
  const { day, time } = parisParts(date);
  return { day, time };
}
