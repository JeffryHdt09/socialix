"use client";

import { ChevronDown, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Bouton « Créer un post » de l'en-tête (PAGES.md, fiche 3) : un petit choix entre deux façons de créer.
// - « Avec l'équipe IA » mène à la page Agents (le chat arrive aux chapitres 8 à 12) ;
// - « À la main » ouvre l'éditeur de post (chapitre 13).
export function CreatePostMenu({ variant = "default" }: { variant?: "default" | "outline" }) {
  const { projectId } = useParams<{ projectId: string }>();

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
          <Link href={`/dashboard/${projectId}/agents`}>
            <Sparkles aria-hidden="true" />
            Avec l’équipe IA
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/${projectId}/posts/new`}>
            <PenLine aria-hidden="true" />
            À la main
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
