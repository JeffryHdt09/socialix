"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";

// Bouton « Continuer avec Google ». Le logo « G » multicolore est celui qu'exigent
// les règles de marque de Google pour les boutons de connexion.
export function GoogleButton({ returnTo }: { returnTo: "/sign-in" | "/sign-up" }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // Si la redirection n'a pas pu partir, on réactive le bouton et on le dit. Pas de finally :
  // en cas de succès, le navigateur part vers Google et le bouton doit rester désactivé.
  function onError() {
    setFailed(true);
    setPending(false);
  }

  async function handleClick() {
    setFailed(false);
    setPending(true);
    // Better Auth renvoie le navigateur vers Google. Après accord, Google revient sur
    // /api/auth/callback/google, puis Better Auth redirige vers callbackURL (ou errorCallbackURL en cas d'échec).
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: returnTo,
      });
      if (error) onError();
    } catch {
      onError(); // réseau coupé : l'appel lève une exception
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-[10px] border border-filet bg-surface text-[15px] font-semibold text-encre transition-colors duration-150 hover:border-encre disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {pending ? "Redirection vers Google…" : "Continuer avec Google"}
      </button>
      {failed && (
        <p role="alert" className="text-[14px] font-medium text-erreur">
          La connexion avec Google n’a pas pu démarrer. Vérifie ta connexion, puis réessaie.
        </p>
      )}
    </div>
  );
}
