import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { failedPasswordRules, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/password-rules";

// Adresses où un nouveau mot de passe est choisi, et le nom du champ qui le contient.
const passwordFields: Record<string, "password" | "newPassword"> = {
  "/sign-up/email": "password",
  "/reset-password": "newPassword",
  "/change-password": "newPassword",
};

// Connexion avec Google, activée seulement si les deux clés sont dans .env.local.
const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined;

// Les pages s'en servent pour n'afficher le bouton Google que s'il fonctionne.
export const googleEnabled = Boolean(google);

// Le cerveau de l'authentification, côté serveur uniquement.
// Better Auth lit tout seul BETTER_AUTH_SECRET (signature des cookies) et BETTER_AUTH_URL (adresse de l'app).
export const auth = betterAuth({
  // Les comptes et les sessions sont rangés dans notre base, via Drizzle.
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true, // mots de passe hachés par Better Auth, jamais stockés en clair
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
  },
  // Google renvoie l'utilisateur vers /api/auth/callback/google, que notre route [...all] reçoit déjà.
  socialProviders: google ? { google } : {},
  hooks: {
    // Contrôle final des règles de mot de passe. Le formulaire les affiche déjà, mais une requête
    // peut être envoyée sans passer par lui : c'est le serveur qui a le dernier mot.
    before: createAuthMiddleware(async (ctx) => {
      const field = passwordFields[ctx.path];
      if (!field) return;
      const password: unknown = ctx.body?.[field];
      if (typeof password !== "string") return; // Better Auth refusera lui-même un champ manquant
      const failed = failedPasswordRules(password);
      if (failed.length > 0) {
        throw new APIError("BAD_REQUEST", {
          code: "PASSWORD_TOO_WEAK",
          message: `Mot de passe trop faible. Il manque : ${failed.map((r) => r.label.toLowerCase()).join(", ")}.`,
        });
      }
    }),
  },
  // Permet aux actions serveur de Next de poser le cookie de session. Doit rester le dernier plugin.
  plugins: [nextCookies()],
});
