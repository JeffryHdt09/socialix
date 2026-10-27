// Séparateur « ou » entre le bouton Google et le formulaire e-mail.
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[13px] text-secondaire">
      <span className="h-px flex-1 bg-filet" />
      ou
      <span className="h-px flex-1 bg-filet" />
    </div>
  );
}
