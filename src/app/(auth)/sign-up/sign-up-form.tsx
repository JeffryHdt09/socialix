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
import { authErrorMessage, isEmailTaken } from "@/lib/auth-errors";
import { failedPasswordRules } from "@/lib/password-rules";

type Props = { googleEnabled: boolean; googleFailed: boolean };

export function SignUpForm({ googleEnabled, googleFailed }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setEmailTaken(false);

    // Premier contrôle dans le navigateur, pour répondre tout de suite. Le serveur refait le contrôle.
    if (failedPasswordRules(password).length > 0) {
      setError("Le mot de passe ne respecte pas encore toutes les règles ci-dessus.");
      return;
    }

    setPending(true);
    try {
      // Appelle POST /api/auth/sign-up/email : crée le compte et ouvre directement une session.
      const { error } = await authClient.signUp.email({ name: name.trim(), email, password });

      if (error) {
        setEmailTaken(isEmailTaken(error));
        setError(authErrorMessage(error));
        setPending(false);
        return;
      }
    } catch {
      // Réseau coupé : on réactive le bouton et on affiche le message générique.
      setError(authErrorMessage({}));
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <h1 className="text-[28px] font-bold tracking-tight">Créer un compte</h1>
      <p className="mt-1 text-[15px] text-muted-foreground">Ton équipe d’agents se met au travail dès le premier projet.</p>

      {googleFailed && (
        <p role="alert" className="mt-6 text-[14px] font-medium text-destructive">
          La connexion avec Google a échoué, réessaie.
        </p>
      )}

      {googleEnabled && (
        <div className="mt-8 flex flex-col gap-5">
          <GoogleButton returnTo="/sign-up" />
          <OrDivider />
        </div>
      )}

      <form onSubmit={handleSubmit} className={`${googleEnabled ? "mt-5" : "mt-8"} flex flex-col gap-5`}>
        <TextField
          label="Nom"
          name="name"
          autoComplete="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" showRules />

        {error && (
          <p role="alert" className="text-[14px] font-medium text-destructive">
            {error}{" "}
            {emailTaken && (
              <Link href="/sign-in" className="text-foreground underline underline-offset-4">
                Se connecter
              </Link>
            )}
          </p>
        )}

        <SubmitButton pending={pending} label="Créer mon compte" pendingLabel="Création du compte…" />
      </form>

      <p className="mt-6 text-[14px] text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/sign-in" className="font-semibold text-foreground underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </>
  );
}
