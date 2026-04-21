import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  return (
    <AuthLayout>
      <Link to="/auth/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar ao login
      </Link>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Enviaremos um link para você redefinir sua senha.
        </p>
      </div>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">E-mail cadastrado</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="voce@negocio.com" className="h-11 rounded-xl pl-9" />
          </div>
        </div>

        <Button type="submit" className="h-11 w-full rounded-xl bg-gradient-brand text-primary-foreground hover:opacity-95">
          Enviar link
        </Button>
      </form>
    </AuthLayout>
  );
}
