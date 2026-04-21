import { Link } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Bem-vindo de volta</h1>
        <p className="text-sm text-muted-foreground">
          Acesse sua conta Cativa para continuar.
        </p>
      </div>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          // Etapa 1: sem auth funcional ainda.
          window.location.href = "/app";
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="voce@negocio.com" className="h-11 rounded-xl pl-9" />
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
            <Input id="password" type="password" placeholder="••••••••" className="h-11 rounded-xl pl-9" />
          </div>
        </div>

        <Button type="submit" className="h-11 w-full rounded-xl bg-gradient-brand text-primary-foreground shadow-md hover:opacity-95">
          Entrar
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
