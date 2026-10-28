import type { Metadata } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

// Polices de docs/DESIGN.md. next/font les télécharge au build et les sert depuis notre site.
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Socialix",
  description: "Une équipe d’agents IA qui prépare, planifie et publie tes posts sur les réseaux sociaux.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning : next-themes ajoute la classe « dark » avant que React démarre,
    // ce qui différerait du HTML du serveur. L'avertissement ne vaut que pour cet élément.
    <html lang="fr" suppressHydrationWarning className={`${schibsted.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
