// Séparateur « ou » entre le bouton Google et le formulaire e-mail.
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      ou
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
