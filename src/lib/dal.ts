import "server-only"; // erreur de build si ce fichier est importé dans du code navigateur

import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { auth } from "@/lib/auth";
import { readConversation } from "@/lib/chat-service";
import { readPlans } from "@/lib/plan-queries";
import { queryOverviewUnchecked } from "@/lib/overview-queries";

// Couche d'accès aux données (DAL) : le vrai contrôle de sécurité, au plus près des données.
// Better Auth lit le cookie de session et vérifie en base que la session existe et n'a pas expiré.
// cache() : si plusieurs composants le demandent pendant une même requête, on ne lit la base qu'une fois.
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

// À appeler en haut de chaque page privée : renvoie la session, ou redirige vers la connexion.
export const verifySession = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
});

// Les campagnes de l'utilisateur connecté, la plus récente d'abord.
// Aucun paramètre « userId » : le propriétaire vient de la session, jamais de l'appelant. Il est donc
// impossible, par construction, de demander les campagnes de quelqu'un d'autre avec cette fonction.
export const getMyCampaigns = cache(async () => {
  const { user } = await verifySession();
  return db.select().from(campaigns).where(eq(campaigns.userId, user.id)).orderBy(desc(campaigns.createdAt));
});

// UNE campagne de l'utilisateur connecté, ou null. L'identifiant vient d'une adresse, donc d'un inconnu :
// - il doit avoir la forme d'un UUID, sinon on ne demande même pas à la base (une chaîne piégée ne l'atteint pas) ;
// - la recherche porte sur l'identifiant ET le propriétaire (la session) : une campagne d'un autre ne se trouve pas.
// Dans les deux cas, le résultat est le même null : on ne révèle jamais qu'une campagne existe chez quelqu'un d'autre.
export const getMyCampaign = cache(async (campaignId: string) => {
  const { user } = await verifySession();
  if (!z.uuid().safeParse(campaignId).success) return null;
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, user.id)))
    .limit(1);
  return campaign ?? null;
});

// Pour une page ou un layout : la campagne, ou l'écran « introuvable » (404). À appeler au début de chaque
// page d'une campagne.
export async function requireMyCampaign(campaignId: string) {
  const campaign = await getMyCampaign(campaignId);
  if (!campaign) notFound();
  return campaign;
}

// Les chiffres de la vue d'ensemble d'une campagne. La propriété est vérifiée ICI, avant toute lecture des posts :
// queryOverviewUnchecked ne le fait pas (voir son avertissement), il ne doit être appelé que par cette fonction.
export const getOverview = cache(async (campaignId: string) => {
  await requireMyCampaign(campaignId);
  return queryOverviewUnchecked(campaignId);
});

// La conversation de l'utilisateur connecté avec un agent d'une de ses campagnes (liste vide si la campagne n'est pas à lui).
export const getConversation = cache(async (campaignId: string, agentId: string) => {
  const { user } = await verifySession();
  return readConversation(user.id, campaignId, agentId);
});

// Les plans du Maître pour une campagne de l'utilisateur connecté (liste vide si la campagne n'est pas à lui).
export const getPlans = cache(async (campaignId: string) => {
  const { user } = await verifySession();
  return readPlans(user.id, campaignId);
});
