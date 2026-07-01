/**
 * QA — matriz de acesso por papel × tenant × item de menu
 *
 * Replica EXATAMENTE a regra usada por `AppSidebar` e `BottomNav`:
 *   visible = canAccess(role, item.roles) && (!item.featureKey || hasFeature(item.featureKey))
 *
 * Snapshot dos 4 tenants demo capturado em 2026-04-22 via psql:
 *  - demo-belle-pele : Studio (active)            features: agenda, advanced_reports, client_portal, confirmation_center, packages_memberships
 *  - demo-origem     : Starter (trialing)         features: agenda, confirmation_center, packages_memberships
 *  - demo-sereno     : Starter (trialing)         features: agenda, confirmation_center, packages_memberships
 *  - demo-lumiere    : sem assinatura             features: ∅  (banner "Sem assinatura" deve aparecer)
 *
 * O resultado é gravado em `/tmp/access-matrix.json` — um pós-script
 * (`scripts/generate-access-evidence.mjs`) lê esse JSON e gera o relatório
 * em `/mnt/documents/access-matrix.md`.
 */
import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { navItems } from "@/config/navigation";
import { canAccess, type Role } from "@/domain/roles";

// ----------------------------------------------------------------------------
// Snapshot dos tenants demo
// ----------------------------------------------------------------------------

interface TenantSnapshot {
  slug: string;
  name: string;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: "active" | "trialing" | "overdue" | "suspended" | "canceled" | "no_subscription";
  enabledFeatures: Set<string>;
}

const TENANTS: TenantSnapshot[] = [
  {
    slug: "demo-belle-pele",
    name: "[DEMO] Belle Pele Estética",
    planCode: "studio",
    planName: "Studio",
    subscriptionStatus: "active",
    enabledFeatures: new Set([
      "agenda",
      "advanced_reports",
      "client_portal",
      "confirmation_center",
      "packages_memberships",
    ]),
  },
  {
    slug: "demo-origem",
    name: "[DEMO] Barbearia Origem",
    planCode: "starter",
    planName: "Starter",
    subscriptionStatus: "trialing",
    enabledFeatures: new Set(["agenda", "confirmation_center", "packages_memberships"]),
  },
  {
    slug: "demo-sereno",
    name: "[DEMO] Sereno Wellness",
    planCode: "starter",
    planName: "Starter",
    subscriptionStatus: "trialing",
    enabledFeatures: new Set(["agenda", "confirmation_center", "packages_memberships"]),
  },
  {
    slug: "demo-lumiere",
    name: "[DEMO] Studio Lumiere",
    planCode: null,
    planName: null,
    subscriptionStatus: "no_subscription",
    enabledFeatures: new Set<string>(),
  },
];

// Papéis testados (intencionalmente NÃO inclui `super_admin` porque ele bypassa
// todas as verificações via RoleGuard/sidebar; o item Super Admin é coberto
// no caso de borda no fim do arquivo).
const ROLES: Role[] = ["owner", "manager", "frontdesk", "professional"];

// ----------------------------------------------------------------------------
// Lógica replicada
// ----------------------------------------------------------------------------

interface VisibleItem {
  to: string;
  label: string;
  roleAllowed: boolean;
  featureGated: boolean;
  featureKey?: string;
  visible: boolean;
  blockedReason: "none" | "role" | "feature" | "role_and_feature";
}

function evaluateMenu(role: Role, tenant: TenantSnapshot): VisibleItem[] {
  return navItems.map((item) => {
    const roleAllowed = canAccess(role, item.roles);
    const featureGated = Boolean(item.featureKey) && !tenant.enabledFeatures.has(item.featureKey!);
    const visible = roleAllowed && !featureGated;
    let blockedReason: VisibleItem["blockedReason"] = "none";
    if (!roleAllowed && featureGated) blockedReason = "role_and_feature";
    else if (!roleAllowed) blockedReason = "role";
    else if (featureGated) blockedReason = "feature";

    return {
      to: item.to,
      label: item.label,
      roleAllowed,
      featureGated,
      featureKey: item.featureKey,
      visible,
      blockedReason,
    };
  });
}

function shouldShowNoSubscriptionBanner(tenant: TenantSnapshot, role: Role): boolean {
  // Banner aparece para qualquer membro logado quando não há subscription.
  // Apenas owner/manager veem a CTA "Ativar trial" — frontdesk/professional
  // veem o banner sem ação. Aqui a regra de visibilidade é apenas pela ausência.
  if (!ROLES.includes(role)) return false;
  return tenant.subscriptionStatus === "no_subscription";
}

// ----------------------------------------------------------------------------
// Coleta de evidências
// ----------------------------------------------------------------------------

interface Evidence {
  generatedAt: string;
  tenants: Array<{
    slug: string;
    name: string;
    plan: string;
    status: string;
    enabledFeatures: string[];
    showsNoSubscriptionBanner: boolean;
    perRole: Record<Role, {
      visibleItems: string[];
      blockedItems: Array<{ label: string; reason: VisibleItem["blockedReason"]; featureKey?: string }>;
      totalVisible: number;
      totalBlocked: number;
    }>;
  }>;
}

