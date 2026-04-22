import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/AuthProvider";

export default function PortalAccess() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [submitting, setSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate("/portal", { replace: true });
    }
  }, [loading, navigate, user]);

  const target =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/portal";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(loginEmail.trim(), loginPassword);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    toast.success("Acesso liberado");
    navigate(target, { replace: true });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (signupPassword.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(signupEmail.trim(), signupPassword, fullName.trim(), {
      emailRedirectTo: `${window.location.origin}/portal`,
      metadata: { portal_access: true },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    toast.success("Conta criada", {
      description:
        "Se o seu acesso não entrar automaticamente, confirme o e-mail e volte ao portal.",
    });
    setMode("login");
    setLoginEmail(signupEmail.trim());
    setLoginPassword("");
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Portal do cliente</h1>
        <p className="text-sm text-muted-foreground">
          Entre para acompanhar horários, reagendar, assinar termos e ver seus pacotes.
        </p>
      </div>

      <Tabs value={mode} onValueChange={setMode} className="mt-8 space-y-5">
        <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl">
          <TabsTrigger value="login">Entrar</TabsTrigger>
          <TabsTrigger value="signup">Criar acesso</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="portal-login-email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="portal-login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="portal-login-password">Senha</Label>
                <Link to="/auth/recuperar" className="text-xs font-medium text-primary hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="portal-login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-brand text-primary-foreground shadow-md">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar no portal"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form className="space-y-4" onSubmit={handleSignup}>
            <div className="space-y-2">
              <Label htmlFor="portal-signup-name">Seu nome</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="portal-signup-name"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nome completo"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-signup-email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="portal-signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="Use o mesmo e-mail cadastrado na recepção"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-signup-password">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="portal-signup-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-brand text-primary-foreground shadow-md">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar acesso ao portal"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              O e-mail precisa bater com o cadastro já existente no estabelecimento para o acesso ser liberado automaticamente.
            </p>
          </form>
        </TabsContent>
      </Tabs>
    </AuthLayout>
  );
}
