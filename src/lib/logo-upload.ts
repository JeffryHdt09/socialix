import "server-only";

import { checkLogoBytes, LOGO_ERROR, LOGO_MAX_BYTES, type LogoCheck } from "@/lib/logo-check";

export type LogoFile = Extract<LogoCheck, { ok: true }> & { bytes: Uint8Array };

// Lit le fichier d'un formulaire et le contrôle. Renvoie :
// - null : aucun fichier envoyé (le champ est resté vide, c'est permis) ;
// - { ok: false, error } : fichier refusé, avec un message à montrer à l'utilisateur ;
// - { ok: true, bytes, … } : fichier valide, prêt à être envoyé au stockage.
export async function readLogoFile(value: FormDataEntryValue | null): Promise<LogoFile | { ok: false; error: string } | null> {
  if (value === null) return null;
  // Un champ « file » vide arrive comme un File de 0 octet ; une chaîne n'est pas un fichier du tout.
  if (typeof value === "string") return value === "" ? null : { ok: false, error: LOGO_ERROR };
  if (value.size === 0) return null;

  // Refus rapide, avant de charger le fichier en mémoire. value.size vient du navigateur : on revérifie
  // la vraie taille des octets ensuite, dans checkLogoBytes.
  if (value.size > LOGO_MAX_BYTES) return { ok: false, error: LOGO_ERROR };

  const bytes = new Uint8Array(await value.arrayBuffer());
  const check = checkLogoBytes(bytes);
  return check.ok ? { ...check, bytes } : check;
}
