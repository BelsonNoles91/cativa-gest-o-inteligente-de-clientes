import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate("/app", { replace: true });
  };

  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground">Acesse sua conta Cativa para continuar.</p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@negocio.com"
              className="h-11 rounded-xl pl-9"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link to="/auth/recuperar" className="text-xs font-medium text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 rounded-xl pl-9"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-xl bg-gradient-brand text-primary-foreground shadow-md hover:opacity-95"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Novo por aqui?{" "}
          <Link to="/onboarding" className="font-medium text-primary hover:underline">
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
