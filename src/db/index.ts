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

const client = globalForDb.client ?? postgres(databaseUrl);
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

// L'objet unique qu'on importe partout pour lire et écrire : import { db } from "@/db".
export const db = drizzle(client, { schema });
