import { translateAuthError } from "@/lib/auth-errors";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, Loader2, ArrowRight } from "lucide-react";
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
      toast.error("Não foi possível enviar", { description: translateAuthError(error.message) });
      return;
    }
    setSent(true);
    toast.success("Link enviado!", { description: "Confira sua caixa de entrada." });
  };

  return (
    <AuthLayout>
      <div className="space-y-10">
        <Link to="/auth/login" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors group">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> Voltar ao Login
        </Link>

        <header className="space-y-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent border border-accent/20">
            Recuperação
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-primary-dark">
            Esqueceu a senha?
          </h1>
          <p className="text-lg font-light leading-relaxed text-muted-foreground">
            Enviaremos um link seguro para você redefinir sua senha de acesso.
          </p>
        </header>

        {sent ? (
          <div className="rounded-[2rem] border border-accent/20 bg-accent/5 p-8 text-center space-y-4 animate-scale-in">
            <p className="font-bold text-primary-dark italic serif text-xl">Link enviado com sucesso!</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enviamos as instruções para <strong>{email}</strong>. <br />
              Confira sua caixa de entrada e spam.
            </p>
            <Button variant="ghost" onClick={() => setSent(false)} className="text-[10px] font-bold uppercase tracking-widest text-accent hover:bg-transparent">
              Tentar outro e-mail
            </Button>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">E-mail Cadastrado</Label>
              <div className="relative group">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent" />
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@negocio.com"
                  className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="group h-16 w-full rounded-full bg-primary-dark text-lg font-bold text-white shadow-xl transition-all hover:bg-accent active:scale-[0.98]">
              {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                <span className="flex items-center gap-2">Enviar Link de Recuperação <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></span>
              )}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
