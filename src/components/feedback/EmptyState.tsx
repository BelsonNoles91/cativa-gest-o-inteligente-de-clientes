/**
 * EmptyState — estado vazio padrão (premium).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-4 py-10 text-center sm:px-6 sm:py-12",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-soft text-primary">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-semibold leading-snug sm:text-lg">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
