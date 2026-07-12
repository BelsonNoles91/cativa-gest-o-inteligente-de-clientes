import { useState } from "react";
import { User, Lock, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Profile() {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || email === user?.email) return;
    
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setSavingEmail(false);

    if (error) {
      toast.error("Erro ao atualizar e-mail", { description: error.message });
      return;
    }
    toast.success("E-mail atualizado!", { description: "Verifique sua caixa de entrada para confirmar a alteração." });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }

    setSavingPassword(true);
    const { error } = await (supabase.rpc as any)('user_change_password_with_history', {
      new_raw_password: password
    });
    setSavingPassword(false);

    if (error) {
      if (error.message.includes("REUSED_PASSWORD")) {
        toast.error("Senha já utilizada recentemente", { description: "Por segurança, escolha uma senha diferente das últimas 5 utilizadas." });
      } else {
        toast.error("Erro ao atualizar senha", { description: error.message });
      }
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    setPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meu Perfil"
        description="Gerencie suas informações de acesso."
        icon={<User className="h-5 w-5" />}
      />

      {user?.app_metadata?.force_password_reset && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <p className="text-sm font-semibold">Alteração de senha obrigatória</p>
          <p className="text-sm mt-1">Sua senha foi redefinida por um administrador. Por razões de segurança, é obrigatório criar uma nova senha (diferente das suas últimas 5 senhas) antes de continuar usando o sistema.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="surface-card p-5">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-muted-foreground" /> E-mail de Acesso
          </h3>
          <p className="mt-1 text-sm text-muted-foreground mb-5">
            Atualize o e-mail que você usa para acessar o sistema.
          </p>

          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail Atual</Label>
              <Input value={user?.email || ""} disabled className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Novo E-mail</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="novo.email@exemplo.com"
              />
            </div>
            <Button
              type="submit"
              disabled={savingEmail || email === user?.email || !email}
              className="bg-gradient-brand"
            >
              {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Atualizar E-mail
            </Button>
          </form>
        </section>

        <section className="surface-card p-5">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" /> Alterar Senha
          </h3>
          <p className="mt-1 text-sm text-muted-foreground mb-5">
            Crie uma nova senha para sua conta.
          </p>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button
              type="submit"
              disabled={savingPassword || !password || password !== confirmPassword}
              className="bg-gradient-brand"
            >
              {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Atualizar Senha
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
