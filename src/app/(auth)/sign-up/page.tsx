import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FormSkeleton } from "@/components/auth/form-skeleton";
import { googleEnabled } from "@/lib/auth";
import { getSession } from "@/lib/dal";

import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Créer un compte · Socialix" };

// Même principe que la page de connexion : la lecture de la session passe derrière un <Suspense>.
export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <SignUpContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUpContent({ searchParams }: Pick<PageProps<"/sign-up">, "searchParams">) {
  // Déjà connecté : inutile de revoir ce formulaire.
  if (await getSession()) redirect("/dashboard");
  // Better Auth ajoute ?error=... à l'adresse quand la connexion avec Google échoue.
  const { error } = await searchParams;
  return <SignUpForm googleEnabled={googleEnabled} googleFailed={Boolean(error)} />;
}
