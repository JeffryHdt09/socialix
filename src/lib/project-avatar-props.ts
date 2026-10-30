import "server-only";

import { parseStoredIcon } from "@/lib/project-rules";
import { logoUrl } from "@/lib/storage";
import type { Project } from "@/db/schema";

// Ce qu'il faut pour dessiner le médaillon d'un projet enregistré (voir ProjectAvatar) :
// son icône, ou l'adresse publique de son logo. Une valeur inattendue en base (modifiée à la main,
// clé invalide) donne un médaillon avec l'initiale du nom, jamais une page en erreur.
export function avatarPropsFor(project: Pick<Project, "name" | "icon">) {
  const stored = parseStoredIcon(project.icon);
  if (stored.kind === "icon") return { name: project.name, iconKey: stored.key, imageUrl: null };
  if (stored.kind === "upload") {
    try {
      return { name: project.name, iconKey: null, imageUrl: logoUrl(stored.key) };
    } catch {
      // clé de logo invalide : on retombe sur l'initiale
    }
  }
  return { name: project.name, iconKey: null, imageUrl: null };
}
