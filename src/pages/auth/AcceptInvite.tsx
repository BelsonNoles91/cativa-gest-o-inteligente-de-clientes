/**
 * AcceptInvite — página pública/autenticada para aceite de convite de equipe.
 *
 * Fluxo:
 *  1. O dono/gerente cria o convite em /app/configuracoes (TeamSettings).
 *  2. O sistema gera um link único `/auth/aceite-convite?token=...`.
 *  3. O convidado abre o link:
 *      - Se NÃO estiver logado, é redirecionado para /auth/login com `next`.
 *      - Se estiver logado com o e-mail correto, vê o resumo do convite e
 *        confirma o aceite. A RPC `accept_team_invitation` cria/atualiza o
 *        membership, valida e-mail, expiração e limite de profissionais.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
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
  const { user, loading: authLoading } = useAuth();
  const token = params.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [accepted, setAccepted] = useState(false);

  const sessionEmail = useMemo(
    () => user?.email?.toLowerCase() ?? "",
    [user?.email],
  );

  useEffect(() => {
    let active = true;
    if (!token) {
      setError("Link de convite inválido (token ausente).");
      setLoading(false);
      return;
    }
    if (authLoading) return;

    (async () => {
      // Busca por token. RLS permite o convidado (e-mail bate) ou gestor do tenant.
      const { data, error: err } = await supabase
        .from("team_invitations")
        .select("id, tenant_id, email, role, status, expires_at, message")
        .eq("token", token)
        .maybeSingle();

      if (!active) return;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
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

  if (authLoading || loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    const next = `/auth/aceite-convite?token=${encodeURIComponent(token)}`;
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="surface-card w-full max-w-md space-y-4 p-6 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="font-display text-xl font-semibold">Convite de equipe</h1>
          <p className="text-sm text-muted-foreground">
            Para aceitar este convite, faça login ou cadastre-se com o e-mail que recebeu o link.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild className="rounded-xl bg-gradient-brand">
              <Link to={`/auth/login?next=${encodeURIComponent(next)}`}>Entrar para aceitar</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to={`/onboarding?next=${encodeURIComponent(next)}`}>Criar conta</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="surface-card w-full max-w-md space-y-3 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="font-display text-xl font-semibold">Convite indisponível</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/app">Ir para o app</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) return null;

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
              {invite.tenant_name ? `Você foi convidado(a) para ${invite.tenant_name}` : "Você foi convidado(a) para um tenant"}
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
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
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
                    : "Este convite expirou. Solicite um novo ao gestor do tenant."}
              </p>
            </div>
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link to="/app">Ir para o app</Link>
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
              Ao aceitar, você passará a fazer parte deste tenant com o papel acima.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
