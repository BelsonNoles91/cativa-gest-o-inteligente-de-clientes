/**
 * SignOutAndRestart — botão para encerrar a sessão atual e voltar ao fluxo de
 * criação de conta. Útil em onboarding/login quando o usuário ficou preso em
 * uma sessão antiga (ex.: testando múltiplos cadastros no preview).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { cn } from "@/lib/utils";

interface SignOutAndRestartProps {
  /** Para onde redirecionar após o logout. Default: /onboarding */
  redirectTo?: string;
  /** Texto do botão. Default: "Sair e criar outra conta" */
  label?: string;
  className?: string;
}

export function SignOutAndRestart({
  redirectTo = "/onboarding",
  label = "Sair e criar outra conta",
  className,
}: SignOutAndRestartProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const handleClick = async () => {
    setBusy(true);
    try {
      await signOut();
      // Limpa preferências locais de tenant/unidade para não vazar contexto.
      try {
        localStorage.removeItem("cativa.currentTenantId");
        localStorage.removeItem("cativa.currentUnitId");
      } catch {
        /* ignore */
      }
      toast.success("Sessão encerrada. Você pode criar uma nova conta agora.");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      toast.error("Não foi possível sair", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={busy}
      className={cn("h-9 gap-2 text-xs text-muted-foreground hover:text-foreground", className)}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
