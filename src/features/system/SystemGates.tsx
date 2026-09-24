import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Wrench, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemFlags } from "./useSystemFlags";

function Notice({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-md space-y-4 rounded-2xl border bg-card p-6 text-center shadow-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning/15 text-warning">{icon}</div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{text}</p>
        {action}
      </div>
    </div>
  );
}

/** Mostra aviso de manutenção quando o "Modo manutenção" está ligado. Super admin continua entrando. */
export function MaintenanceGate({ children, bypass = false }: { children: ReactNode; bypass?: boolean }) {
  const { flags } = useSystemFlags();
  if (flags.maintenance_mode && !bypass) {
    return (
      <Notice
        icon={<Wrench className="h-6 w-6" />}
        title="Estamos em manutenção"
        text="O sistema está passando por uma melhoria rápida. Volte em alguns minutos."
      />
    );
  }
  return <>{children}</>;
}

/** Bloqueia o cadastro de novos estabelecimentos quando "Permitir novos cadastros" está desligado. */
export function SignupsGate({ children }: { children: ReactNode }) {
  const { flags, loading } = useSystemFlags();
  if (loading) return null;
  if (!flags.enable_signups) {
    return (
      <Notice
        icon={<UserX className="h-6 w-6" />}
        title="Novos cadastros pausados"
        text="No momento não estamos aceitando novos estabelecimentos. Se você já tem conta, é só entrar."
        action={<Button asChild><Link to="/auth/login">Entrar</Link></Button>}
      />
    );
  }
  return <>{children}</>;
}
