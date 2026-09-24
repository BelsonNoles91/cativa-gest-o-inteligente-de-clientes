/**
 * AcceptInvite — página pública/autenticada para aceite de convite de equipe.
 *
 * Fluxo:
 *  1. O dono/gerente cria o convite em /app/configuracoes (TeamSettings).
 *  2. O sistema gera um link único `/auth/aceite-convite?token=...`.
 *  3. O convidado abre o link:
 *      - Se NÃO estiver logado, vê o formulário de signup simplificado
 *        (apenas nome + senha) e, ao criar a conta, o convite é aceito
 *        automaticamente.
 *      - Se estiver logado com o e-mail correto, vê o resumo do convite e
 *        confirma o aceite. A RPC `accept_team_invitation` cria/atualiza o
 *        membership, valida e-mail, expiração e limite de profissionais.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  User,
  Lock,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabels, type Role } from "@/domain/roles";

interface InvitePreview {
  id: string;
  tenant_id: string;
  email: string;
  role: Role;
  status: string;
  expires_at: string;
  message: string | null;
  tenant_name?: string | null;
}

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signUp } = useAuth();
  const token = params.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [accepted, setAccepted] = useState(false);

  // Signup inline state
  const [signupMode, setSignupMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [signingUp, setSigningUp] = useState(false);

  const sessionEmail = useMemo(
    () => user?.email?.toLowerCase() ?? "",
    [user?.email],
  );

  // Buscar preview do convite (funciona com ou sem login)
  useEffect(() => {
    let active = true;
    if (!token) {
      setError("Link de convite inválido (token ausente).");
      setLoading(false);
      return;
    }
    if (authLoading) return;

    (async () => {
      const { data: rows, error: err } = await supabase.rpc("lookup_team_invitation", {
        _token: token,
      });

      if (!active) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const data = Array.isArray(rows) ? rows[0] : null;
      if (!data) {
        setError(
          user
            ? "Convite não encontrado ou emitido para outro e-mail."
            : "Você precisa estar logado com o e-mail do convite para visualizá-lo.",
        );
        setLoading(false);
        return;
      }

      // Tenta enriquecer com nome do tenant (best-effort, ignora se RLS bloquear)
      let tenantName: string | null = null;
      try {
        const { data: t } = await supabase
          .from("tenants")
          .select("name")
          .eq("id", data.tenant_id)
          .maybeSingle();
        tenantName = t?.name ?? null;
      } catch {
        tenantName = null;
      }

      setInvite({ ...(data as InvitePreview), tenant_name: tenantName });
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [token, authLoading, user]);

  // Aceitar convite
  const onAccept = async () => {
    if (!invite) return;
    setAccepting(true);
    try {
      const { error: err } = await supabase.rpc("accept_team_invitation", {
        _token: token,
      });
      if (err) throw err;
      setAccepted(true);
      toast.success("Convite aceito! Bem-vindo(a) à equipe.");
      setTimeout(() => navigate("/app", { replace: true }), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao aceitar convite.";
      toast.error(msg);
      setError(msg);
    } finally {
      setAccepting(false);
    }
  };

  // Signup simplificado + aceite automático
  const onSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setSigningUp(true);
    try {
      const { error: signupErr, requiresEmailConfirmation } = await signUp(invite.email, password, fullName.trim());
      if (signupErr) {
        // Se o usuário já existe, tentar login
        if (signupErr.message.includes("already registered") || signupErr.message.includes("already exists")) {
          toast.info("Você já tem uma conta. Faça login para aceitar o convite.");
          const next = `/auth/aceite-convite?token=${encodeURIComponent(token)}`;
          navigate(`/auth/login?next=${encodeURIComponent(next)}`);
          return;
        }
        throw signupErr;
      }

      if (requiresEmailConfirmation) {
        toast.success("Conta criada! Confirme seu e-mail para continuar.", {
          description: `Enviamos um link de confirmação para ${invite.email}. Depois de confirmar, acesse este link de convite novamente.`,
          duration: 10000,
        });
        return;
      }

      // Após signup sem confirmação de e-mail, aceitar o convite automaticamente
      const { error: acceptErr } = await supabase.rpc("accept_team_invitation", {
        _token: token,
      });
      if (acceptErr) {
        console.error("Erro ao aceitar convite após signup:", acceptErr);
        toast.warning("Conta criada! Peça ao gestor um novo link de convite.", {
          description: acceptErr.message,
        });
        navigate("/app", { replace: true });
        return;
      }
      setAccepted(true);
      toast.success("Conta criada e convite aceito! Bem-vindo(a) à equipe.");
      setTimeout(() => navigate("/app", { replace: true }), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar conta.";
      toast.error(msg);
    } finally {
      setSigningUp(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // =========================================
  // Usuário NÃO logado: signup simplificado
  // =========================================
  if (!user) {
    const next = `/auth/aceite-convite?token=${encodeURIComponent(token)}`;

    // Se não conseguiu carregar o preview (lookup exige login), mostrar signup/login
    if (!invite) {
      return (
        <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
          <div className="surface-card w-full max-w-md space-y-5 p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-foreground">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold">Convite de equipe</h1>
                <p className="text-xs text-muted-foreground">
                  Você recebeu um convite para integrar uma equipe na Cativa.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground space-y-1">
              <p>Para continuar, entre na sua conta ou crie uma nova.</p>
              <p className="text-[11px]">Use o mesmo e-mail que recebeu o convite.</p>
            </div>

            <div className="space-y-2">
              <Button asChild className="h-12 w-full rounded-xl bg-gradient-brand">
                <Link to={`/auth/login?next=${encodeURIComponent(next)}`}>
                  <Mail className="mr-2 h-4 w-4" /> Entrar com minha conta
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Não tem conta?{" "}
                <Link to={`/auth/login?next=${encodeURIComponent(next)}&signup=1`} className="text-primary-dark font-medium hover:underline">
                  Criar conta agora
                </Link>
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Signup simplificado inline
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
        <div className="surface-card w-full max-w-md space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Você foi convidado!</h1>
              <p className="text-xs text-muted-foreground">
                {invite.tenant_name
                  ? `Junte-se à equipe de ${invite.tenant_name}`
                  : "Junte-se à equipe"}
              </p>
            </div>
          </div>

          <dl className="grid gap-2 rounded-xl bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="truncate font-medium">{invite.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Papel</dt>
              <dd className="font-medium">{roleLabels[invite.role]}</dd>
            </div>
          </dl>

          {invite.message && (
            <p className="rounded-xl border border-border/50 bg-background p-3 text-sm italic text-muted-foreground">
              "{invite.message}"
            </p>
          )}

          <form onSubmit={onSignupAndAccept} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/80 ml-1">Seu Nome</Label>
              <div className="relative group">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5"
                  placeholder="Como podemos te chamar"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/80 ml-1">Senha de Acesso</Label>
              <div className="relative group">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={signingUp}
              className="h-14 w-full rounded-full bg-primary-dark text-base font-bold text-white shadow-xl hover:bg-accent"
            >
              {signingUp ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Criar conta e entrar na equipe"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Já possui uma conta?{" "}
            <Link to={`/auth/login?next=${encodeURIComponent(next)}`} className="text-primary-dark font-medium hover:underline">
              Entrar agora
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // =========================================
  // Erro (com sessão)
  // =========================================
  if (error && !invite) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="surface-card w-full max-w-md space-y-3 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="font-display text-xl font-semibold">Convite indisponível</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/app">Ir para o sistema</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  // =========================================
  // Usuário logado: mostrar resumo e aceitar
  // =========================================
  const expired = new Date(invite.expires_at).getTime() <= Date.now();
  const wrongEmail = invite.email.toLowerCase() !== sessionEmail;
  const blocked = invite.status !== "pending" || expired || wrongEmail;

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <div className="surface-card w-full max-w-md space-y-5 p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-soft text-accent-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Convite de equipe</h1>
            <p className="text-xs text-muted-foreground">
              {invite.tenant_name ? `Você foi convidado(a) para ${invite.tenant_name}` : "Você foi convidado(a) para uma equipe"}
            </p>
          </div>
        </div>

        <dl className="grid gap-2 rounded-xl bg-muted/40 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">E-mail convidado</dt>
            <dd className="truncate font-medium">{invite.email}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Papel</dt>
            <dd className="font-medium">{roleLabels[invite.role]}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Validade</dt>
            <dd className="font-medium">{new Date(invite.expires_at).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium capitalize">{invite.status}</dd>
          </div>
        </dl>

        {invite.message && (
          <p className="rounded-xl border border-border/50 bg-background p-3 text-sm italic text-muted-foreground">
            "{invite.message}"
          </p>
        )}

        {accepted ? (
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" /> Convite aceito! Redirecionando…
          </div>
        ) : blocked ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {wrongEmail
                  ? `Este convite foi emitido para ${invite.email}, mas você está logado como ${sessionEmail}.`
                  : invite.status !== "pending"
                    ? `Este convite está com status "${invite.status}" e não pode ser aceito.`
                    : "Este convite expirou. Solicite um novo ao gestor da equipe."}
              </p>
            </div>
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link to="/app">Ir para o sistema</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button
              onClick={onAccept}
              disabled={accepting}
              className="h-11 w-full rounded-xl bg-gradient-brand"
            >
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aceitar convite"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Ao aceitar, você passará a fazer parte desta equipe com o papel acima.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
