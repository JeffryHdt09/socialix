import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL manquante : la renseigner dans .env.local (voir .env.example).");
}

// En développement, Next recharge les modules à chaque sauvegarde. Sans précaution,
// chaque rechargement ouvrirait un nouveau lot de connexions jusqu'à saturer Supabase.
// On garde donc le client sur globalThis, qui survit aux rechargements.
const globalForDb = globalThis as unknown as { client?: ReturnType<typeof postgres> };

const client =
  globalForDb.client ??
  postgres(databaseUrl, {
    // Le pooler de Supabase peut fermer une connexion restée inactive. La requête qui tombe dessus échoue
    // alors avec « read ECONNRESET » (vu en test). On ferme donc nous-mêmes les connexions inactives
    // au bout de 20 s, avant le pooler : la suivante s'ouvre toute neuve. Réduit le risque, ne le supprime
    // pas : une coupure en pleine requête reste possible, c'est le rôle de l'écran d'erreur (error.tsx).
    idle_timeout: 20,
    // Une connexion qui n'aboutit pas en 10 s échoue franchement au lieu de laisser la page attendre.
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

// L'objet unique qu'on importe partout pour lire et écrire : import { db } from "@/db".
export const db = drizzle(client, { schema });
