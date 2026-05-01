import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PremiumSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  variant?: "light" | "dark" | "soft" | "gradient" | "transparent";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
}

export function PremiumSection({
  children,
  className,
  id,
  variant = "light",
  padding = "lg",
}: PremiumSectionProps) {
  const variants = {
    light: "bg-background text-foreground",
    dark: "bg-primary-dark text-white",
    soft: "bg-[#FAF7F9] text-foreground",
    gradient: "bg-gradient-soft text-foreground",
    transparent: "bg-transparent",
  };

  const paddings = {
    none: "py-0",
    sm: "py-12 md:py-16",
    md: "py-16 md:py-24",
    lg: "py-24 md:py-32",
    xl: "py-32 md:py-48",
  };

  return (
    <section
      id={id}
      className={cn(
        "relative overflow-hidden",
        variants[variant],
        paddings[padding],
        className
      )}
    >
      <div className="container relative z-10">{children}</div>
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
  gap?: "sm" | "md" | "lg";
}) {
  const colStyles = {
    "1": "grid-cols-1",
    "2": "grid-cols-1 md:grid-cols-2",
    "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    flexible: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  const gapStyles = {
    sm: "gap-4",
    md: "gap-6 md:gap-8",
    lg: "gap-10 md:gap-16",
  };

  return (
    <div className={cn("grid", colStyles[cols], gapStyles[gap], className)}>
      {children}
    </div>
  );
}
