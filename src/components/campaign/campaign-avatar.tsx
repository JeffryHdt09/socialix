import Image from "next/image";

import { campaignIcons } from "@/components/campaign/campaign-icon";
import type { CampaignIconKey } from "@/lib/campaign-rules";
import { cn } from "@/lib/utils";

// Le médaillon d'une campagne : son logo téléversé, sinon son icône, sinon l'initiale de son nom.
// Décoratif (aria-hidden) : le nom de la campagne est toujours écrit à côté.
export function CampaignAvatar({
  name,
  iconKey,
  imageUrl,
  className,
}: {
  name: string;
  iconKey?: CampaignIconKey | null;
  imageUrl?: string | null;
  className?: string;
}) {
  const Icon = iconKey ? campaignIcons[iconKey].Icon : null;
  const initial = name.trim().charAt(0).toUpperCase();

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
