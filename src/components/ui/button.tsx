import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Botón de acción de la marca. El radio va como valor arbitrario y no como clase
        // propia para que tailwind-merge lo reconozca del mismo grupo que `rounded-md`
        // de la base y lo reemplace en vez de dejar las dos.
        cta: "rounded-[var(--radius-pill)] bg-cta text-cta-foreground font-bold uppercase tracking-wide shadow-primary transition-[filter,transform] hover:brightness-[0.97] active:scale-[0.99]",
        ctaOutline:
          "rounded-[var(--radius-pill)] border-2 border-current bg-transparent text-ink font-bold uppercase tracking-wide hover:bg-ink hover:text-ink-foreground hover:border-ink",
      },
      size: {
        default: "h-10 px-4 py-2",
        // Sin `rounded-md`: ya viene en la base, y repetirlo acá lo dejaba ganando por orden
        // sobre el radio de pastilla del variante `cta`.
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        xl: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
