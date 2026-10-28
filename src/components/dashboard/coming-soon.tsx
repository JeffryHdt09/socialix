// Contenu provisoire d'une page pas encore construite. Honnête (DESIGN.md : pas de faux contenu) : il dit
// ce qui manque et à quel chapitre du plan ça arrive, au lieu d'un faux tableau ou de faux chiffres.
// Bordure en pointillés : « pas encore confirmé ».
export function ComingSoon({ chapter, what }: { chapter: string; what: string }) {
  return (
    <section className="rounded-xl border border-dashed border-border p-8">
      <p className="text-[15px] font-semibold">Cette page n’est pas encore construite.</p>
      <p className="mt-1 text-[15px] text-muted-foreground">
        Elle arrive au <span className="font-mono text-[13px]">chapitre {chapter}</span> du plan : {what}.
      </p>
    </section>
  );
}
