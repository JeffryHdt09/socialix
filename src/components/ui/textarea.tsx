import * as React from "react"
import { cn } from "cn"

// Zone de texte adaptée à docs/DESIGN.md, sur le modèle de Input : arrondi de 10 px, fond « surface 2 » (bg-muted), bordure fine
// qui passe à l'encre au focus, bordure d'erreur quand aria-invalid. Hauteur minimale de 44 px, redimensionnable en hauteur seulement.
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-11 w-full min-w-0 resize-y rounded-md border border-input bg-muted px-3 py-2.5 text-[15px] leading-relaxed text-foreground transition-colors duration-150 placeholder:text-muted-foreground focus-visible:border-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
