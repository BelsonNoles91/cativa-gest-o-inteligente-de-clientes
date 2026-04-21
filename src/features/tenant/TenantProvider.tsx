/**
 * TenantContext — base para multi-tenant.
 * Por enquanto fornece um tenant mock para desenvolvimento da UI.
 * Quando Lovable Cloud + Auth estiverem ativos, substituir o mock
 * por dados reais do usuário autenticado.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Tenant, Unit } from "@/domain/tenant";
import type { Role } from "@/domain/roles";

interface TenantContextValue {
  currentTenant: Tenant | null;
  currentUnit: Unit | null;
  availableTenants: Tenant[];
  availableUnits: Unit[];
  currentRole: Role;
  setCurrentTenantId: (id: string) => void;
  setCurrentUnitId: (id: string) => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

const MOCK_TENANTS: Tenant[] = [
  { id: "t-1", name: "Studio Aurora", slug: "studio-aurora", segment: "salao", createdAt: new Date().toISOString() },
  { id: "t-2", name: "Clínica Lumière", slug: "clinica-lumiere", segment: "clinica_estetica", createdAt: new Date().toISOString() },
];

const MOCK_UNITS: Unit[] = [
  { id: "u-1", tenantId: "t-1", name: "Matriz", isDefault: true },
  { id: "u-2", tenantId: "t-1", name: "Filial Jardins" },
  { id: "u-3", tenantId: "t-2", name: "Unidade única", isDefault: true },
];

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenantId, setCurrentTenantId] = useState<string>("t-1");
  const [currentUnitId, setCurrentUnitId] = useState<string>("u-1");

  const value = useMemo<TenantContextValue>(() => {
    const currentTenant = MOCK_TENANTS.find((t) => t.id === currentTenantId) ?? null;
    const availableUnits = MOCK_UNITS.filter((u) => u.tenantId === currentTenantId);
    const currentUnit = availableUnits.find((u) => u.id === currentUnitId) ?? availableUnits[0] ?? null;

    return {
      currentTenant,
      currentUnit,
      availableTenants: MOCK_TENANTS,
      availableUnits,
      currentRole: "owner",
      setCurrentTenantId: (id) => {
        setCurrentTenantId(id);
        const firstUnit = MOCK_UNITS.find((u) => u.tenantId === id);
        if (firstUnit) setCurrentUnitId(firstUnit.id);
      },
      setCurrentUnitId,
    };
  }, [currentTenantId, currentUnitId]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de <TenantProvider />");
  return ctx;
}
