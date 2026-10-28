"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

type Props = { googleEnabled: boolean; googleFailed: boolean };

export function SignInForm({ googleEnabled, googleFailed }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); // on gère l'envoi nous-mêmes, sans recharger la page
    setError(null);
    setPending(true);

    try {
      // Appelle POST /api/auth/sign-in/email. En cas de succès, Better Auth pose le cookie de session.
      const { error } = await authClient.signIn.email({ email, password });

      if (error) {
        // Volontairement le même message si l'e-mail ou le mot de passe est faux :
        // on ne dit pas à un inconnu quelles adresses ont un compte.
        setError(authErrorMessage(error));
        setPending(false);
        return;
      }
    } catch {
      // Réseau coupé : l'appel lève une exception au lieu de renvoyer { error }.
      // pending n'est pas remis à false dans un finally : après un succès, le bouton reste
      // désactivé pendant la navigation.
      setError(authErrorMessage({}));
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh(); // relit les pages serveur, qui voient maintenant la session
  }

  return (
    <>
      <h1 className="text-[28px] font-bold tracking-tight">Connexion</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">Content de te revoir.</p>

      {googleFailed && (
        <p role="alert" className="mt-6 text-[14px] font-medium text-destructive">
          La connexion avec Google a échoué, réessaie.
        </p>
      )}

      {googleEnabled && (
        <div className="mt-8 flex flex-col gap-5">
          <GoogleButton returnTo="/sign-in" />
          <OrDivider />
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${googleEnabled ? "mt-5" : "mt-8"} flex flex-col gap-5`}>
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField value={password} onChange={setPassword} autoComplete="current-password" />

        {error && (
          <p role="alert" className="text-[14px] font-medium text-destructive">
            {error}
          </p>
        )}

        <SubmitButton pending={pending} label="Se connecter" pendingLabel="Connexion…" />
      </form>

      <p className="mt-6 text-[14px] text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/sign-up" className="font-semibold text-foreground underline underline-offset-4">
          Créer un compte
        </Link>
      </p>
    </>
  );
}
