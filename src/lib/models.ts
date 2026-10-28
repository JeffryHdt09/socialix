import "server-only";

// Les modèles que le chat des agents peut utiliser, du premier choix au dernier recours (PLAN.md, décision D9 :
// une LISTE ordonnée, jamais un modèle écrit en dur dans le code des agents). En cas d'erreur de quota (429) ou de modèle
// retiré (404), on essaie le suivant : le repli est écrit à l'étape 9.4.
// Mesuré à l'étape 9.1 : 2.5-flash répond en ~1 s ; les modèles 3.x réfléchissent d'abord (plus lents, plus de quota).
// À revérifier de temps en temps : les modèles changent vite (« 2.5-flash-lite » n'est déjà plus proposé aux nouveaux comptes).
export const CHAT_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash"] as const;
