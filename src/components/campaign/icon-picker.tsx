"use client";

import { campaignIconList } from "@/components/campaign/campaign-icon";
import type { CampaignIconKey } from "@/lib/campaign-rules";

// Grille de choix de l'icône. Ce sont de vrais boutons radio (un seul choix, flèches du clavier pour
// passer de l'un à l'autre), cachés visuellement ; l'étiquette autour sert de bouton. Chaque icône a
// un libellé pour les lecteurs d'écran : l'état ne repose pas sur le dessin seul.
export function IconPicker({
  value,
  onChange,
}: {
  value: CampaignIconKey | null;
  onChange: (key: CampaignIconKey) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Icône de la campagne" className="grid grid-cols-6 gap-2">
      {campaignIconList.map(({ key, label, Icon }) => (
        <label
          key={key}
          title={label}
          className="relative grid h-12 cursor-pointer place-items-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors duration-150 hover:border-foreground hover:text-foreground has-checked:border-foreground has-checked:bg-card has-checked:text-foreground has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
        >
          <input
            type="radio"
            name="icon-choice" // le vrai champ envoyé est le champ caché « icon » du formulaire
            value={key}
            checked={value === key}
            onChange={() => onChange(key)}
            className="sr-only"
          />
          <Icon className="size-5" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </div>
  );
}
