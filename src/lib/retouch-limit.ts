// Limite de retouches par personne : les retouches IA d'ImageKit ont un quota (offre gratuite : 650 unités IA par mois) et chaque
// appel dure jusqu'à une minute. Compteur en mémoire du serveur : une relance le remet à zéro, ce qui est sans danger ici (c'est un
// frein, pas une règle de facturation). Fonction pure, avec `now` en paramètre pour les tests.
export const RETOUCH_LIMIT = 12; // retouches
export const RETOUCH_WINDOW_MS = 10 * 60_000; // par fenêtre de 10 minutes
// Les envois d'images ne coûtent pas de quota, mais chacun est rangé dans le stockage pour toujours (rien ne ménage les images
// abandonnées) : sans frein, une boucle remplirait le stockage. 30 images par fenêtre de 10 minutes, largement assez à la main.
export const UPLOAD_LIMIT = 30;
export const UPLOAD_WINDOW_MS = 10 * 60_000;

// Un compteur par type d'action : « au plus `limit` actions par personne et par fenêtre de `windowMs` ».
function makeLimiter(limit: number, windowMs: number) {
  const recent = new Map<string, number[]>();
  return {
    allow(userId: string, now: number): boolean {
      const kept = (recent.get(userId) ?? []).filter((t) => now - t < windowMs);
      if (kept.length >= limit) {
        recent.set(userId, kept);
        return false;
      }
      kept.push(now);
      recent.set(userId, kept);
      return true;
    },
    reset: () => recent.clear(),
  };
}

const retouches = makeLimiter(RETOUCH_LIMIT, RETOUCH_WINDOW_MS);
const uploads = makeLimiter(UPLOAD_LIMIT, UPLOAD_WINDOW_MS);

export function allowRetouch(userId: string, now: number = Date.now()): boolean {
  return retouches.allow(userId, now);
}

export function allowUpload(userId: string, now: number = Date.now()): boolean {
  return uploads.allow(userId, now);
}

export function resetRetouchLimit() {
  retouches.reset();
  uploads.reset();
}
