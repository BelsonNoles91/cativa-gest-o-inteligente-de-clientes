import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold tracking-tight ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary-dark text-white shadow-lg shadow-primary-dark/20 hover:bg-primary-dark/90 hover:shadow-xl hover:shadow-primary-dark/30 hover:scale-[1.02]",
        premium: "bg-accent text-white shadow-lg shadow-accent/30 hover:bg-white hover:text-primary-dark hover:shadow-xl hover:shadow-accent/40 hover:scale-[1.05]",
        outline: "border-2 border-primary-dark/60 bg-transparent text-primary-dark hover:bg-primary-dark hover:text-white hover:border-primary-dark",
        outlineWhite: "border-2 border-white/60 bg-transparent text-white hover:bg-white hover:text-primary-dark hover:border-white shadow-sm hover:shadow-xl",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent/10 hover:text-accent font-bold uppercase tracking-widest text-[10px]",
        link: "text-accent underline-offset-4 hover:underline font-bold uppercase tracking-widest text-[10px]",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-10 px-4",
        lg: "h-16 px-10 text-lg md:text-xl",
        xl: "h-20 px-12 text-xl md:text-2xl",
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
