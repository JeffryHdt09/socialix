import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// Réécrit par rapport à la version de shadcn/ui : l'original change un état dans un useEffect, ce que la règle
// react-hooks/set-state-in-effect de ce projet refuse. useSyncExternalStore est la méthode prévue par React
// pour lire une valeur qui vit hors de React (ici, la largeur de la fenêtre) et suivre ses changements.
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches, // valeur dans le navigateur
    () => false // valeur pendant le rendu serveur : « pas téléphone », corrigée dès l'hydratation
  )
}
