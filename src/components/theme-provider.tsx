"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes pose ou retire la classe « dark » sur <html> et retient le choix de l'utilisateur
// (localStorage). Un petit script inséré dans la page l'applique avant l'affichage, pour éviter
// un éclair de la mauvaise couleur au chargement.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
