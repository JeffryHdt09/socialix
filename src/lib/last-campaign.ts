import "server-only";

import { cookies } from "next/headers";

// La campagne qu'on a ouverte en dernier, pour y revenir en arrivant sur /dashboard (PAGES.md, fiche 1).
// Ce cookie n'est qu'une PRÉFÉRENCE : /dashboard le compare à la liste des campagnes de l'utilisateur
// connecté et l'ignore s'il n'y figure pas. Une valeur falsifiée ne donne donc accès à rien.
export const LAST_CAMPAIGN_COOKIE = "socialix_campaign";

export async function rememberCampaign(campaignId: string) {
  (await cookies()).set(LAST_CAMPAIGN_COOKIE, campaignId, {
    httpOnly: true, // le navigateur n'a pas besoin de le lire, seul le serveur s'en sert
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
