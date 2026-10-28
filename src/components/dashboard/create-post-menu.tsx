"use client";

import { ChevronDown, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Bouton « Créer un post » de l'en-tête (PAGES.md, fiche 3) : un petit choix entre deux façons de créer.
// - « Avec l'équipe IA » mène à la page Agents (le chat arrive aux chapitres 8 à 12) ;
// - « À la main » ouvrira l'éditeur de post, qui n'existe qu'au chapitre 13 : on le montre grisé, avec la
//   mention « bientôt », plutôt que de cacher l'option ou de la laisser mener nulle part.
export function CreatePostMenu({ variant = "default" }: { variant?: "default" | "outline" }) {
  const { campaignId } = useParams<{ campaignId: string }>();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant}>
          Créer un post
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/${campaignId}/agents`}>
            <Sparkles aria-hidden="true" />
            Avec l’équipe IA
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <PenLine aria-hidden="true" />
          À la main
          <span className="ml-auto rounded-full border border-border px-2 py-0.5 text-[12px] font-medium text-muted-foreground">Bientôt</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
