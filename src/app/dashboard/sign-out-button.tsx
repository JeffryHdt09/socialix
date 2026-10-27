"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleSignOut() {
    setFailed(false);
    setPending(true);
    try {
      // Supprime la session en base et efface le cookie.
      const { error } = await authClient.signOut();
      if (error) throw error;
    } catch {
      // On ne redirige qu'après un succès : sinon /sign-in retrouverait la session encore active
      // et renverrait vers /dashboard, alors que l'utilisateur croit être déconnecté.
      setFailed(true);
      setPending(false);
      return;
    }
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="h-11 rounded-[10px] border border-filet px-4 text-[14px] font-medium hover:border-encre disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Déconnexion…" : "Se déconnecter"}
      </button>
      {failed && (
        <p role="alert" className="text-[13px] font-medium text-erreur">
          La déconnexion a échoué, réessaie.
        </p>
      )}
    </div>
  );
}
