// Le schéma de la base : la description de nos tables en TypeScript.
// Drizzle s'en sert pour typer nos requêtes, drizzle-kit pour générer les migrations.

// Tables de Better Auth (user, session, account, verification).
// Fichier généré par `npx auth generate` : ne pas le modifier à la main.
export * from "./auth-schema";
