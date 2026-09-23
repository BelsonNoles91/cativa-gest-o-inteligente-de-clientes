import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { useAuth } from "@/features/auth/AuthProvider";
import { SocialAuthButtons } from "@/features/auth/SocialAuthButtons";

export default function PortalAccess() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate("/portal", { replace: true });
    }
  }, [loading, navigate, user]);

  const target =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/portal";

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Portal do cliente</h1>
        <p className="text-sm text-muted-foreground">
          Entre com sua conta Google ou Apple para acompanhar horários, reagendar, assinar termos e
          ver seus pacotes.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <SocialAuthButtons redirectPath={target} />

        <div className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/40 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            O acesso do cliente é feito apenas por Google ou Apple — sem senhas para lembrar e com
            verificação de identidade do próprio provedor. Use o mesmo e-mail cadastrado no
            estabelecimento para que seu histórico apareça automaticamente.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
