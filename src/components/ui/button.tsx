import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold tracking-tight ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary-dark text-primary-foreground shadow-[0_4px_14px_0_rgba(33,12,25,0.2)] hover:bg-primary-dark/95 hover:shadow-[0_6px_20px_rgba(33,12,25,0.3)] hover:scale-[1.02] active:scale-[0.98]",
        premium: "bg-accent-strong text-accent-strong-foreground shadow-md hover:bg-primary hover:text-primary-foreground hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]",
        outline: "border-2 border-primary-dark/20 bg-transparent text-primary-dark hover:bg-primary-dark hover:text-primary-foreground hover:border-primary-dark hover:shadow-lg transition-all",
        outlineWhite: "border-2 border-white/40 bg-transparent text-white hover:bg-white hover:text-primary-dark hover:border-white shadow-sm hover:shadow-xl active:scale-[0.97]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-primary-dark/5 text-primary-dark/70 hover:text-primary-dark font-semibold tracking-tight",
        link: "text-accent underline-offset-4 hover:underline font-bold tracking-tight",
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