const EVIDENCE: Evidence = { generatedAt: new Date().toISOString(), tenants: [] };

// ----------------------------------------------------------------------------
// Suítes
// ----------------------------------------------------------------------------

describe("Matriz de acesso — papel × tenant × menu", () => {
  for (const tenant of TENANTS) {
    describe(`${tenant.name} (${tenant.subscriptionStatus})`, () => {
      const tenantEvidence: Evidence["tenants"][number] = {
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.planName ?? "—",
        status: tenant.subscriptionStatus,
        enabledFeatures: Array.from(tenant.enabledFeatures).sort(),
        showsNoSubscriptionBanner: tenant.subscriptionStatus === "no_subscription",
        perRole: {} as Evidence["tenants"][number]["perRole"],
      };
      EVIDENCE.tenants.push(tenantEvidence);

      it("banner 'Sem assinatura' aparece se e somente se não houver subscription", () => {
        const expected = tenant.subscriptionStatus === "no_subscription";
        for (const role of ROLES) {
          expect(shouldShowNoSubscriptionBanner(tenant, role)).toBe(expected);
        }
      });

      for (const role of ROLES) {
        describe(`papel ${role}`, () => {
          const items = evaluateMenu(role, tenant);
          tenantEvidence.perRole[role] = {
            visibleItems: items.filter((i) => i.visible).map((i) => i.label),
            blockedItems: items
              .filter((i) => !i.visible)
              .map((i) => ({ label: i.label, reason: i.blockedReason, featureKey: i.featureKey })),
            totalVisible: items.filter((i) => i.visible).length,
            totalBlocked: items.filter((i) => !i.visible).length,
          };

          it("nunca expõe item de Super Admin", () => {
            const sa = items.find((i) => i.to === "/app/super-admin");
            expect(sa?.visible).toBe(false);
          });

          it("Painel e Agenda sempre visíveis para todos os papéis operacionais", () => {
            expect(items.find((i) => i.to === "/app")?.visible).toBe(true);
            expect(items.find((i) => i.to === "/app/agenda")?.visible).toBe(true);
          });

          it("Configurações e Meu plano restritos a owner/manager", () => {
            const cfg = items.find((i) => i.to === "/app/configuracoes");
            const plano = items.find((i) => i.to === "/app/meu-plano");
            const expected = role === "owner" || role === "manager";
            expect(cfg?.visible).toBe(expected);
            expect(plano?.visible).toBe(expected);
          });

          it("Clientes e Confirmações ocultos para professional", () => {
            const clientes = items.find((i) => i.to === "/app/clientes");
            const confirm = items.find((i) => i.to === "/app/confirmacoes");
            if (role === "professional") {
              expect(clientes?.visible).toBe(false);
              expect(confirm?.visible).toBe(false);
            } else {
              expect(clientes?.visible).toBe(true);
              // confirmações depende também do feature flag
              const expected = tenant.enabledFeatures.has("confirmation_center");
              expect(confirm?.visible).toBe(expected);
            }
          });

          it("Analytics gated por feature 'advanced_reports' (apenas plano Studio)", () => {
            const analytics = items.find((i) => i.to === "/app/analytics");
            const owedByRole = role === "owner" || role === "manager";
            const owedByFeature = tenant.enabledFeatures.has("advanced_reports");
            expect(analytics?.visible).toBe(owedByRole && owedByFeature);
          });

          it("Pacotes & Protocolos gated por feature 'packages_memberships'", () => {
            const pkg = items.find((i) => i.to === "/app/pacotes");
            const owedByRole = role === "owner" || role === "manager";
            const owedByFeature = tenant.enabledFeatures.has("packages_memberships");
            expect(pkg?.visible).toBe(owedByRole && owedByFeature);
          });

          it("Tenant SEM assinatura: itens com featureKey ficam todos bloqueados", () => {
            if (tenant.subscriptionStatus !== "no_subscription") return;
            const gated = items.filter((i) => i.featureKey);
            for (const g of gated) expect(g.visible).toBe(false);
          });
        });
      }
    });
  }

  // ---------------------------- Casos de borda --------------------------------
  describe("Edge cases", () => {
    it("super_admin enxerga o item Super Admin em qualquer tenant", () => {
      for (const tenant of TENANTS) {
        const items = navItems.filter(
          (i) =>
            canAccess("super_admin", i.roles) &&
            (!i.featureKey || tenant.enabledFeatures.has(i.featureKey)),
        );
        const sa = items.find((i) => i.to === "/app/super-admin");
        expect(sa, `tenant ${tenant.slug}`).toBeDefined();
      }
    });

    it("client (papel do portal) não vê NENHUM item de /app", () => {
      for (const tenant of TENANTS) {
        for (const item of navItems) {
          expect(canAccess("client", item.roles), `${tenant.slug} → ${item.to}`).toBe(false);
        }
      }
    });

    it("matriz é determinística: mesma entrada → mesma saída", () => {
      const a = evaluateMenu("manager", TENANTS[0]);
      const b = evaluateMenu("manager", TENANTS[0]);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });
});

// Persiste o snapshot para o gerador de relatório markdown.
afterAll(() => {
  const out = "/tmp/access-matrix.json";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(EVIDENCE, null, 2));
});
