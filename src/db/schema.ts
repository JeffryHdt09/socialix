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

// Cycle de vie d'un post (DESIGN.md, « États ») : brouillon → à valider → programmé → publié, ou échec.
// « to_review » (À valider) s'ajoute aux quatre statuts du plan initial : c'est l'état où l'équipe IA remet un post
// à l'humain, et la carte « À valider » de la vue d'ensemble le compte. Un brouillon n'est PAS « à valider ».
export const postStatusEnum = pgEnum("post_status", ["draft", "to_review", "scheduled", "published", "failed"]);
export const postAuthorEnum = pgEnum("post_author", ["user", "agent"]);

// Un post d'une campagne. Créé par l'utilisateur (chapitre 13) ou par l'équipe IA (chapitres 10 à 12).
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Appartient à une campagne, donc indirectement à un utilisateur : supprimer la campagne supprime ses posts.
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    caption: text("caption").notNull().default(""),
    hashtags: text("hashtags").array().notNull().default(sql`ARRAY[]::text[]`),
    // Réseaux visés (« instagram », « linkedin »…). La liste exacte sera fixée au chapitre 13 avec l'éditeur.
    platforms: text("platforms").array().notNull().default(sql`ARRAY[]::text[]`),
    imageUrl: text("image_url"),
    // Date de publication voulue, en UTC (timestamptz) ; affichée dans le fuseau de l'utilisateur (PLAN.md).
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    status: postStatusEnum("status").notNull().default("draft"),
    // Identifiant du post chez le service de publication (D5). Nom neutre : le service n'est pas encore choisi.
    externalId: text("external_id"),
    createdBy: postAuthorEnum("created_by").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Les deux lectures de la vue d'ensemble : « par statut » et « par date » dans une campagne.
    index("posts_campaign_status_idx").on(table.campaignId, table.status),
    index("posts_campaign_scheduled_idx").on(table.campaignId, table.scheduledAt),
    // Garde-fous de la base, au cas où le contrôle de l'application serait contourné :
    check("posts_title_length", sql`char_length(btrim(${table.title})) between 1 and 120`),
    // Un post programmé ou publié a forcément une date : sans elle, le calendrier ne saurait pas où le placer.
    check("posts_dated_when_scheduled", sql`${table.status} not in ('scheduled', 'published') or ${table.scheduledAt} is not null`),
  ],
).enableRLS();

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
