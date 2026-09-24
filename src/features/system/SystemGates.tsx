import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthProvider";
import { Wrench, Hourglass, LogOut } from "lucide-react";
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  if (loading) return null;
  if (!flags.enable_signups) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-soft p-6">
        <div className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-8 text-center shadow-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-strong">
            <Hourglass className="h-7 w-7" />
          </div>
          <h1 className="font-display text-2xl font-semibold">
            {user ? "Ainda não temos seu cadastro" : "Novos cadastros pausados"}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Estamos com as novas contas temporariamente fechadas, para dar atenção total a quem já usa o Cativa.
            Em breve abriremos de novo.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se você é cliente de um estabelecimento, use o link de agendamento que ele divulgou.
            Se já tem conta, entre com o mesmo Google ou Apple que usou antes.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            {user ? (
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  navigate("/auth/login", { replace: true });
                }}
              >
                <LogOut className="mr-1.5 h-4 w-4" /> Entrar com outra conta
              </Button>
            ) : (
              <Button asChild><Link to="/auth/login">Entrar</Link></Button>
            )}
            <Button asChild variant="ghost"><Link to="/">Voltar ao início</Link></Button>
          </div>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
