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
  Palette, Loader2, UserPlus, Trash2, Phone, ImagePlus, UploadCloud, Scissors, PlusCircle, DollarSign,
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
import { supabase } from "@/integrations/supabase/client";
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
  // Logo: o upload é diferido até a criação do tenant (RLS exige membership).
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const onPickLogo = (file: File | null) => {
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande", { description: "Máximo de 2 MB." });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

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
      { id: 2, title: "Equipe & Serviços", icon: Palette },
      { id: 3, title: "Branding", icon: Sparkles },
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

      // Upload do logo (se houver) — só agora temos tenantId + membership ativa.
      if (logoFile) {
        try {
          const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
          const path = `${result.tenantId}/logo-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("tenant-logos")
            .upload(path, logoFile, {
              cacheControl: "3600",
              upsert: true,
              contentType: logoFile.type,
            });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage
            .from("tenant-logos")
            .getPublicUrl(path);
          await supabase
            .from("tenant_settings")
            .update({ logo_url: pub.publicUrl })
            .eq("tenant_id", result.tenantId);
        } catch (err) {
          console.error("Falha ao enviar logo (workspace foi criado)", err);
          toast.warning("Workspace criado, mas o logo não pôde ser enviado.", {
            description: "Você pode tentar de novo em Configurações → Branding.",
          });
        }
      }

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

      // Criar profissionais e serviços rascunhados em lote
      if (proDrafts.length > 0) {
        await supabase.from("professionals").insert(
          proDrafts.map(proName => ({
            tenant_id: result.tenantId,
            display_name: proName,
            is_active: true
          }))
        );
      }

      if (serviceDrafts.length > 0) {
        for (const svc of serviceDrafts) {
          const { data: svcData } = await supabase.from("services").insert({
            tenant_id: result.tenantId,
            name: svc.name,
            duration_minutes: 30,
            is_active: true
          }).select("id").single();

          if (svcData) {
            await supabase.from("service_prices").insert({
              tenant_id: result.tenantId,
              service_id: svcData.id,
              amount_cents: Math.round(parseFloat(svc.price) * 100),
              currency: currency || 'BRL',
              is_default: true
            });
          }
        }
      }

      // Criar agendamento de teste se houver profissional e serviço
      if (proDrafts.length > 0 && serviceDrafts.length > 0) {
        const { data: pros } = await supabase.from("professionals").select("id").eq("tenant_id", result.tenantId).limit(1);
        const { data: svcs } = await supabase.from("services").select("id").eq("tenant_id", result.tenantId).limit(1);
        
        if (pros?.[0] && svcs?.[0]) {
          await supabase.from("appointments").insert({
            tenant_id: result.tenantId,
            unit_id: result.unitId,
            professional_id: pros[0].id,
            service_id: svcs[0].id,
            starts_at: new Date(new Date().getTime() + 2 * 60 * 60 * 1000).toISOString(),
            ends_at: new Date(new Date().getTime() + 3 * 60 * 60 * 1000).toISOString(),
            status: 'confirmed',
            notes: 'Agendamento de teste do onboarding'
          });
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

  const [serviceDrafts, setServiceDrafts] = useState<Array<{ name: string, price: string }>>([]);
  const [proDrafts, setProDrafts] = useState<string[]>([]);

  const addServiceDraft = (name: string, price: string) => {
    if (!name.trim()) return;
    setServiceDrafts([...serviceDrafts, { name, price }]);
  };

  const addProDraft = (name: string) => {
    if (!name.trim()) return;
    setProDrafts([...proDrafts, name]);
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
                      "grid h-10 w-10 place-items-center rounded-2xl text-sm font-bold transition-all duration-500",
                      done && "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
                      active && "bg-accent text-white shadow-lg shadow-accent/20 scale-110",
                      !done && !active && "bg-[#FAF7F9] text-muted-foreground border border-border/40",
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
        <div className="space-y-10 animate-fade-in">
          <header className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent border border-accent/20">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              Finalizar Cadastro
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-primary-dark">
              Vamos começar
            </h1>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Você já está logado como <span className="font-bold text-primary-dark">{user.email}</span>. Vamos configurar seu estabelecimento.
            </p>
          </header>

          <Button onClick={() => setStep(1)} className="group h-16 w-full rounded-full bg-primary-dark text-lg font-bold text-white shadow-xl transition-all hover:bg-accent active:scale-[0.98]">
            <span className="relative z-10 flex items-center justify-center gap-2">
              Configurar meu Negócio
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Button>

          <p className="text-center text-xs font-medium text-muted-foreground/60">
            Não é você?{" "}
            <Link to="/auth/login" className="text-primary-dark hover:underline">
              Entrar com outra conta
            </Link>
          </p>
        </div>
      )}

      {step === 0 && !user && (
        <div className="space-y-10 animate-fade-in">
          <header className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent border border-accent/20">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              14 dias de teste grátis
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-primary-dark">
              Criar sua conta
            </h1>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              {pendingEmailConfirmation
                ? "Quase lá! Enviamos um link de confirmação para o seu e-mail."
                : "Junte-se às marcas de beleza que mais crescem."}
            </p>
          </header>

          <form onSubmit={handleSignup} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Seu Nome</Label>
                <div className="relative group">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent" />
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5" placeholder="Como podemos te chamar" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="se" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">E-mail Profissional</Label>
                <div className="relative group">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent" />
                  <Input id="se" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5" placeholder="voce@negocio.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Senha de Acesso</Label>
                <div className="relative group">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent" />
                  <Input id="sp" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5" placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={submitting || pendingEmailConfirmation} className="group h-16 w-full rounded-full bg-primary-dark text-lg font-bold text-white shadow-xl transition-all hover:bg-accent active:scale-[0.98]">
              {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : (<span className="flex items-center gap-2">Continuar para Setup <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></span>)}
            </Button>

            {pendingEmailConfirmation && (
              <div className="rounded-[2rem] border border-accent/20 bg-accent/5 p-8 text-center space-y-4">
                <p className="font-bold text-primary-dark italic serif text-xl">Falta só confirmar seu e-mail.</p>
                <p className="text-sm text-muted-foreground">
                  Após confirmar, acesse o link de login para concluir o setup do seu novo workspace.
                </p>
                <Link to="/auth/login" className="inline-flex h-12 items-center justify-center rounded-full bg-white px-8 text-sm font-bold text-primary-dark border border-border/40 hover:bg-accent hover:text-white hover:border-accent transition-all">
                  Ir para o Login
                </Link>
              </div>
            )}
          </form>

          <p className="text-center text-xs font-medium text-muted-foreground/60">
            Já possui uma conta?{" "}
            <Link to="/auth/login" className="text-primary-dark hover:underline">
              Entrar agora
            </Link>
          </p>
        </div>
      )}

      {/* Step 1 — Negócio */}
      {step === 1 && (
        <div className="space-y-8 animate-fade-in">
          <header className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent border border-accent/20">
              Passo 01
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-primary-dark">
              Sobre seu negócio
            </h1>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Personalizamos o Cativa a partir das informações do seu estabelecimento.
            </p>
          </header>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="bn" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Nome do Estabelecimento</Label>
              <Input id="bn" required value={bizName} onChange={(e) => setBizName(e.target.value)} className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] text-base shadow-none transition-all focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-accent/5" placeholder="Ex.: Studio Aurora" />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Segmento Principal</Label>
              <Select value={segment} onValueChange={(v) => setSegment(v as TenantSegment)}>
                <SelectTrigger className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] shadow-none focus:ring-4 focus:ring-accent/5"><SelectValue placeholder="O que você faz?" /></SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40 shadow-xl">
                  {(Object.keys(segmentLabels) as TenantSegment[]).map((seg) => (
                    <SelectItem key={seg} value={seg} className="rounded-xl py-3 focus:bg-accent/5">{segmentLabels[seg]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Fuso Horário</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] shadow-none focus:ring-4 focus:ring-accent/5"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 shadow-xl">{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz} className="rounded-xl py-3 focus:bg-accent/5">{tz.split("/").pop()?.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">Moeda</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] shadow-none focus:ring-4 focus:ring-accent/5"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/40 shadow-xl">{CURRENCIES.map((c) => <SelectItem key={c} value={c} className="rounded-xl py-3 focus:bg-accent/5">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button onClick={() => {
            if (!bizName.trim() || !segment) { toast.error("Preencha o nome e o segmento."); return; }
            setStep(2);
          }} className="group h-16 w-full rounded-full bg-primary-dark text-lg font-bold text-white shadow-xl transition-all hover:bg-accent active:scale-[0.98]">
            Continuar para Identidade <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      )}

      {/* Step 2 — Equipe & Serviços */}
      {step === 2 && (
        <div className="space-y-8 animate-fade-in">
          <header className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent border border-accent/20">
              Passo 02
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-primary-dark">
              Equipe & Serviços
            </h1>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              Vamos cadastrar os primeiros profissionais e serviços para sua agenda.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="surface-card p-5 space-y-4">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
                <UserPlus className="h-5 w-5 text-primary" /> Equipe
              </h3>
              <div className="flex gap-2">
                <Input 
                  id="pro-input" 
                  placeholder="Nome do profissional" 
                  className="rounded-xl h-11" 
                  onKeyDown={(e) => { if (e.key === 'Enter') { addProDraft((e.target as any).value); (e.target as any).value = ''; } }}
                />
                <Button variant="outline" size="icon" onClick={() => { 
                  const el = document.getElementById('pro-input') as HTMLInputElement;
                  addProDraft(el.value);
                  el.value = '';
                }}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-2">
                {proDrafts.map(pro => (
                  <li key={pro} className="flex justify-between items-center bg-muted/30 px-3 py-2 rounded-lg text-sm">
                    {pro}
                    <button onClick={() => setProDrafts(curr => curr.filter(p => p !== pro))}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card p-5 space-y-4">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Scissors className="h-5 w-5 text-primary" /> Serviços
              </h3>
              <div className="space-y-2">
                <Input id="svc-name" placeholder="Ex.: Corte Masculino" className="rounded-xl h-11" />
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="svc-price" placeholder="Preço" className="rounded-xl h-11 pl-9" type="number" />
                  </div>
                  <Button variant="outline" onClick={() => {
                    const n = document.getElementById('svc-name') as HTMLInputElement;
                    const p = document.getElementById('svc-price') as HTMLInputElement;
                    addServiceDraft(n.value, p.value);
                    n.value = ''; p.value = '';
                  }}>Add</Button>
                </div>
              </div>
              <ul className="space-y-2">
                {serviceDrafts.map(svc => (
                  <li key={svc.name} className="flex justify-between items-center bg-muted/30 px-3 py-2 rounded-lg text-sm">
                    <span>{svc.name} · R$ {svc.price}</span>
                    <button onClick={() => setServiceDrafts(curr => curr.filter(s => s.name !== svc.name))}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="outline" onClick={() => setStep(1)} className="h-16 flex-1 rounded-full border-2 border-primary-dark/10 font-bold text-primary-dark">Voltar</Button>
            <Button onClick={() => setStep(3)} className="h-16 flex-1 rounded-full bg-primary-dark font-bold text-white shadow-xl hover:bg-accent transition-all">Continuar</Button>
          </div>
        </div>
      )}

      {/* Step 3 — Branding */}
      {step === 3 && (
        <div className="space-y-8 animate-fade-in">
          <header className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-accent border border-accent/20">
              Passo 03
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-primary-dark">
              Cores & Marca
            </h1>
            <p className="text-lg font-light leading-relaxed text-muted-foreground">
              A identidade visual que seus clientes verão ao agendar.
            </p>
          </header>

          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {[
                { v: brandPrimary, set: setBrandPrimary, l: "Primária" },
                { v: brandSecondary, set: setBrandSecondary, l: "Secundária" },
                { v: brandAccent, set: setBrandAccent, l: "Acento" },
              ].map((c) => (
                <div key={c.l} className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">{c.l}</Label>
                  <div className="flex items-center gap-2 rounded-2xl border border-border/40 bg-[#FAF7F9] px-2 h-14">
                    <input type="color" value={c.v} onChange={(e) => c.set(e.target.value)} className="h-8 w-8 cursor-pointer rounded-lg border-none bg-transparent" />
                    <Input value={c.v} onChange={(e) => c.set(e.target.value)} className="h-9 border-0 px-1 text-xs shadow-none bg-transparent font-mono" />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="un" className="text-xs font-bold uppercase tracking-[0.1em] text-primary-dark/60 ml-1">WhatsApp Business</Label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input id="wp" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} className="h-14 rounded-2xl border-border/40 bg-[#FAF7F9] pl-12 text-base shadow-none transition-all" placeholder="(11) 99999-9999" />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="outline" onClick={() => setStep(2)} className="h-16 flex-1 rounded-full border-2 border-primary-dark/10 font-bold text-primary-dark">Voltar</Button>
            <Button onClick={() => setStep(4)} className="h-16 flex-1 rounded-full bg-primary-dark font-bold text-white shadow-xl hover:bg-accent transition-all">Continuar</Button>
          </div>
        </div>
      )}

      {/* Step 4 — Confirmação / criação */}
      {step === 4 && (
        <div className="space-y-10 text-center animate-fade-in">
          <header className="space-y-6">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2.5rem] bg-accent/10 border border-accent/20 text-accent shadow-lg shadow-accent/5">
              <Sparkles className="h-10 w-10 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight text-primary-dark">Tudo pronto!</h1>
              <p className="mt-2 text-lg font-light leading-relaxed text-muted-foreground px-4">
                Confira os detalhes antes de criarmos seu workspace profissional.
              </p>
            </div>
          </header>

          <div className="rounded-[2.5rem] border border-border/40 bg-[#FAF7F9] overflow-hidden text-left shadow-sm">
            <div className="p-6 md:p-8 space-y-4">
              {[
                { label: "Estabelecimento", val: bizName },
                { label: "Segmento", val: segment ? segmentLabels[segment as TenantSegment] : "—" },
                { label: "Unidade Principal", val: unitName || "Matriz" },
                { label: "Colaboradores", val: `${proDrafts.length} profissional(is)` },
                { label: "Serviços", val: `${serviceDrafts.length} item(ns)` },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between pb-4 border-b border-border/10 last:border-0 last:pb-0">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">{item.label}</span>
                  <span className="font-bold text-primary-dark text-lg">{item.val}</span>
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleFinish} disabled={submitting} className="group h-20 w-full rounded-full bg-primary-dark text-xl font-bold text-white shadow-2xl transition-all hover:bg-accent active:scale-[0.98]">
            {submitting ? <Loader2 className="h-8 w-8 animate-spin" /> : (
              <span className="flex items-center gap-3">
                Finalizar e Acessar o Cativa
                <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
              </span>
            )}
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
