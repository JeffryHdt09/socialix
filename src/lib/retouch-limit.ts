// Limite de retouches par personne : les retouches IA d'ImageKit ont un quota (offre gratuite : 650 unités IA par mois) et chaque
// appel dure jusqu'à une minute. Compteur en mémoire du serveur : une relance le remet à zéro, ce qui est sans danger ici (c'est un
// frein, pas une règle de facturation). Fonction pure, avec `now` en paramètre pour les tests.
export const RETOUCH_LIMIT = 12; // retouches
export const RETOUCH_WINDOW_MS = 10 * 60_000; // par fenêtre de 10 minutes

const recent = new Map<string, number[]>();

export function allowRetouch(userId: string, now: number = Date.now()): boolean {
  const kept = (recent.get(userId) ?? []).filter((t) => now - t < RETOUCH_WINDOW_MS);
  if (kept.length >= RETOUCH_LIMIT) {
    recent.set(userId, kept);
    return false;
  }
  kept.push(now);
  recent.set(userId, kept);
  return true;
}

export function resetRetouchLimit() {
  recent.clear();
}
