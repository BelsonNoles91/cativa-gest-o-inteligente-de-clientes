/**
 * Onboarding — fluxo completo do owner.
 *
 * Passos:
 *  0) Criar conta (se não houver sessão) OU pular se já logado
 *  1) Negócio: nome + segmento + fuso/moeda
 *  2) Branding & primeira unidade: cores + nome da unidade + WhatsApp
 *  3) Equipe inicial (convites — opcional)
 *  4) Conclusão → /app
 *
 * Toda persistência usa o service createTenantWithOwner (regras fora da UI).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2, Sparkles, Rocket, ArrowRight, Check, Mail, Lock, User,
  Palette, Loader2, UserPlus, Trash2, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/shell/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import { segmentLabels, type TenantSegment } from "@/domain/tenant";
import { ROLES, roleLabels, type Role } from "@/domain/roles";
import { createTenantWithOwner } from "@/services/tenant/createTenantWithOwner";
import { inviteMember } from "@/services/team/inviteMember";
import { cn } from "@/lib/utils";
import { SignOutAndRestart } from "@/components/auth/SignOutAndRestart";

interface InviteDraft {
  email: string;
  role: Role;
}

const TIMEZONES = [
  "America/Sao_Paulo", "America/Manaus", "America/Belem",
  "America/Recife", "America/Fortaleza", "America/Cuiaba",
];

const CURRENCIES = ["BRL", "USD", "EUR"];

const INVITE_ROLES: Role[] = ROLES.filter((r) => r !== "super_admin" && r !== "client" && r !== "owner");

export default function Onboarding() {
  const { user, signUp, loading: authLoading } = useAuth();
  const {
    refresh,
    currentTenant,
    loading: tenantLoading,
    setCurrentTenantId,
    setCurrentUnitId,
  } = useTenant();
  const navigate = useNavigate();

  // Step 0 sempre aparece quando o usuário ainda não tem tenant/membership completo,
  // mesmo que já exista uma sessão ativa (preview, navegador antigo, etc.).
  // Só pulamos o Step 0 quando o avanço for explícito (após signup ou login bem-sucedido).
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);

  // signup
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // negócio
  const [bizName, setBizName] = useState("");
  const [segment, setSegment] = useState<TenantSegment | "">("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [currency, setCurrency] = useState("BRL");

  // branding + unidade
  const [unitName, setUnitName] = useState("Matriz");
  const [unitPhone, setUnitPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [brandPrimary, setBrandPrimary] = useState("#6E3B5D");
  const [brandSecondary, setBrandSecondary] = useState("#E9D7E2");
  const [brandAccent, setBrandAccent] = useState("#7FAE9B");

  // equipe
  const [invites, setInvites] = useState<InviteDraft[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("frontdesk");

  // Não avançamos automaticamente do Step 0 baseado em sessão. O Step 0 serve como
  // ponto de entrada para criar conta; quem já tem conta usa o link "Já tenho conta"
  // ou avança manualmente após o signup. Se o tenant já existir, o efeito abaixo
  // redireciona direto para /app.

  // Redirect para /app quando o tenant já existe é responsabilidade do
  // <OnboardingGuard> (em src/features/auth/guards.tsx). Não duplicamos aqui.

  const steps = useMemo(
    () => [
      { id: 1, title: "Negócio", icon: Building2 },
      { id: 2, title: "Branding & Unidade", icon: Palette },
      { id: 3, title: "Equipe", icon: UserPlus },
      { id: 4, title: "Pronto", icon: Rocket },
    ],
    [],
  );

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    setSubmitting(true);
    const { error, requiresEmailConfirmation } = await signUp(email.trim(), password, fullName.trim());
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }

    if (requiresEmailConfirmation) {
      setPendingEmailConfirmation(true);
      toast.success("Conta criada! Confirme seu e-mail para continuar.");
      return;
    }

    toast.success("Conta criada!");
    setStep(1);
  };

  const addInvite = () => {
    const e = inviteEmail.trim().toLowerCase();
    if (!e || !/.+@.+\..+/.test(e)) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    if (invites.some((i) => i.email === e)) {
      toast.error("Este e-mail já está na lista.");
      return;
    }
    setInvites((curr) => [...curr, { email: e, role: inviteRole }]);
    setInviteEmail("");
  };

  const handleFinish = async () => {
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      navigate("/auth/login");
      return;
    }
    if (!bizName.trim() || !segment) {
      toast.error("Preencha nome e segmento do negócio.");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createTenantWithOwner({
        ownerUserId: user.id,
        name: bizName.trim(),
        segment: segment as TenantSegment,
        timezone,
        currency,
        unitName: unitName.trim() || "Matriz",
        unitPhone: unitPhone.trim() || undefined,
        brandPrimary, brandSecondary, brandAccent,
        whatsappPhone: whatsappPhone.trim() || undefined,
      });

      // convites (opcional)
      for (const inv of invites) {
        try {
          await inviteMember({
            tenantId: result.tenantId,
            email: inv.email,
            role: inv.role,
            inviterUserId: user.id,
          });
        } catch (err) {
          console.error("Falha ao registrar convite", err);
        }
      }

      setCurrentTenantId(result.tenantId);
      setCurrentUnitId(result.unitId);
      await refresh();
      toast.success("Tudo pronto! Bem-vindo ao Cativa.");
      navigate("/app", { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível concluir", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ----- Render -----
  return (
    <AuthLayout>
      {user && (
        <div className="mb-4 flex justify-end">
          <SignOutAndRestart />
        </div>
      )}
      {step !== 0 && (
        <div className="mb-8">
          <ol className="flex items-center gap-2">
            {steps.map((s, i) => {
              const active = s.id === step;
              const done = s.id < step;
              return (
                <li key={s.id} className="flex flex-1 items-center gap-2">
                  <div
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-full text-xs font-semibold transition-colors",
                      done && "bg-success text-success-foreground",
                      active && "bg-primary text-primary-foreground",
                      !done && !active && "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : s.id}
                  </div>
                  {i < steps.length - 1 && (
                    <div className={cn("h-px flex-1", done ? "bg-success" : "bg-border")} />
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
            Passo {step} de {steps.length} — {steps[step - 1].title}
          </p>
        </div>
      )}

      {/* Step 0 — signup (ou continuar, se já houver sessão sem tenant) */}
      {step === 0 && user && (
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-2xl font-semibold">Vamos finalizar seu cadastro</h1>
          <p className="text-sm text-muted-foreground">
            Você já está autenticado como <span className="font-medium text-foreground">{user.email}</span>,
            mas ainda não há um estabelecimento configurado. Continue para criar seu workspace.
          </p>

          <Button onClick={() => setStep(1)} className="h-11 w-full rounded-xl bg-gradient-brand">
            Continuar setup <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Não é você?{" "}
            <Link to="/auth/login" className="font-medium text-primary hover:underline">
              Entrar com outra conta
            </Link>
          </p>
        </div>
      )}

      {step === 0 && !user && (
        <form onSubmit={handleSignup} className="space-y-4 animate-fade-in">
          <h1 className="text-2xl font-semibold">Criar sua conta</h1>
          <p className="text-sm text-muted-foreground">
            {pendingEmailConfirmation
              ? "Enviamos um link de confirmação. Abra seu e-mail e depois entre para continuar o setup."
              : "Comece em minutos. 14 dias grátis."}
          </p>

          <div className="space-y-2">
            <Label htmlFor="name">Seu nome</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11 rounded-xl pl-9" placeholder="Como podemos te chamar" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="se">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="se" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl pl-9" placeholder="voce@negocio.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp">Senha</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="sp" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl pl-9" placeholder="Mínimo 8 caracteres" />
            </div>
          </div>

          <Button type="submit" disabled={submitting || pendingEmailConfirmation} className="h-11 w-full rounded-xl bg-gradient-brand">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Continuar <ArrowRight className="ml-2 h-4 w-4" /></>)}
          </Button>

          {pendingEmailConfirmation && (
            <div className="rounded-xl border border-border/70 bg-card px-4 py-3 text-left text-sm">
              <p className="font-medium">Falta só confirmar seu e-mail.</p>
              <p className="mt-1 text-muted-foreground">
                Depois da confirmação, faça login para concluir a criação do workspace.
              </p>
              <Link to="/auth/login" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
                Ir para o login
              </Link>
            </div>
          )}
        </form>
      )}

      {/* Step 1 — Negócio */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-2xl font-semibold">Vamos conhecer seu negócio</h1>
          <p className="text-sm text-muted-foreground">Personalizamos o Cativa a partir destas informações.</p>

          <div className="space-y-2">
            <Label htmlFor="bn">Nome do estabelecimento</Label>
            <Input id="bn" required value={bizName} onChange={(e) => setBizName(e.target.value)} className="h-11 rounded-xl" placeholder="Ex.: Studio Aurora" />
          </div>

          <div className="space-y-2">
            <Label>Segmento</Label>
            <Select value={segment} onValueChange={(v) => setSegment(v as TenantSegment)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione um segmento" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(segmentLabels) as TenantSegment[]).map((seg) => (
                  <SelectItem key={seg} value={seg}>{segmentLabels[seg]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fuso horário</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Moeda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={() => {
            if (!bizName.trim() || !segment) { toast.error("Preencha nome e segmento."); return; }
            setStep(2);
          }} className="h-11 w-full rounded-xl bg-gradient-brand">
            Continuar <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2 — Branding + unidade */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-2xl font-semibold">Identidade & primeira unidade</h1>
          <p className="text-sm text-muted-foreground">Escolha cores e cadastre a unidade principal. Você pode mudar depois.</p>

          <div className="grid grid-cols-3 gap-3">
            {[
              { v: brandPrimary, set: setBrandPrimary, l: "Primária" },
              { v: brandSecondary, set: setBrandSecondary, l: "Secundária" },
              { v: brandAccent, set: setBrandAccent, l: "Acento" },
            ].map((c) => (
              <div key={c.l} className="space-y-2">
                <Label>{c.l}</Label>
                <div className="flex items-center gap-2 rounded-xl border border-border/70 px-2 h-11">
                  <input type="color" value={c.v} onChange={(e) => c.set(e.target.value)} className="h-7 w-7 cursor-pointer rounded" />
                  <Input value={c.v} onChange={(e) => c.set(e.target.value)} className="h-9 border-0 px-1 text-xs shadow-none focus-visible:ring-0" />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="un">Nome da unidade</Label>
            <Input id="un" value={unitName} onChange={(e) => setUnitName(e.target.value)} className="h-11 rounded-xl" placeholder="Matriz" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="up">Telefone da unidade</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="up" value={unitPhone} onChange={(e) => setUnitPhone(e.target.value)} className="h-11 rounded-xl pl-9" placeholder="(11) 0000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wp">WhatsApp do negócio</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="wp" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className="h-11 rounded-xl pl-9" placeholder="(11) 99999-0000" />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Lembre: o WhatsApp será usado para gerar mensagens e abrir conversas manualmente. Nenhum envio automático.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="h-11 flex-1 rounded-xl">Voltar</Button>
            <Button onClick={() => setStep(3)} className="h-11 flex-1 rounded-xl bg-gradient-brand">Continuar</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Equipe */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <h1 className="text-2xl font-semibold">Convide sua equipe</h1>
          <p className="text-sm text-muted-foreground">Opcional — você pode adicionar pessoas depois nas Configurações.</p>

          <div className="rounded-xl border border-border/70 p-3 space-y-3">
            <div className="grid grid-cols-[1fr_140px_auto] gap-2">
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@equipe.com" className="h-10 rounded-lg" />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" onClick={addInvite} className="h-10 rounded-lg" variant="outline">
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>

            {invites.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum convite adicionado.</p>
            ) : (
              <ul className="space-y-1.5">
                {invites.map((i) => (
                  <li key={i.email} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    <span className="truncate">{i.email}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{roleLabels[i.role]}</span>
                      <button type="button" onClick={() => setInvites((curr) => curr.filter((x) => x.email !== i.email))} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="h-11 flex-1 rounded-xl">Voltar</Button>
            <Button onClick={() => setStep(4)} className="h-11 flex-1 rounded-xl bg-gradient-brand">Continuar</Button>
          </div>
        </div>
      )}

      {/* Step 4 — Confirmação / criação */}
      {step === 4 && (
        <div className="space-y-5 text-center animate-fade-in">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Tudo pronto para criar!</h1>
            <p className="mt-1 text-sm text-muted-foreground">Vamos preparar seu workspace agora.</p>
          </div>

          <ul className="rounded-xl border border-border/70 bg-card text-left text-sm divide-y divide-border/60">
            <li className="flex items-center justify-between p-3"><span className="text-muted-foreground">Estabelecimento</span><span className="font-medium">{bizName}</span></li>
            <li className="flex items-center justify-between p-3"><span className="text-muted-foreground">Segmento</span><span className="font-medium">{segment ? segmentLabels[segment as TenantSegment] : "—"}</span></li>
            <li className="flex items-center justify-between p-3"><span className="text-muted-foreground">Unidade</span><span className="font-medium">{unitName || "Matriz"}</span></li>
            <li className="flex items-center justify-between p-3"><span className="text-muted-foreground">Convites</span><span className="font-medium">{invites.length}</span></li>
          </ul>

          <Button onClick={handleFinish} disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-brand">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Criar e acessar o Cativa <ArrowRight className="ml-2 h-4 w-4" /></>)}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
