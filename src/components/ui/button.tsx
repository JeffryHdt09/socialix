import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Bouton adapté à docs/DESIGN.md (le code d'origine de shadcn/ui a été modifié) :
// - 44 px de haut par défaut (zones cliquables >= 44 px), arrondi de 10 px (rounded-md) ;
// - bouton principal = encre (bg-primary). Le jaune « signal » n'est JAMAIS un bouton : pas de variante jaune ;
// - pas de bordure de focus propre : c'est le contour encre global de globals.css qui s'applique ;
// - mouvement court (150 ms) et limité aux couleurs, pas d'effet gratuit au clic.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 select-none disabled:pointer-events-none disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border-border bg-card text-foreground hover:border-foreground aria-expanded:border-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-border",
        ghost: "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent",
        destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20",
        link: "text-foreground underline underline-offset-4 hover:no-underline",
      },
      size: {
        default: "h-11 gap-2 px-4",
        // Compact, pour les barres denses (calendrier, filtres). Sur écran tactile, il retrouve 44 px.
        sm: "h-9 gap-1.5 px-3 text-[14px] pointer-coarse:h-11",
        lg: "h-12 gap-2 px-6",
        icon: "size-11",
        "icon-sm": "size-9 pointer-coarse:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
