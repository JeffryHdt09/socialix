// Règles de mot de passe, partagées par le formulaire (aide en direct) et le serveur (contrôle final).
// Base : recommandation CNIL de 2022 (option 1) : au moins 12 caractères, avec majuscule,
// minuscule, chiffre et caractère spécial. Le maximum de 128 est celui de Better Auth.
// \p{...} reconnaît aussi les lettres accentuées : « É » compte comme une majuscule.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const passwordRules = [
  { id: "length", label: `Au moins ${PASSWORD_MIN_LENGTH} caractères`, test: (p: string) => p.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", label: "Une majuscule", test: (p: string) => /\p{Lu}/u.test(p) },
  { id: "lower", label: "Une minuscule", test: (p: string) => /\p{Ll}/u.test(p) },
  { id: "digit", label: "Un chiffre", test: (p: string) => /\p{Nd}/u.test(p) },
  { id: "special", label: "Un caractère spécial (! ? @ # …)", test: (p: string) => /[^\p{L}\p{N}]/u.test(p) },
] as const;

// Renvoie les règles non respectées : une liste vide veut dire que le mot de passe est accepté.
export function failedPasswordRules(password: string) {
  return passwordRules.filter((rule) => !rule.test(password));
}
