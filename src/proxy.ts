import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Proxy (ex-middleware) : s'exécute avant chaque requête qui correspond au matcher ci-dessous.
// Contrôle « optimiste » : on regarde seulement si le cookie de session existe, sans lire la base,
// car le proxy tourne aussi sur les pages préchargées. Il écarte vite les visiteurs sans cookie ;
// le vrai contrôle reste verifySession() dans chaque page (src/lib/dal.ts).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/campaigns/:path*"],
};
