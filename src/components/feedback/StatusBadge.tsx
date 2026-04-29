/**
 * StatusBadge — badges de status padronizadas.
 * Use sempre estas variantes para consistência visual.
 */
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const styles: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent-soft text-accent-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/15 text-destructive",
  brand: "bg-primary-soft text-primary",
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  children: React.ReactNode;
  dot?: boolean;
}

import { forwardRef } from "react";

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ tone = "neutral", children, className, dot = true, ...props }, ref) => {
    return (
      <span
        {...props}
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          styles[tone],
          className,
        )}
      >
        {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
        {children}
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";
