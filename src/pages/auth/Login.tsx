import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        toast.error("Confirme seu e-mail antes de entrar", {
          description: "Abra a mensagem enviada para sua caixa de entrada e clique no link de confirmação.",
        });
        return;
      }
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta!");
    const target =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/app";
    navigate(target, { replace: true });
  };

  return (
    <AuthLayout>
      <div className="space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Acesso à plataforma
          </span>
          <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-foreground">
            Bem-vindo de volta
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Entre com sua conta Cativa para gerenciar agenda, clientes e confirmações.
          </p>
        </header>

        {/* Card form */}
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {/* Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              E-mail
            </Label>
            <div className="group relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <Input
                id="email"
                type="email"
                inputMode="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@negocio.com"
                className="h-12 rounded-xl border-border/70 bg-card pl-10 text-[15px] shadow-xs transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Senha
            </Label>
            <div className="group relative">
              <Lock
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-xl border-border/70 bg-card pl-10 pr-11 text-[15px] shadow-xs transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting}
            className="group h-12 w-full rounded-xl bg-gradient-brand text-[15px] font-medium text-primary-foreground shadow-md transition-all hover:shadow-lg hover:brightness-105 disabled:opacity-70"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-2">
                Entrar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            )}
          </Button>

          {/* Forgot password — abaixo do CTA para não interferir no tab order */}
          <div className="text-center">
            <Link
              to="/auth/recuperar"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
        </form>

        {/* Sign up */}
        <div className="space-y-4">
          <div className="relative" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Novo por aqui
              </span>
            </div>
          </div>

          <Link
            to="/onboarding"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border/70 bg-card text-[15px] font-medium text-foreground shadow-xs transition-all hover:border-primary/40 hover:bg-secondary/40 hover:text-primary"
          >
            Criar conta gratuita
          </Link>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Ao continuar você concorda com os{" "}
            <Link to="/termos" className="underline-offset-2 hover:text-foreground hover:underline">
              Termos
            </Link>{" "}
            e a{" "}
            <Link to="/privacidade" className="underline-offset-2 hover:text-foreground hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
