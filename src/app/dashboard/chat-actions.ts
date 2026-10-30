"use server";

import { getSession } from "@/lib/dal";
import { sendMessageAs } from "@/lib/chat-service";
import type { SendResult } from "@/lib/chat-types";
import { cancelPlanAs, readPlans } from "@/lib/plan-queries";
import type { CancelResult, PlanView } from "@/lib/plan-types";

// Envoie un message à un agent. Une action serveur est une adresse publique : rien de ce qui arrive n'est cru.
// Le propriétaire vient de la SESSION, jamais d'un paramètre ; le projet, l'agent et le texte sont revérifiés
// dans sendMessageAs. Le navigateur ne parle jamais à Gemini : la clé reste ici, sur le serveur.
export async function sendMessage(projectId: string, agentId: string, text: string): Promise<SendResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (typeof projectId !== "string" || typeof agentId !== "string" || typeof text !== "string") return { ok: false, error: "Message invalide." };
  return sendMessageAs(session.user.id, projectId, agentId, text);
}

// Annule un plan du projet (et ses tâches pas encore terminées). Mêmes règles : session obligatoire, propriétaire pris dans la session.
export async function cancelPlan(projectId: string, planId: string): Promise<CancelResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Ta session a expiré. Reconnecte-toi." };
  if (typeof projectId !== "string" || typeof planId !== "string") return { ok: false, error: "Demande invalide." };
  return cancelPlanAs(session.user.id, projectId, planId);
}

// Relit les plans du projet (la carte du plan se met à jour pendant que les tâches s'exécutent). Lecture seule, mêmes règles :
// session obligatoire, propriétaire pris dans la session, liste vide si le projet n'est pas à la personne.
export async function refreshPlans(projectId: string): Promise<PlanView[]> {
  const session = await getSession();
  if (!session || typeof projectId !== "string") return [];
  return readPlans(session.user.id, projectId);
}
