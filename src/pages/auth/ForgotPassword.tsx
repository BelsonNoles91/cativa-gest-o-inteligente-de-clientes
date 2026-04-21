import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await resetPassword(email.trim());
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar", { description: error.message });
      return;
    }
    setSent(true);
    toast.success("Link enviado!", { description: "Confira sua caixa de entrada." });
  };

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

      {sent ? (
        <div className="mt-8 rounded-xl border border-border/70 bg-card p-5 text-sm">
          Enviamos um link para <strong>{email}</strong>. Se não chegar em alguns minutos,
          confira sua caixa de spam.
        </div>
      ) : (
        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail cadastrado</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@negocio.com"
                className="h-11 rounded-xl pl-9"
              />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-brand text-primary-foreground hover:opacity-95">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
