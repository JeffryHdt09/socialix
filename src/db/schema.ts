import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

// Qui parle dans une conversation : la personne (`user`) ou l'agent (`assistant`).
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

// L'historique des conversations avec les agents (chapitre 9). Un message appartient à une campagne et à un agent : la
// conversation « Créateur de la campagne X » est simplement tous ses messages, du plus ancien au plus récent.
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Supprimer la campagne supprime ses conversations (et la campagne appartient à un seul utilisateur).
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    // Identifiant de l'agent (« createur »…). Volontairement un texte libre et pas une liste fermée dans la base : le moteur
    // est fait pour recevoir d'autres équipes (docs/VISION.md), et c'est l'application qui vérifie l'identifiant.
    agent: text("agent").notNull(),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    // Le modèle qui a produit la réponse (utile pour comprendre un comportement ou un repli) ; vide pour les messages de la personne.
    model: text("model"),
    // Le plan que ce message présente (réponse du Maître) : l'interface affiche la carte du plan à cet endroit de la
    // conversation. Si le plan disparaît, le message reste (set null) : on ne perd pas la conversation.
    planId: uuid("plan_id").references((): AnyPgColumn => agentPlans.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // La lecture d'une conversation : une campagne, un agent, dans l'ordre du temps.
    index("messages_conversation_idx").on(table.campaignId, table.agent, table.createdAt),
    // Garde-fous de la base (l'application limite déjà la longueur à 4 000 caractères pour la personne) :
    check("messages_content_length", sql`char_length(btrim(${table.content})) between 1 and 20000`),
    check("messages_agent_not_empty", sql`char_length(btrim(${table.agent})) between 1 and 40`),
  ],
).enableRLS();

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ── Chapitre 10 : le Maître planifie ─────────────────────────────────────────────────────────────────────────────────
// Un PLAN répond à une demande (« 2 posts Instagram pour le lancement d'un café ») ; il contient des TÂCHES confiées chacune
// à un agent, qui peuvent dépendre d'autres tâches (« rédiger » attend « chercher des idées »).

export const planStatusEnum = pgEnum("plan_status", ["active", "done", "cancelled"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "running", "done", "failed", "cancelled"]);

export const agentPlans = pgTable(
  "agent_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    // La demande de la personne, telle que le Maître l'a comprise, et le résumé qu'il lui a présenté.
    request: text("request").notNull(),
    summary: text("summary").notNull(),
    // Le plan tel que le modèle l'a produit (JSON), gardé pour comprendre après coup ce qui a été décidé.
    plan: jsonb("plan").notNull(),
    status: planStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_plans_campaign_idx").on(table.campaignId, table.createdAt),
    check("agent_plans_request_length", sql`char_length(btrim(${table.request})) between 1 and 4000`),
  ],
).enableRLS();

export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => agentPlans.id, { onDelete: "cascade" }),
    // Numéro d'affichage dans le plan (1, 2, 3…) : l'interface montre « 01 », « après 02 ».
    position: integer("position").notNull(),
    // Identifiant de l'agent (texte libre, comme dans messages : le moteur accepte d'autres équipes ; l'application vérifie).
    agent: text("agent").notNull(),
    title: text("title").notNull(),
    instruction: text("instruction").notNull(),
    status: taskStatusEnum("status").notNull().default("pending"),
    // Ce que l'agent a produit (chapitres 11 et 12) ; vide tant que la tâche n'est pas faite.
    output: jsonb("output"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_tasks_plan_position_idx").on(table.planId, table.position),
    index("agent_tasks_plan_status_idx").on(table.planId, table.status),
    check("agent_tasks_position_positive", sql`${table.position} >= 1`),
    check("agent_tasks_agent_length", sql`char_length(btrim(${table.agent})) between 1 and 40`),
    check("agent_tasks_title_length", sql`char_length(btrim(${table.title})) between 1 and 120`),
    check("agent_tasks_instruction_length", sql`char_length(btrim(${table.instruction})) between 1 and 4000`),
  ],
).enableRLS();

// « La tâche A attend la tâche B » : une TABLE de liaison plutôt qu'une liste d'identifiants dans la tâche, pour que la base
// refuse une dépendance vers une tâche qui n'existe pas et supprime les liens avec le plan. Les cycles (A attend B qui
// attend A), eux, ne se détectent pas en SQL simple : ils sont refusés par validatePlan avant tout enregistrement.
export const agentTaskDependencies = pgTable(
  "agent_task_dependencies",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.dependsOnTaskId] }),
    index("agent_task_dependencies_target_idx").on(table.dependsOnTaskId),
    check("agent_task_dependencies_not_self", sql`${table.taskId} <> ${table.dependsOnTaskId}`),
  ],
).enableRLS();

// Les échanges entre le Maître et un agent à propos d'une tâche (consigne donnée, résultat rendu, question posée).
export const agentCommunications = pgTable(
  "agent_communications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => agentTasks.id, { onDelete: "cascade" }),
    fromAgent: text("from_agent").notNull(),
    toAgent: text("to_agent").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agent_communications_task_idx").on(table.taskId, table.createdAt),
    check("agent_communications_message_length", sql`char_length(btrim(${table.message})) between 1 and 20000`),
  ],
).enableRLS();

export type AgentPlan = typeof agentPlans.$inferSelect;
export type AgentTask = typeof agentTasks.$inferSelect;
