import { SignupLink, useSignupsOpen } from "@/features/system/SignupLink";
import { translateAuthError } from "@/lib/auth-errors";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { SocialAuthButtons } from "@/features/auth/SocialAuthButtons";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const signupsOpen = useSignupsOpen();
  const [showEmail, setShowEmail] = useState(false);
  const emailVisible = signupsOpen || showEmail;

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
      toast.error("Não foi possível entrar", { description: translateAuthError(error.message) });
      return;
    }
    toast.success("Bem-vindo de volta!");
    const target =
      (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/app";
    navigate(target, { replace: true });
  };

  return (
    <AuthLayout>
      <div className="space-y-10">
        {/* Cabeçalho */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-strong border border-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            Área do Cliente
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-primary-dark">
            Bem-vindo de volta
          </h1>
          <p className="text-lg font-light leading-relaxed text-muted-foreground">
            Acesse seu painel para gerenciar sua operação e fidelizar seus clientes.
          </p>
        </header>

        {/* Acesso social */}
        <div className="space-y-5">
          <SocialAuthButtons redirectPath="/app" />
          {emailVisible ? (
          <div className="relative" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                ou use e-mail e senha
              </span>
            </div>
          </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Entre com sua conta Google ou Apple.{" "}
              <button type="button" onClick={() => setShowEmail(true)} className="font-semibold text-accent-strong underline-offset-4 hover:underline">
                Sou da equipe e entro com e-mail
              </button>
            </p>
          )}
        </div>

        {/* Formulário */}
        {emailVisible && (
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/80 ml-1"
              >
                E-mail Profissional
              </Label>
              <div className="group relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent"
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
                  placeholder="exemplo@estudio.com"
                  className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                <Label
                  htmlFor="password"
                  className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/80"
                >
                  Senha de Acesso
                </Label>
                <Link
                  to="/auth/recuperar"
                  className="text-[10px] font-bold uppercase tracking-widest text-accent-strong hover:text-primary-dark transition-colors"
                >
                  Esqueci a senha
                </Link>
              </div>
              <div className="group relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent"
                />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 pr-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-white hover:text-accent focus-visible:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="group h-16 w-full rounded-full bg-primary-dark text-lg font-bold text-white shadow-xl transition-all hover:bg-accent disabled:opacity-70 active:scale-[0.98]"
          >
            {submitting ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-2">
                Entrar no Sistema
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </Button>
        </form>
        )}

        {/* Rodapé do Form */}
        <div className="space-y-6 pt-4">
          {signupsOpen && (<>
          <div className="relative" aria-hidden="true">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/40" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Ainda não tem conta?
              </span>
            </div>
          </div>

          <SignupLink
            className="flex h-16 w-full items-center justify-center gap-3 rounded-full border-2 border-primary-dark/10 bg-white text-lg font-bold text-primary-dark transition-all hover:border-accent hover:text-accent group"
          >
            Criar conta grátis
            <Sparkles className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all -translate-y-1 group-hover:translate-y-0" />
          </SignupLink>
          </>)}

          <p className="text-center text-[10px] leading-relaxed text-muted-foreground font-medium px-8">
            Ao continuar você concorda com os{" "}
            <Link to="/termos" className="text-primary-dark hover:underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link to="/privacidade" className="text-primary-dark hover:underline">
              Política de Privacidade
            </Link>
            .
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
