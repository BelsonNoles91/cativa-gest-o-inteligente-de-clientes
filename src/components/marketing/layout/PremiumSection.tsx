import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PremiumSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  variant?: "light" | "dark" | "soft" | "gradient" | "transparent" | "accent";
  padding?: "none" | "xs" | "sm" | "md" | "lg" | "xl";
  containerSize?: "sm" | "md" | "lg" | "xl" | "full";
}

export function PremiumSection({
  children,
  className,
  id,
  variant = "light",
  padding = "lg",
  containerSize = "lg",
}: PremiumSectionProps) {
  const variants = {
    light: "bg-background text-foreground",
    dark: "bg-[#1A0F16] text-white", // Darker, more sophisticated purple-black
    soft: "bg-[#FAF7F9] text-foreground",
    gradient: "bg-gradient-to-b from-[#FAF7F9] to-white text-foreground",
    transparent: "bg-transparent",
    accent: "bg-primary text-primary-foreground",
  };

  const paddings = {
    none: "py-0",
    xs: "py-8 md:py-12",
    sm: "py-12 md:py-20",
    md: "py-20 md:py-32",
    lg: "py-32 md:py-48",
    xl: "py-48 md:py-64",
  };

  const containers = {
    sm: "max-w-3xl",
    md: "max-w-5xl",
    lg: "max-w-7xl",
    xl: "max-w-[90rem]",
    full: "max-w-none px-0",
  };

  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden selection:bg-accent/30",
        variants[variant],
        paddings[padding],
        className
      )}
    >
      <div className={cn("container relative z-10 mx-auto px-6 md:px-8", containers[containerSize])}>
        {children}
      </div>
    </section>
  );
}

export function PremiumGrid({
  children,
  className,
  cols = "1",
  gap = "md",
}: {
  children: ReactNode;
  className?: string;
  cols?: "1" | "2" | "3" | "4" | "flexible";
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const colStyles = {
    "1": "grid-cols-1",
    "2": "grid-cols-1 md:grid-cols-2",
    "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    flexible: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  const gapStyles = {
    xs: "gap-2 md:gap-4",
    sm: "gap-4 md:gap-6",
    md: "gap-8 md:gap-12",
    lg: "gap-12 md:gap-20",
    xl: "gap-20 md:gap-32",
  };

  return (
    <div className={cn("grid", colStyles[cols], gapStyles[gap], className)}>
      {children}
    </div>
  );
}
