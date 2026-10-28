import { Pixelify_Sans } from "next/font/google";

// Police pixel des étiquettes du bureau : DESIGN.md la réserve à cet usage (« la touche jeu reste confinée »).
// Elle est déclarée ICI, et non dans le layout racine : next/font ne la charge alors que sur les pages qui
// affichent le bureau, pas sur toutes les pages du site.
export const pixelFont = Pixelify_Sans({ subsets: ["latin"], weight: ["500", "600"] });
