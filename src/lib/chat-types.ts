// Types et limites partagés entre le serveur (envoi des messages) et l'interface (affichage). Aucun code secret ici :
// ce fichier peut être importé côté navigateur.

export const MAX_MESSAGE_LENGTH = 4000;

// Un message tel que l'interface le reçoit : dates en texte (ISO), jamais d'objet Date (pas sérialisable).
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  // Le plan que ce message présente (réponse du Maître), pour afficher sa carte à cet endroit de la conversation.
  planId: string | null;
};

// Réponse d'une action d'envoi : soit les deux nouveaux messages (le tien et la réponse), soit une explication en français.
export type SendResult = { ok: true; messages: [ChatMessage, ChatMessage] } | { ok: false; error: string };
