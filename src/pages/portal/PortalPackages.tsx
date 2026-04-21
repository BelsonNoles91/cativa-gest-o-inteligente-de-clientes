/**
 * PortalPackages — pacotes/protocolos e memberships do cliente.
 */
import { useEffect, useState } from "react";
import { Crown, PackageOpen, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import { listMyMemberships, listMyPackages } from "@/repositories/portal";
import type { PortalMembershipView, PortalPackageView } from "@/domain/portal";

export default function PortalPackages() {
  const { activeLink } = usePortalClient();
  const [packages, setPackages] = useState<PortalPackageView[]>([]);
  const [memberships, setMemberships] = useState<PortalMembershipView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLink) return;
    void (async () => {
      setLoading(true);
      try {
        const [p, m] = await Promise.all([
          listMyPackages(activeLink.tenantId, activeLink.clientId),
          listMyMemberships(activeLink.tenantId, activeLink.clientId),
        ]);
        setPackages(p);
        setMemberships(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLink]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (packages.length === 0 && memberships.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="font-display text-2xl font-semibold">Pacotes & Planos</h1>
          <p className="text-sm text-muted-foreground">
            Suas sessões e protocolos contratados
          </p>
        </header>
        <EmptyState
          icon={<PackageOpen className="h-6 w-6" />}
          title="Você ainda não possui pacotes"
          description="Pacotes, protocolos e planos contratados aparecerão aqui."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Pacotes & Planos</h1>
        <p className="text-sm text-muted-foreground">
          Suas sessões e protocolos contratados
        </p>
      </header>

      {memberships.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Planos ativos
          </h2>
          {memberships.map((m) => (
            <Card key={m.id} className="space-y-3 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
                  <Crown className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.membershipName}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.status === "active" ? "Ativo" : m.status} •{" "}
                    {m.currentCycleEnd
                      ? `renova em ${new Date(m.currentCycleEnd).toLocaleDateString("pt-BR")}`
                      : "ciclo aberto"}
                  </p>
                </div>
              </div>
              {m.benefits.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {m.benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-accent" />
                      {b.serviceName ?? "Serviço"} —{" "}
                      {b.sessionsPerCycle > 0
                        ? `${b.sessionsPerCycle} sessões/ciclo`
                        : ""}
                      {b.discountPct > 0 ? ` • ${b.discountPct}% off` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </section>
      )}

      {packages.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Pacotes
          </h2>
          {packages.map((p) => {
            const remaining = Math.max(0, p.sessionsTotal - p.sessionsUsed);
            const pct =
              p.sessionsTotal > 0
                ? Math.round((p.sessionsUsed / p.sessionsTotal) * 100)
                : 0;
            return (
              <Card key={p.id} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
                    <PackageOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.packageName}</p>
                    {p.serviceName && (
                      <p className="text-xs text-muted-foreground">{p.serviceName}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold leading-none">
                      {remaining}
                      <span className="text-xs font-normal text-muted-foreground">
                        /{p.sessionsTotal}
                      </span>
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                      restantes
                    </p>
                  </div>
                </div>
                <Progress value={pct} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    Comprado em{" "}
                    {new Date(p.purchasedAt).toLocaleDateString("pt-BR")}
                  </span>
                  {p.expiresAt && (
                    <span>
                      Expira em{" "}
                      {new Date(p.expiresAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
