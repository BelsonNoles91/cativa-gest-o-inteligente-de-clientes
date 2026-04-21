/**
 * TenantSwitcher — troca de estabelecimento e unidade.
 * Preparado para multi-tenant real. Hoje usa dados mockados do contexto.
 */
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/features/tenant/TenantProvider";
import { segmentLabels } from "@/domain/tenant";
import { cn } from "@/lib/utils";

export function TenantSwitcher({ compact = false }: { compact?: boolean }) {
  const { currentTenant, currentUnit, availableTenants, availableUnits, setCurrentTenantId, setCurrentUnitId } = useTenant();

  if (!currentTenant) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 justify-between gap-2 rounded-xl border-border/70 bg-card/60 px-3 text-left shadow-xs hover:bg-card",
            compact ? "w-full" : "min-w-[220px]",
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-soft text-primary">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium leading-tight">{currentTenant.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {currentUnit?.name ?? segmentLabels[currentTenant.segment]}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[260px]">
        <DropdownMenuLabel>Estabelecimentos</DropdownMenuLabel>
        {availableTenants.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => setCurrentTenantId(t.id)} className="gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{t.name}</span>
            {t.id === currentTenant.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {availableUnits.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Unidade</DropdownMenuLabel>
            {availableUnits.map((u) => (
              <DropdownMenuItem key={u.id} onSelect={() => setCurrentUnitId(u.id)} className="gap-2">
                <span className="flex-1 truncate">{u.name}</span>
                {u.id === currentUnit?.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
