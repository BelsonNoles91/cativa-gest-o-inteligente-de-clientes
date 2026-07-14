import { AlertTriangle, RefreshCw } from "lucide-react";
import { useBackendHealth } from "@/hooks/use-backend-health";

/**
 * Banner fixo no topo mostrado quando o backend (Supabase) está inacessível
 * — ex: sem internet, credenciais ausentes no build, endpoint fora do ar.
 * Some sozinho assim que a próxima recheca voltar saudável.
 */
export function BackendHealthBanner() {
  const { status, recheck, error } = useBackendHealth();

  if (status !== "degraded") return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="sticky top-0 z-[60] w-full border-b border-warning/40 bg-warning/15 text-warning-foreground backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <div className="flex-1">
          <strong className="font-semibold">Serviço degradado.</strong>{" "}
          <span className="opacity-90">
            Não conseguimos conectar ao servidor. Algumas ações podem falhar.
          </span>
          {error ? (
            <span className="ml-1 hidden opacity-70 md:inline">({error})</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={recheck}
          className="inline-flex items-center gap-1 rounded-md border border-warning/50 bg-background/40 px-2 py-1 text-xs font-medium hover:bg-background/70"
        >
          <RefreshCw className="h-3 w-3" aria-hidden />
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
