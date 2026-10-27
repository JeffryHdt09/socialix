import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// La porte d'entrée de Better Auth : toutes les adresses /api/auth/* (inscription, connexion,
// déconnexion, retour de Google...) arrivent ici et sont confiées à auth.handler.
export const { GET, POST } = toNextJsHandler(auth);
