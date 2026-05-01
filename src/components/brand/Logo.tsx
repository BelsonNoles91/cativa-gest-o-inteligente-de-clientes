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
  const dot = size === "sm" ? "h-8 w-8 rounded-lg" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  const text = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-2xl";

  return (
    <div className={cn("flex items-center gap-3 shrink-0", className)}>
      <div
        className={cn(
          "relative grid place-items-center shadow-lg shadow-accent/20",
          "bg-accent text-white font-display font-black",
          dot,
        )}
        aria-hidden
      >
        <span className="leading-none select-none">C</span>
      </div>
      {showWordmark && (
        <span className={cn("font-display font-black tracking-tighter text-primary-dark uppercase whitespace-nowrap", text)}>
          Cativa<span className="text-accent">.</span>
        </span>
      )}
    </div>
  );
}
