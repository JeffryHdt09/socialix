import type { Platform } from "@/lib/post-rules";

// L'interface « publicateur » (chapitre 14, décision D5) : tout ce que l'application sait demander à un service de publication.
// Le reste du code (actions, éditeur, agents) ne parle JAMAIS à Buffer, Blotato ou Meta directement : il passe par cette interface.
// Changer de service = écrire un autre adaptateur (src/lib/buffer.ts est le premier), sans toucher au reste. Fichier sans dépendance
// serveur : les types et les textes sont utilisables partout.

// Pourquoi un appel a échoué, en mot court. L'interface montre un texte FIXE par raison (FAILURE_TEXT) ; le détail brut du service,
// utile pour comprendre (« image trop grande »), voyage à part dans `detail`.
export type FailureReason = "not_configured" | "auth" | "limit" | "invalid" | "not_found" | "unavailable";
export type Failure = { ok: false; reason: FailureReason; message: string; detail?: string };

export const FAILURE_TEXT: Record<FailureReason, string> = {
  not_configured: "Le service de publication n’est pas configuré : renseigne BUFFER_API_KEY dans .env.local.",
  auth: "Le service de publication a refusé la clé. Vérifie BUFFER_API_KEY, ou recrée-la chez Buffer.",
  limit: "Le service de publication a atteint sa limite. Réessaie plus tard.",
  invalid: "Le service de publication a refusé ce post.",
  not_found: "Ce post n’existe plus chez le service de publication.",
  unavailable: "Le service de publication ne répond pas. Réessaie dans un instant.",
};

export function failure(reason: FailureReason, detail?: string): Failure {
  return { ok: false, reason, message: FAILURE_TEXT[reason], ...(detail ? { detail: detail.slice(0, 300) } : {}) };
}

// Un compte (« canal ») du service : un compte Instagram, une Page Facebook… `platform` vaut null pour un réseau que l'application
// ne sait pas encore servir (Mastodon, Google Business…) : on l'affiche, on ne propose pas de lui envoyer de post.
export type Channel = { id: string; name: string; service: string; platform: Platform | null; disconnected: boolean; locked: boolean };

export type SchedulePayload = {
  channelId: string;
  platform: Platform;
  text: string; // légende + hashtags, déjà assemblés (buildPostText)
  imageUrls: readonly string[]; // adresses PUBLIQUES : le service va chercher les images lui-même
  dueAt: Date;
};

// Où en est un post chez le service. `unknown` : un état que nous ne connaissons pas, jamais interprété comme une réussite.
export type DeliveryState = "draft" | "needs_approval" | "scheduled" | "sending" | "sent" | "error" | "unknown";

export type ListChannelsResult = { ok: true; channels: Channel[] } | Failure;
export type ScheduleResult = { ok: true; externalId: string; dueAt: Date | null } | Failure;
export type CancelResult = { ok: true; alreadyGone: boolean } | Failure;
export type StateResult = { ok: true; state: DeliveryState; sentAt: Date | null; link: string | null; error: string | null } | Failure;

export interface Publisher {
  readonly name: string;
  listChannels(): Promise<ListChannelsResult>;
  // Programme UN post sur UN compte, à une date précise. Ne publie jamais tout de suite.
  schedule(payload: SchedulePayload): Promise<ScheduleResult>;
  // Retire un post programmé. Idempotent : un post déjà disparu est un succès (alreadyGone), pas une erreur.
  cancel(externalId: string): Promise<CancelResult>;
  state(externalId: string): Promise<StateResult>;
}
