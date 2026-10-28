import Link from "next/link";

import { Button } from "@/components/ui/button";

// Affiché quand une campagne est introuvable. Le message est VOLONTAIREMENT identique que la campagne
// n'existe pas, qu'elle appartienne à quelqu'un d'autre ou que l'adresse soit invalide : dire « elle
// existe mais n'est pas à toi » révélerait qu'elle existe.
export default function CampaignNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-start justify-center gap-4 px-4 py-10 sm:px-10">
      <h1 className="text-[28px] font-bold tracking-tight">Campagne introuvable</h1>
      <p className="text-[15px] text-muted-foreground">Cette campagne n’existe pas, ou tu n’y as pas accès.</p>
      <Button asChild>
        <Link href="/dashboard">Retourner à mes campagnes</Link>
      </Button>
    </main>
  );
}
