import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { FormSkeleton } from "@/components/auth/form-skeleton";
import { googleEnabled } from "@/lib/auth";
import { getSession } from "@/lib/dal";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Connexion · Socialix" };

// Lire la session et l'adresse (searchParams) se fait à chaque requête : avec les Cache Components,
// Next exige que ce soit derrière un <Suspense>. La page part tout de suite avec le squelette,
// puis le formulaire arrive dès que la session est lue.
export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInContent({ searchParams }: Pick<PageProps<"/sign-in">, "searchParams">) {
  // Déjà connecté : inutile de revoir ce formulaire.
  if (await getSession()) redirect("/dashboard");
  // Better Auth ajoute ?error=... à l'adresse quand la connexion avec Google échoue.
  const { error } = await searchParams;
  return <SignInForm googleEnabled={googleEnabled} googleFailed={Boolean(error)} />;
}
