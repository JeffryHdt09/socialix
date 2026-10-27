import "server-only"; // erreur de build si ce fichier est importé dans du code navigateur

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

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
