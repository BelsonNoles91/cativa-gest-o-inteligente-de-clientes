/**
 * Logo da Cativa — pequena marca tipográfica.
 */
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, showWordmark = true, size = "md" }: LogoProps) {
  const dot = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const text = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "relative grid place-items-center rounded-xl shadow-sm",
          "bg-gradient-brand text-primary-foreground font-display font-semibold",
          dot,
        )}
        aria-hidden
      >
        <span className="leading-none">C</span>
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
      </div>
      {showWordmark && (
        <span className={cn("font-display font-semibold tracking-tight text-foreground", text)}>
          Cativa
        </span>
      )}
    </div>
  );
}
