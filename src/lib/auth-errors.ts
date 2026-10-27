// Traduit les erreurs renvoyées par Better Auth en phrases claires pour l'utilisateur.
// Better Auth répond avec un code stable (ex. INVALID_EMAIL_OR_PASSWORD) : on s'appuie
// sur ce code plutôt que sur son message en anglais.

type AuthError = { code?: string; message?: string; status?: number };

const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe incorrect.",
  INVALID_EMAIL: "Cette adresse e-mail n’est pas valide.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cet e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un compte existe déjà avec cet e-mail.",
  PASSWORD_TOO_SHORT: "Le mot de passe est trop court.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long (128 caractères maximum).",
};

export function authErrorMessage(error: AuthError): string {
  if (error.status === 429) return "Trop de tentatives. Patiente une minute, puis réessaie.";
  // Notre propre contrôle (auth.ts) renvoie déjà un message en français.
  if (error.code === "PASSWORD_TOO_WEAK" && error.message) return error.message;
  if (error.code && messages[error.code]) return messages[error.code];
  return "Une erreur est survenue. Vérifie ta connexion, puis réessaie.";
}

export function isEmailTaken(error: AuthError) {
  return error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL";
}
