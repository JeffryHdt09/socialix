"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { projects } from "@/db/schema";
import { projectSchema, MAX_PROJECTS_PER_USER } from "@/lib/project-rules";
import { createProjectWithinLimit } from "@/lib/project-store";
import { getSession } from "@/lib/dal";
import { rememberProject } from "@/lib/last-project";
import { readLogoFile } from "@/lib/logo-upload";
import { deleteLogo, uploadLogo } from "@/lib/storage";

export type CreateProjectState = {
  // Un message par champ fautif, affiché sous le champ.
  fieldErrors?: { name?: string; icon?: string; office?: string; logo?: string; teams?: string };
  // Erreur qui ne concerne aucun champ en particulier (serveur, limite atteinte).
  message?: string;
};

// Crée un projet. Rien de ce qui vient du navigateur n'est cru : la session donne le propriétaire,
// le schéma valide les champs, le logo est contrôlé sur ses octets (voir logo-check.ts).
export async function createProject(_previous: CreateProjectState, formData: FormData): Promise<CreateProjectState> {
  // 1. Qui est-ce ? Une action serveur est une adresse publique : on revérifie la session ici,
  //    même si la page qui affiche le formulaire est déjà protégée.
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const userId = session.user.id; // le propriétaire vient de la session, jamais du formulaire

  // 2. Les champs. Seuls name, office, icon et teams sont lus : un champ « userId » ajouté à la main est ignoré.
  const text = (field: string) => {
    const value = formData.get(field);
    return typeof value === "string" ? value : undefined;
  };
  const parsed = projectSchema.safeParse({
    name: text("name"),
    office: text("office"),
    icon: text("icon") || null, // champ caché vide = pas d'icône choisie
    teams: formData.getAll("teams").filter((v): v is string => typeof v === "string"),
  });
  const logo = await readLogoFile(formData.get("logo"));

  if (!parsed.success || (logo && !logo.ok)) {
    const errors = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        name: errors.name?.[0],
        office: errors.office?.[0],
        icon: errors.icon?.[0],
        teams: errors.teams?.[0],
        logo: logo && !logo.ok ? logo.error : undefined,
      },
    };
  }

  const limitMessage = `Tu as atteint la limite de ${MAX_PROJECTS_PER_USER} projets.`;

  // 3. Refus rapide du plafond, avant d'envoyer un logo pour rien. Ce n'est qu'un confort : deux envois
  //    simultanés peuvent passer ici ensemble. Le contrôle qui fait foi est dans createProjectWithinLimit.
  const [{ total }] = await db.select({ total: count() }).from(projects).where(eq(projects.userId, userId));
  if (total >= MAX_PROJECTS_PER_USER) return { message: limitMessage };

  // 4. Envoi du logo, puis écriture en base. Si le projet n'est finalement pas créé (plafond atteint
  //    entre-temps, ou erreur de base), on supprime le logo : sinon il resterait dans le stockage sans
  //    aucun projet qui le référence.
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
    const outcome = await createProjectWithinLimit({
      userId,
      name: parsed.data.name,
      office: parsed.data.office,
      teams: parsed.data.teams,
      // Le logo téléversé l'emporte sur l'icône si les deux arrivent (le formulaire les rend exclusifs).
      icon: logoKey ? `upload:${logoKey}` : parsed.data.icon ? `icon:${parsed.data.icon}` : null,
    });
    if (outcome.status === "limit") {
      await discardLogo();
      return { message: limitMessage };
    }
    createdId = outcome.id;
  } catch (error) {
    console.error("Création de projet : échec", error);
    await discardLogo();
    return { message: "Le projet n’a pas pu être créé, réessaie." };
  }

  // 5. redirect() lève une exception spéciale : il doit rester HORS du try, sinon on l'avalerait.
  // Le projet qu'on vient de créer devient celui qu'on retrouve en revenant sur /dashboard.
  await rememberProject(createdId);
  redirect(`/dashboard/${createdId}/overview`);
}
