"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { campaignSchema, MAX_CAMPAIGNS_PER_USER } from "@/lib/campaign-rules";
import { createCampaignWithinLimit } from "@/lib/campaign-store";
import { getSession } from "@/lib/dal";
import { rememberCampaign } from "@/lib/last-campaign";
import { readLogoFile } from "@/lib/logo-upload";
import { deleteLogo, uploadLogo } from "@/lib/storage";

export type CreateCampaignState = {
  // Un message par champ fautif, affiché sous le champ.
  fieldErrors?: { name?: string; icon?: string; office?: string; logo?: string };
  // Erreur qui ne concerne aucun champ en particulier (serveur, limite atteinte).
  message?: string;
};

// Crée une campagne. Rien de ce qui vient du navigateur n'est cru : la session donne le propriétaire,
// le schéma valide les champs, le logo est contrôlé sur ses octets (voir logo-check.ts).
export async function createCampaign(_previous: CreateCampaignState, formData: FormData): Promise<CreateCampaignState> {
  // 1. Qui est-ce ? Une action serveur est une adresse publique : on revérifie la session ici,
  //    même si la page qui affiche le formulaire est déjà protégée.
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const userId = session.user.id; // le propriétaire vient de la session, jamais du formulaire

  // 2. Les champs. Seuls name, office et icon sont lus : un champ « userId » ajouté à la main est ignoré.
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : undefined;
  };
  const parsed = campaignSchema.safeParse({
    name: text("name"),
    office: text("office"),
    icon: text("icon") || null, // champ caché vide = pas d'icône choisie
  });
  const logo = await readLogoFile(formData.get("logo"));

  if (!parsed.success || (logo && !logo.ok)) {
    const errors = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        name: errors.name?.[0],
        office: errors.office?.[0],
        icon: errors.icon?.[0],
        logo: logo && !logo.ok ? logo.error : undefined,
      },
    };
  }

  const limitMessage = `Tu as atteint la limite de ${MAX_CAMPAIGNS_PER_USER} campagnes.`;

  // 3. Refus rapide du plafond, avant d'envoyer un logo pour rien. Ce n'est qu'un confort : deux envois
  //    simultanés peuvent passer ici ensemble. Le contrôle qui fait foi est dans createCampaignWithinLimit.
  const [{ total }] = await db.select({ total: count() }).from(campaigns).where(eq(campaigns.userId, userId));
  if (total >= MAX_CAMPAIGNS_PER_USER) return { message: limitMessage };

  // 4. Envoi du logo, puis écriture en base. Si la campagne n'est finalement pas créée (plafond atteint
  //    entre-temps, ou erreur de base), on supprime le logo : sinon il resterait dans le stockage sans
  //    aucune campagne qui le référence.
  let logoKey: string | null = null;
  let createdId = "";
  const discardLogo = async () => {
    if (!logoKey) return;
    // Si la suppression échoue aussi, on ne l'avale pas : le fichier reste sans propriétaire, et cette
    // ligne dans le journal permet de le retrouver et de le supprimer à la main.
    await deleteLogo(userId, logoKey).catch((error) => console.error(`Logo orphelin à supprimer à la main : ${logoKey}`, error));
  };
  try {
    if (logo) logoKey = await uploadLogo(userId, logo);
    const outcome = await createCampaignWithinLimit({
      userId,
      name: parsed.data.name,
      office: parsed.data.office,
      // Le logo téléversé l'emporte sur l'icône si les deux arrivent (le formulaire les rend exclusifs).
      icon: logoKey ? `upload:${logoKey}` : parsed.data.icon ? `icon:${parsed.data.icon}` : null,
    });
    if (outcome.status === "limit") {
      await discardLogo();
      return { message: limitMessage };
    }
    createdId = outcome.id;
  } catch (error) {
    console.error("Création de campagne : échec", error);
    await discardLogo();
    return { message: "La campagne n’a pas pu être créée, réessaie." };
  }

  // 5. redirect() lève une exception spéciale : il doit rester HORS du try, sinon on l'avalerait.
  // La campagne qu'on vient de créer devient celle qu'on retrouve en revenant sur /dashboard.
  await rememberCampaign(createdId);
  redirect(`/dashboard/${createdId}/overview`);
}
