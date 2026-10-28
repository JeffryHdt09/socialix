// Affichage des dates (PLAN.md, « Règle des dates ») : la base garde tout en UTC, l'écran montre l'heure de Paris.
// Fichier sans dépendance : utilisable côté serveur comme côté navigateur, et testable seul.
export const APP_TIMEZONE = "Europe/Paris";

const dayAndMonth = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: APP_TIMEZONE });
const clock = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: APP_TIMEZONE });

// « lun. 2 nov. · 08:00 » : l'heure du post à Paris, quelle que soit la machine qui affiche.
export function formatPostDate(date: Date): string {
  return `${dayAndMonth.format(date)} · ${clock.format(date)}`;
}

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
  return PLATFORMS[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

export const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);
