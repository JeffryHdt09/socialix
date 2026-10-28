import "server-only";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { campaigns } from "@/db/schema";

// La campagne est-elle bien à cette personne ? Même règle d'isolation que partout : identifiant ET propriétaire.
// L'identifiant vient d'une adresse ou d'un formulaire : s'il n'a pas la forme d'un UUID, on ne le donne même pas à la base.
// À n'appeler qu'avec un `userId` pris dans la SESSION.
export async function ownsCampaign(userId: string, campaignId: string): Promise<boolean> {
  if (!z.uuid().safeParse(campaignId).success) return false;
  const [row] = await db.select({ id: campaigns.id }).from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId))).limit(1);
  return !!row;
}
