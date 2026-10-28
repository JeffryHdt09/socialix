"use client";

import { useEffect, useRef } from "react";

import { refreshPlans } from "@/app/dashboard/chat-actions";
import type { PlanView } from "@/lib/plan-types";

// Tant qu'un plan est actif, ses tâches avancent en arrière-plan : on relit l'état toutes les 4 secondes pour que la carte
// bouge sans recharger la page. Ça s'arrête tout seul quand plus aucun plan n'est actif, et ça se met en pause quand l'onglet
// n'est pas visible (inutile de questionner le serveur pour personne). Une seule demande à la fois.
const POLL_MS = 4000;

export function usePlanPolling(projectId: string, plans: PlanView[], replace: (plans: PlanView[]) => void) {
  const active = plans.some((p) => p.status === "active");
  const busy = useRef(false);

  useEffect(() => {
    if (!active) return;
    const tick = async () => {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        const fresh = await refreshPlans(projectId);
        // Liste vide = session expirée ou projet disparu : on garde ce qu'on affiche plutôt que de tout effacer
        if (fresh.length > 0) replace(fresh);
      } catch {
        // Réseau coupé : le prochain tour réessaiera
      } finally {
        busy.current = false;
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [active, projectId, replace]);
}
