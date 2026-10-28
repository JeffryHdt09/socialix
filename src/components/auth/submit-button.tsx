import { Button } from "@/components/ui/button";

// Bouton d'envoi d'un formulaire : le bouton principal (encre) de la charte, sur toute la largeur.
// Pendant l'envoi, il change de texte et se désactive pour éviter un double clic.
export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}
