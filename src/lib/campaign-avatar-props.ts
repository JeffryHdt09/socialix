import "server-only";

import { parseStoredIcon } from "@/lib/campaign-rules";
import { logoUrl } from "@/lib/storage";
import type { Campaign } from "@/db/schema";

// Ce qu'il faut pour dessiner le médaillon d'une campagne enregistrée (voir CampaignAvatar) :
// son icône, ou l'adresse publique de son logo. Une valeur inattendue en base (modifiée à la main,
// clé invalide) donne un médaillon avec l'initiale du nom, jamais une page en erreur.
export function avatarPropsFor(campaign: Pick<Campaign, "name" | "icon">) {
  const stored = parseStoredIcon(campaign.icon);
  if (stored.kind === "icon") return { name: campaign.name, iconKey: stored.key, imageUrl: null };
  if (stored.kind === "upload") {
    try {
      return { name: campaign.name, iconKey: null, imageUrl: logoUrl(stored.key) };
    } catch {
      // clé de logo invalide : on retombe sur l'initiale
    }
  }
  return { name: campaign.name, iconKey: null, imageUrl: null };
}
