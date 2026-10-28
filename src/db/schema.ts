import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema";

// Le schéma de la base : la description de nos tables en TypeScript.
// Drizzle s'en sert pour typer nos requêtes, drizzle-kit pour générer les migrations.

// Tables de Better Auth (user, session, account, verification).
// Fichier généré par `npx auth generate` : ne pas le modifier à la main.
export * from "./auth-schema";

// Le décor du bureau des agents. « modern » est prévu mais pas encore dessiné (voir PLAN.md, chapitre 7).
export const officeEnum = pgEnum("office", ["wooden", "modern"]);

// Une campagne = un espace de travail, pour une marque ou un client.
// Règle des dates (PLAN.md) : timestamptz, stocké en UTC, affiché dans le fuseau de l'utilisateur.
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Le propriétaire. Chaque lecture et chaque écriture filtre sur cette colonne : sans cela,
    // changer l'identifiant dans une adresse suffirait pour voir la campagne d'un autre.
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Logo : « icon:<nom> » pour une icône proposée par l'application (ex. « icon:coffee »),
    // « upload:<clé> » pour une image téléversée (clé de l'objet dans le stockage),
    // null = pas de logo (on affiche l'initiale du nom).
    icon: text("icon"),
    office: officeEnum("office").notNull().default("wooden"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("campaigns_user_id_idx").on(table.userId),
    // Dernier rempart si le contrôle de l'application était contourné : 1 à 60 caractères, sans espaces seuls.
    check("campaigns_name_length", sql`char_length(btrim(${table.name})) between 1 and 60`),
  ],
).enableRLS(); // Supabase expose les tables par sa Data API, que nous n'utilisons pas : RLS sans règle la ferme.

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
