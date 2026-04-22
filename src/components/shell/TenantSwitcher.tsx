/**
 * TenantSwitcher — troca de estabelecimento e unidade.
 *
 * Super admin: lista todos os tenants do sistema (não apenas os próprios) e
 * marca aqueles que exigem impersonação. Ao escolher, registra audit log.
 */
import { Building2, Check, ChevronsUpDown, ShieldCheck, X } from "lucide-react";
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
  const {
    currentTenant,
    currentUnit,
    availableTenants,
    availableUnits,
    setCurrentTenantId,
    setCurrentUnitId,
    isSuperAdmin,
    isImpersonating,
    impersonateTenant,
    endImpersonation,
  } = useTenant();

  if (!currentTenant) return null;

  function handleSelect(id: string) {
    if (isSuperAdmin) {
      void impersonateTenant(id, "switcher");
    } else {
      setCurrentTenantId(id);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-11 justify-between gap-2 rounded-xl border-border/70 bg-card/60 px-3 text-left shadow-xs hover:bg-card",
            compact ? "w-full" : "min-w-[220px]",
            isImpersonating && "border-warning/60 bg-warning/10",
          )}
        >
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-primary",
              isImpersonating ? "bg-warning/20 text-warning" : "bg-gradient-soft",
            )}
          >
            {isImpersonating ? <ShieldCheck className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium leading-tight">{currentTenant.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {isImpersonating
                ? "Impersonando · super admin"
                : currentUnit?.name ?? segmentLabels[currentTenant.segment]}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[60vh] w-[280px] overflow-y-auto">
        <DropdownMenuLabel>
          {isSuperAdmin ? "Todos os estabelecimentos" : "Estabelecimentos"}
        </DropdownMenuLabel>
        {availableTenants.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => handleSelect(t.id)} className="gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm">{t.name}</span>
              <span className="truncate text-[10px] text-muted-foreground">
                {segmentLabels[t.segment]} · {t.slug}
              </span>
            </span>
            {t.id === currentTenant.id && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        {isImpersonating && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void endImpersonation()} className="gap-2 text-warning">
              <X className="h-4 w-4" />
              <span>Encerrar impersonação</span>
            </DropdownMenuItem>
          </>
        )}
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
