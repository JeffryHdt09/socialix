import Image from "next/image";

import { projectIcons } from "@/components/project/project-icon";
import type { ProjectIconKey } from "@/lib/project-rules";
import { cn } from "@/lib/utils";

// Le médaillon d'un projet : son logo téléversé, sinon son icône, sinon l'initiale de son nom.
// Décoratif (aria-hidden) : le nom du projet est toujours écrit à côté.
export function ProjectAvatar({
  name,
  iconKey,
  imageUrl,
  className,
}: {
  name: string;
  iconKey?: ProjectIconKey | null;
  imageUrl?: string | null;
  className?: string;
}) {
  const Icon = iconKey ? projectIcons[iconKey].Icon : null;
  // Array.from découpe par caractère complet : charAt(0) coupe un emoji (« 🍕 Pizza ») en deux moitiés
  // et afficherait un caractère cassé.
  const initial = (Array.from(name.trim())[0] ?? "").toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted text-xl font-bold text-foreground",
        className,
      )}
    >
      {imageUrl ? (
        // unoptimized : l'image vient du stockage (ou de l'aperçu local), elle est déjà petite et contrôlée.
        <Image src={imageUrl} alt="" width={56} height={56} unoptimized className="size-full object-cover" />
      ) : Icon ? (
        <Icon className="size-6" />
      ) : (
        initial || "?"
      )}
    </span>
  );
}
