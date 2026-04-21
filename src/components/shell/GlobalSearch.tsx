/**
 * GlobalSearch — busca global do produto (placeholder funcional).
 * No futuro disparar comando ⌘K e buscar em clientes/agenda/serviços.
 */
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function GlobalSearch({ className }: { className?: string }) {
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Buscar clientes, agendamentos, serviços…"
        aria-label="Busca global"
        className="h-11 rounded-xl border-border/70 bg-card/60 pl-9 shadow-xs focus-visible:bg-card"
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
        ⌘K
      </kbd>
    </div>
  );
}
