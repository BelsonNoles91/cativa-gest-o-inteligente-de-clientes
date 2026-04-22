/**
 * OfflineBanner — faixa discreta no topo do app que aparece apenas
 * quando o navegador detecta perda de conexão. Mostra também um
 * "voltou ao normal" por alguns segundos quando a rede retorna,
 * para feedback positivo ao usuário.
 */
import { useEffect, useState } from "react";
import { CloudOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const [showRecovered, setShowRecovered] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowRecovered(false);
      return;
    }
    if (wasOffline) {
      setShowRecovered(true);
      const t = setTimeout(() => setShowRecovered(false), 3500);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);

  if (online && !showRecovered) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 z-50 flex justify-center px-3 pointer-events-none",
        "top-[calc(env(safe-area-inset-top)+8px)]",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur transition-all",
          online
            ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-200",
        )}
      >
        {online ? (
          <>
            <Wifi className="h-3.5 w-3.5" aria-hidden />
            Conexão restaurada
          </>
        ) : (
          <>
            <CloudOff className="h-3.5 w-3.5" aria-hidden />
            Você está offline — alterações não serão salvas
          </>
        )}
      </div>
    </div>
  );
}
