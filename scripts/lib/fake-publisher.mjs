// Un FAUX service de publication, tout en mémoire, pour les scripts de contrôle. Jamais de réseau, jamais de clé : rien n'est publié.
// On peut le faire échouer à la demande (refuser un réseau, refuser les annulations, tomber en panne) et lui faire dire où en est
// chaque post (programmé, envoyé, en erreur…), comme le ferait le vrai service.
export function fakePublisher() {
  const s = {
    live: new Map(), // les posts « programmés chez le service » : identifiant -> payload
    states: new Map(), // identifiant -> { state, sentAt, link, error } ; absent = « scheduled »
    scheduleCalls: 0,
    cancelCalls: 0,
    stateCalls: 0,
    failSchedule: new Set(), // réseaux que le service refuse
    failCancel: false,
    failList: false,
    failState: new Map(), // identifiant -> l'échec à renvoyer quand on lit son état (« unavailable », « not_found »…)
    seq: 0,
    channels: [
      { id: "b1", name: "moi.bsky.social", service: "bluesky", platform: "bluesky", disconnected: false, locked: false },
      { id: "b2", name: "autre.bsky.social", service: "bluesky", platform: "bluesky", disconnected: false, locked: false },
      { id: "x1", name: "@moi", service: "twitter", platform: "x", disconnected: false, locked: false },
      { id: "i1", name: "moi_insta", service: "instagram", platform: "instagram", disconnected: false, locked: false },
      { id: "i2", name: "autre_insta", service: "instagram", platform: "instagram", disconnected: false, locked: false },
      { id: "f1", name: "Ma Page", service: "facebook", platform: "facebook", disconnected: true, locked: false },
      { id: "l1", name: "Mon profil", service: "linkedin", platform: "linkedin", disconnected: false, locked: true },
      { id: "m1", name: "mastodon", service: "mastodon", platform: null, disconnected: false, locked: false },
    ],
  };
  const unavailable = { ok: false, reason: "unavailable", message: "Le service de publication ne répond pas. Réessaie dans un instant." };
  const pub = {
    name: "fake",
    async listChannels() {
      return s.failList ? unavailable : { ok: true, channels: s.channels };
    },
    async schedule(p) {
      s.scheduleCalls++;
      if (s.failSchedule.has(p.platform)) return { ok: false, reason: "invalid", message: "Le service de publication a refusé ce post.", detail: "refusé par le test" };
      const id = `ext-${++s.seq}`;
      s.live.set(id, p);
      return { ok: true, externalId: id, dueAt: p.dueAt };
    },
    async cancel(id) {
      s.cancelCalls++;
      if (s.failCancel) return unavailable;
      return { ok: true, alreadyGone: !s.live.delete(id) };
    },
    async state(id) {
      s.stateCalls++;
      if (s.failState.has(id)) return s.failState.get(id);
      const st = s.states.get(id) ?? { state: "scheduled", sentAt: null, link: null, error: null };
      return { ok: true, ...st };
    },
  };
  return { s, pub };
}
