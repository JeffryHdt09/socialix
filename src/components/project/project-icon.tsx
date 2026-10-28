import {
  BookOpen,
  Camera,
  Coffee,
  Dumbbell,
  Flower2,
  type LucideIcon,
  Music,
  Palette,
  PawPrint,
  Scissors,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from "lucide-react";

import { PROJECT_ICON_KEYS, type ProjectIconKey } from "@/lib/project-rules";

// Les icônes proposées pour un projet : clé stockée, dessin (lucide-react) et libellé français.
// Record<ProjectIconKey, …> oblige à couvrir toutes les clés de project-rules.ts.
export const projectIcons: Record<ProjectIconKey, { label: string; Icon: LucideIcon }> = {
  coffee: { label: "Café", Icon: Coffee },
  store: { label: "Boutique", Icon: Store },
  flower: { label: "Fleurs", Icon: Flower2 },
  camera: { label: "Photo", Icon: Camera },
  utensils: { label: "Restaurant", Icon: UtensilsCrossed },
  scissors: { label: "Coiffure", Icon: Scissors },
  dumbbell: { label: "Sport", Icon: Dumbbell },
  book: { label: "Livres", Icon: BookOpen },
  bag: { label: "Achats", Icon: ShoppingBag },
  palette: { label: "Art", Icon: Palette },
  music: { label: "Musique", Icon: Music },
  paw: { label: "Animaux", Icon: PawPrint },
};

// Même ordre que PROJECT_ICON_KEYS, pour afficher la grille de choix.
export const projectIconList = PROJECT_ICON_KEYS.map((key) => ({ key, ...projectIcons[key] }));
