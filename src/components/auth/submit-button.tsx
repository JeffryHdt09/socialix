// Bouton principal : fond encre (DESIGN.md, l'accent jaune n'est jamais un bouton).
// Pendant l'envoi, il change de texte et se désactive pour éviter un double clic.
export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-[10px] bg-encre text-[15px] font-semibold text-surface transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
