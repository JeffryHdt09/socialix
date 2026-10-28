import * as React from "react"
import { cn } from "cn"

// Champ adapté à docs/DESIGN.md (le code d'origine de shadcn/ui a été modifié) :
// 44 px de haut, arrondi de 10 px, fond « surface 2 » (bg-muted), bordure fine qui passe à l'encre
// au focus. Pas d'anneau propre : le contour encre global de globals.css s'applique aussi.
// Un champ en erreur (aria-invalid) prend la bordure d'erreur : la couleur ne suffit pas, le message
// d'erreur textuel est toujours affiché à côté.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-input bg-muted px-3 text-[15px] text-foreground transition-colors duration-150 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
