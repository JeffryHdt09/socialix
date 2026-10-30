import "server-only";

import { cookies } from "next/headers";

// Le projet qu'on a ouvert en dernier, pour y revenir en arrivant sur /dashboard (PAGES.md, fiche 1).
// Ce cookie n'est qu'une PRÉFÉRENCE : /dashboard le compare à la liste des projets de l'utilisateur
// connecté et l'ignore s'il n'y figure pas. Une valeur falsifiée ne donne donc accès à rien.
export const LAST_PROJECT_COOKIE = "socialix_project";

export async function rememberProject(projectId: string) {
  (await cookies()).set(LAST_PROJECT_COOKIE, projectId, {
    httpOnly: true, // le navigateur n'a pas besoin de le lire, seul le serveur s'en sert
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
