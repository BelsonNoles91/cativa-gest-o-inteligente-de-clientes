/**
 * PortalPerksCard — cupons de reativação e pontos de fidelidade do cliente.
 */
import { useEffect, useState } from "react";
import { Gift, Ticket } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import { couponDescription, listMyCoupons, type ReactivationCoupon } from "@/repositories/coupons";
import {
  fetchLoyaltySettings,
  listLoyaltyEntries,
  loyaltyBalance,
  type LoyaltySettings,
} from "@/repositories/loyalty";

export function PortalPerksCard() {
  const { activeLink } = usePortalClient();
  const [coupons, setCoupons] = useState<ReactivationCoupon[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySettings | null>(null);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (!activeLink) return;
    let alive = true;
    void (async () => {
      try {
        const [c, s, entries] = await Promise.all([
          listMyCoupons(activeLink.tenantId, activeLink.clientId),
          fetchLoyaltySettings(activeLink.tenantId),
          listLoyaltyEntries(activeLink.tenantId, activeLink.clientId),
        ]);
        if (!alive) return;
        setCoupons(c);
        setLoyalty(s);
        setPoints(loyaltyBalance(entries));
      } catch {
        /* silencioso: é um bloco extra */
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeLink]);

  const showLoyalty = loyalty?.enabled ?? false;
  if (coupons.length === 0 && !showLoyalty) return null;

  const threshold = loyalty?.rewardThresholdPoints ?? 100;
  const pct = Math.min(100, Math.round((points / Math.max(1, threshold)) * 100));

  return (
    <div className="space-y-3">
      {coupons.map((c) => (
        <Card key={c.id} className="rounded-2xl border-primary/30 p-4">
          <div className="flex items-start gap-3">
            <Ticket className="mt-0.5 h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="font-medium">{couponDescription(c)}</p>
              <p className="text-sm text-muted-foreground">
                Use o código <strong>{c.code}</strong> ao marcar seu horário
                {c.expiresAt
                  ? ` · vale até ${new Date(c.expiresAt).toLocaleDateString("pt-BR")}`
                  : ""}
              </p>
            </div>
          </div>
        </Card>
      ))}

      {showLoyalty && (
        <Card className="rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-5 w-5 text-primary" />
            <div className="w-full min-w-0">
              <p className="font-medium">
                {points} de {threshold} pontos
              </p>
              <Progress value={pct} className="mt-2" />
              {loyalty?.rewardDescription && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Ao chegar lá: {loyalty.rewardDescription}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
