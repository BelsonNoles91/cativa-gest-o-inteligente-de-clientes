/**
 * QuickFiltersBar — atalhos rápidos para o CRM de clientes.
 *
 * Presets de um clique cobrindo as buscas mais comuns no dia a dia
 * da recepção e gestão (aniversariantes do mês, VIP, inativos, risco
 * elevado, reativação e "meus clientes" para o profissional logado).
 *
 * Multi-tenant + RLS:
 *   - Os atalhos apenas alteram o estado de filtros locais.
 *   - As queries de fato (em `repositories/clients`) sempre usam
 *     `.eq("tenant_id", currentTenant.id)` — RLS impede vazamento entre
 *     tenants no banco. Aqui só montamos a UX.
 */
import { Cake, Crown, Moon, ShieldAlert, Sparkles, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

type FiltersShape = {
  vipOnly: boolean;
  inactiveOnly: boolean;
  highRiskOnly: boolean;
  needsReactivationOnly: boolean;
  birthdayMonth: string;
  preferredProfessionalId: string;
  churnRiskScore: string;
};

interface QuickFiltersBarProps<F extends FiltersShape> {
  filters: F;
  setFilters: React.Dispatch<React.SetStateAction<F>>;
  /** Profissional vinculado ao usuário logado (se aplicável). */
  ownProfessionalId: string | null;
  ownProfessionalName: string | null;
  /** Reseta para o estado padrão (todos os atalhos desligados). */
  onClear: () => void;
}

export function QuickFiltersBar<F extends FiltersShape>({
  filters,
  setFilters,
  ownProfessionalId,
  ownProfessionalName,
  onClear,
}: QuickFiltersBarProps<F>) {
  const currentMonth = String(new Date().getMonth() + 1);
  const birthdayThisMonthActive = filters.birthdayMonth === currentMonth;
  const myClientsActive =
    !!ownProfessionalId && filters.preferredProfessionalId === ownProfessionalId;

  const anyActive =
    filters.vipOnly ||
    filters.inactiveOnly ||
    filters.highRiskOnly ||
    filters.needsReactivationOnly ||
    filters.birthdayMonth !== "all" ||
    filters.preferredProfessionalId !== "all" ||
    filters.churnRiskScore !== "all";

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card/50 p-3 shadow-sm"
      data-testid="clients-quick-filters"
      role="group"
      aria-label="Atalhos rápidos de filtros de clientes"
    >
      <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Atalhos
      </span>

      <QuickChip
        active={birthdayThisMonthActive}
        icon={<Cake className="h-3.5 w-3.5" />}
        label="Aniversariantes do mês"
        testId="quick-filter-birthday-month"
        onClick={() =>
          setFilters((prev) => ({
            ...prev,
            birthdayMonth: birthdayThisMonthActive ? "all" : currentMonth,
          }))
        }
      />

      <QuickChip
        active={filters.vipOnly}
        icon={<Crown className="h-3.5 w-3.5" />}
        label="VIP"
        testId="quick-filter-vip"
        onClick={() => setFilters((prev) => ({ ...prev, vipOnly: !prev.vipOnly }))}
      />

      <QuickChip
        active={filters.inactiveOnly}
        icon={<Moon className="h-3.5 w-3.5" />}
        label="Inativos"
        testId="quick-filter-inactive"
        onClick={() => setFilters((prev) => ({ ...prev, inactiveOnly: !prev.inactiveOnly }))}
      />

      <QuickChip
        active={filters.highRiskOnly}
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        label="Risco alto"
        testId="quick-filter-high-risk"
        onClick={() => setFilters((prev) => ({ ...prev, highRiskOnly: !prev.highRiskOnly }))}
      />

      <QuickChip
        active={filters.needsReactivationOnly}
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Para reativar"
        testId="quick-filter-reactivation"
        onClick={() =>
          setFilters((prev) => ({
            ...prev,
            needsReactivationOnly: !prev.needsReactivationOnly,
          }))
        }
      />

      {ownProfessionalId ? (
        <QuickChip
          active={myClientsActive}
          icon={<UserRound className="h-3.5 w-3.5" />}
          label={ownProfessionalName ? `Meus clientes (${ownProfessionalName})` : "Meus clientes"}
          testId="quick-filter-my-clients"
          onClick={() =>
            setFilters((prev) => ({
              ...prev,
              preferredProfessionalId: myClientsActive ? "all" : ownProfessionalId,
            }))
          }
        />
      ) : null}
      
      <QuickChip
        active={filters.churnRiskScore === "high"}
        icon={<ShieldAlert className="h-3.5 w-3.5 text-red-500" />}
        label="Risco de Churn"
        testId="quick-filter-churn-risk"
        onClick={() =>
          setFilters((prev) => ({
            ...prev,
            churnRiskScore: prev.churnRiskScore === "high" ? "all" : "high",
          }))
        }
      />

      {anyActive ? (
        <button
          type="button"
          onClick={onClear}
          data-testid="quick-filter-clear"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Limpar atalhos
        </button>
      ) : null}
    </div>
  );
}

interface QuickChipProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  testId: string;
  onClick: () => void;
}

function QuickChip({ active, icon, label, testId, onClick }: QuickChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      data-state={active ? "active" : "inactive"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
