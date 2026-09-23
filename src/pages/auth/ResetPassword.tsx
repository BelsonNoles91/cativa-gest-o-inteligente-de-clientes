/**
 * Página de redefinição de senha (link que vem do e-mail).
 * Rota pública: /auth/reset-password
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase já processa o token via hash; checa se temos sessão de recovery
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível atualizar", { description: translateAuthError(error.message) });
      return;
    }
    toast.success("Senha atualizada!");
    navigate("/app", { replace: true });
  };

  return (
    <AuthLayout>
      <div className="space-y-10">
        <header className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent border border-accent/20">
            Nova Senha
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-primary-dark">
            Definir nova senha
          </h1>
          <p className="text-lg font-light leading-relaxed text-muted-foreground">
            Escolha uma senha forte para proteger seu acesso ao sistema.
          </p>
        </header>

        {!ready ? (
          <div className="rounded-2xl border border-border/40 bg-[#FAF7F9] p-8 text-center animate-pulse">
            <p className="text-sm text-muted-foreground font-medium">Validando o link de segurança…</p>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Sua nova senha</Label>
                <div className="relative group">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent" />
                  <Input id="pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5" placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd2" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Confirmar nova senha</Label>
                <div className="relative group">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent" />
                  <Input id="pwd2" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5" placeholder="Repita a senha" />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="group h-16 w-full rounded-full bg-primary-dark text-lg font-bold text-white shadow-xl transition-all hover:bg-accent active:scale-[0.98]">
              {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <span className="flex items-center gap-2">Atualizar e Entrar no Cativa <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></span>
              )}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
