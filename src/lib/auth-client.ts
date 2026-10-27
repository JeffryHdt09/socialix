import { createAuthClient } from "better-auth/react";

// Le pendant de auth.ts côté navigateur : il appelle notre route /api/auth/*.
// Sans adresse précisée, il utilise celle du site, ce qui marche en local comme en production.
export const authClient = createAuthClient();
