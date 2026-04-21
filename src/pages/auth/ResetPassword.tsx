/**
 * Página de redefinição de senha (link que vem do e-mail).
 * Rota pública: /auth/reset-password
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2 } from "lucide-react";
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
      toast.error("Não foi possível atualizar", { description: error.message });
      return;
    }
    toast.success("Senha atualizada!");
    navigate("/app", { replace: true });
  };

  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Definir nova senha</h1>
        <p className="text-sm text-muted-foreground">Escolha uma senha forte para sua conta.</p>
      </div>

      {!ready ? (
        <div className="mt-8 rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground">
          Validando o link de recuperação…
        </div>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="pwd">Nova senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd2">Confirmar senha</Label>
            <Input id="pwd2" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-brand text-primary-foreground hover:opacity-95">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar senha"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
