import { CloudOff, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatSyncedAt(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface OfflineAgendaBannerProps {
  online: boolean;
  usingCache: boolean;
  syncedAt: string | null;
  pendingCount: number;
  syncing: boolean;
  onSync: () => void;
}

export function OfflineAgendaBanner({
  online,
  usingCache,
  syncedAt,
  pendingCount,
  syncing,
  onSync,
}: OfflineAgendaBannerProps) {
  if (online && pendingCount === 0 && !usingCache) return null;

  const offlineTone = !online || usingCache;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        offlineTone
          ? "border-warning/40 bg-warning/10"
          : "border-primary/30 bg-primary/5"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-foreground/70">
          {offlineTone ? <WifiOff className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {offlineTone ? "Modo offline" : "Ações aguardando envio"}
          </p>
          <p className="text-sm text-muted-foreground">
            {offlineTone
              ? syncedAt
                ? `Mostrando a agenda sincronizada em ${formatSyncedAt(syncedAt)}. Novos agendamentos ficam indisponíveis até a conexão voltar.`
                : "Sem conexão e sem agenda salva neste aparelho para o período selecionado."
              : "Registramos suas alterações e estamos enviando ao servidor."}
          </p>
          {pendingCount > 0 ? (
            <p className="text-sm font-medium text-foreground">
              {pendingCount === 1
                ? "1 ação pendente será enviada quando a conexão voltar."
                : `${pendingCount} ações pendentes serão enviadas quando a conexão voltar.`}
            </p>
          ) : null}
        </div>
      </div>

      {pendingCount > 0 ? (
        <Button
          variant="outline"
          className="min-h-[48px] rounded-2xl sm:min-w-[180px]"
          onClick={onSync}
          disabled={syncing || !online}
        >
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sincronizando…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar agora
            </>
          )}
        </Button>
      ) : null}
    </div>
  );
}
