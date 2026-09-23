/**
 * Cartão para ligar/desligar as notificações no aparelho atual.
 */
import { Bell, BellOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/features/notifications/usePushNotifications";

interface Props {
  tenantId?: string | null;
  description?: string;
}

export function PushNotificationsCard({ tenantId, description }: Props) {
  const { state, busy, enable, disable, sendTest } = usePushNotifications(tenantId);

  if (state === "checking" || state === "unsupported") return null;

  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    const result = await action();
    toast({
      title: result.ok ? "Pronto" : "Não deu certo",
      description: result.message,
      variant: result.ok ? undefined : "destructive",
    });
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {state === "on" ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          Avisos no celular
        </CardTitle>
        <CardDescription>
          {description ??
            "Receba um aviso no aparelho um dia antes do horário, mesmo com o app fechado."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {state === "open-in-new-tab" && (
          <p className="text-sm text-muted-foreground">
            Abra o Cativa em uma aba própria (ou pelo app instalado) para ativar os avisos.
          </p>
        )}
        {state === "denied" && (
          <p className="text-sm text-muted-foreground">
            Os avisos estão bloqueados para este site. Libere nas configurações do navegador e
            recarregue a página.
          </p>
        )}
        {state === "off" && (
          <Button className="min-h-[44px]" disabled={busy} onClick={() => run(enable)}>
            Ativar avisos neste aparelho
          </Button>
        )}
        {state === "on" && (
          <>
            <Button
              variant="outline"
              className="min-h-[44px]"
              disabled={busy}
              onClick={() => run(sendTest)}
            >
              Enviar teste
            </Button>
            <Button
              variant="ghost"
              className="min-h-[44px]"
              disabled={busy}
              onClick={() => run(disable)}
            >
              Desligar
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
