import "server-only";

import { count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { campaigns, type NewCampaign } from "@/db/schema";
import { MAX_CAMPAIGNS_PER_USER } from "@/lib/campaign-rules";

// Crée une campagne SI l'utilisateur n'a pas atteint son plafond. Le contrôle et l'écriture sont faits
// dans une même transaction, sous un verrou propre à cet utilisateur.
//
// Pourquoi un verrou : « compter, puis insérer » en deux temps n'est pas sûr. Deux envois simultanés à
// 19 campagnes comptent tous les deux 19, passent tous les deux, et l'utilisateur se retrouve à 21.
// pg_advisory_xact_lock fait attendre le second jusqu'à la fin du premier : il compte alors 20 et refuse.
// La version « xact » se libère toute seule à la fin de la transaction (commit ou échec), y compris
// derrière le Transaction pooler de Supabase prévu en production, où un verrou de session serait perdu.
// hashtext() transforme l'identifiant en nombre ; deux utilisateurs différents ne se bloquent pas
// (sauf collision de hachage, très rare et sans conséquence : l'un attend l'autre quelques millisecondes).
export async function createCampaignWithinLimit(values: NewCampaign): Promise<"created" | "limit"> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${values.userId}))`);
    const [{ total }] = await tx.select({ total: count() }).from(campaigns).where(eq(campaigns.userId, values.userId));
    if (total >= MAX_CAMPAIGNS_PER_USER) return "limit" as const;
    await tx.insert(campaigns).values(values);
    return "created" as const;
  });
}
