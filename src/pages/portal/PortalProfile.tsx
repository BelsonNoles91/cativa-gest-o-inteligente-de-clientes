/**
 * PortalProfile — perfil e preferências do cliente.
 *
 * - Editar dados (nome, telefone, whatsapp, data nasc., cidade/estado, preferências)
 * - Definir unidade preferida + profissional preferido
 * - Assinar termos pendentes
 */
import { useEffect, useMemo, useState } from "react";
import { FULL_NAME_ERROR, WHATSAPP_ERROR, isValidFullName, isValidMobileBR, maskMobileBR } from "@/lib/client-validation";
import { FileText, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { handleError } from "@/lib/error-handler";
import { useAuth } from "@/features/auth/AuthProvider";
import { PushNotificationsCard } from "@/features/notifications/PushNotificationsCard";

import { usePortalClient } from "@/features/portal/PortalClientProvider";
import {
  listMyPendingConsents,
  listPortalProfessionals,
  listPortalUnits,
  signConsent,
  updateClientPreferences,
  updateClientProfile,
  type PortalProfessionalOption,
  type PortalUnitOption,
} from "@/repositories/portal";
import type { PortalConsentPending } from "@/domain/portal";

export default function PortalProfile() {
  const { activeLink, profile, refresh } = usePortalClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [units, setUnits] = useState<PortalUnitOption[]>([]);
  const [pros, setPros] = useState<PortalProfessionalOption[]>([]);
  const [consents, setConsents] = useState<PortalConsentPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [preferences, setPreferences] = useState("");
  const [allergies, setAllergies] = useState("");

  const [prefUnit, setPrefUnit] = useState<string>("");
  const [prefPro, setPrefPro] = useState<string>("");

  const [openConsent, setOpenConsent] = useState<PortalConsentPending | null>(null);
  const [signedName, setSignedName] = useState("");

  useEffect(() => {
    if (!activeLink) return;
    void (async () => {
      setLoading(true);
      try {
        const [us, pr, cs] = await Promise.all([
          listPortalUnits(activeLink.tenantId),
          listPortalProfessionals(activeLink.tenantId),
          listMyPendingConsents(activeLink.tenantId, activeLink.clientId),
        ]);
        setUnits(us);
        setPros(pr);
        setConsents(cs);
      } catch (err) {
        handleError(err, {
          category: "DATABASE",
          context: { source: "PortalProfile.load" },
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLink]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setPhone(maskMobileBR(profile.phone));
    setWhatsapp(maskMobileBR(profile.whatsappPhone || profile.phone));
    setBirthDate(profile.birthDate ?? "");
    setCity(profile.city ?? "");
    setState(profile.state ?? "");
    setPreferences(profile.preferences ?? "");
    setAllergies(profile.allergies ?? "");
    setPrefUnit(profile.preferredUnitId ?? "");
    setPrefPro(profile.preferredProfessionalId ?? "");
  }, [profile]);

  const filteredPros = useMemo(
    () => pros.filter((p) => !p.unitId || p.unitId === prefUnit || !prefUnit),
    [pros, prefUnit],
  );

  async function handleSave() {
    if (!activeLink || !profile) return;
    if (!isValidFullName(fullName)) {
      toast({ title: "Nome incompleto", description: FULL_NAME_ERROR, variant: "destructive" });
      return;
    }
    if (!isValidMobileBR(whatsapp)) {
      toast({ title: "WhatsApp obrigatório", description: WHATSAPP_ERROR, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateClientProfile(profile.id, {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        whatsappPhone: whatsapp.trim() || null,
        birthDate: birthDate || null,
        city: city.trim() || null,
        state: state.trim() || null,
        preferences: preferences.trim() || null,
        allergies: allergies.trim() || null,
      });
      await updateClientPreferences(profile.id, {
        preferredUnitId: prefUnit || null,
        preferredProfessionalId: prefPro || null,
      });
      toast({ title: "Perfil atualizado" });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSignConsent() {
    if (!openConsent || !user) return;
    if (!signedName.trim()) {
      toast({ title: "Digite seu nome para assinar", variant: "destructive" });
      return;
    }
    try {
      await signConsent({
        responseId: openConsent.responseId,
        signedName: signedName.trim(),
        signedText: openConsent.templateBody,
        userId: user.id,
      });
      toast({ title: "Termo assinado!" });
      setOpenConsent(null);
      setSignedName("");
      if (activeLink) {
        const cs = await listMyPendingConsents(activeLink.tenantId, activeLink.clientId);
        setConsents(cs);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao assinar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Mantenha seus dados em dia para um atendimento melhor
        </p>
      </header>

      {/* Termos pendentes */}
      {consents.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Termos pendentes
          </h2>
          {consents.map((c) => (
            <Card
              key={c.responseId}
              className="flex items-center gap-3 p-3"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15 text-warning">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.templateTitle}</p>
                <p className="text-xs text-muted-foreground">
                  Aguardando sua assinatura
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpenConsent(c);
                  setSignedName(profile?.fullName ?? "");
                }}
              >
                Ler e assinar
              </Button>
            </Card>
          ))}
        </section>
      )}

      <PushNotificationsCard
        description="Receba um aviso no celular um dia antes do seu horário, mesmo com o app fechado."
      />

      {/* Dados */}

      <Card className="space-y-4 p-4">
        <h2 className="font-display text-lg font-semibold">Dados pessoais</h2>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={phone}
                inputMode="tel"
                onChange={(e) => setPhone(maskMobileBR(e.target.value))}
                placeholder="(11) 99999-0000"
              />
            </div>
            <div>
              <Label htmlFor="wa">WhatsApp (com DDD) *</Label>
              <Input
                id="wa"
                value={whatsapp}
                inputMode="tel"
                onChange={(e) => setWhatsapp(maskMobileBR(e.target.value))}
                placeholder="(11) 99999-0000"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="birth">Data de nascimento</Label>
            <Input
              id="birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="state">UF</Label>
              <Input
                id="state"
                value={state}
                maxLength={2}
                onChange={(e) => setState(e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Preferências */}
      <Card className="space-y-4 p-4">
        <h2 className="font-display text-lg font-semibold">Preferências</h2>
        <div>
          <Label className="mb-1 block">Unidade preferida</Label>
          <Select
            value={prefUnit}
            onValueChange={(v) => {
              setPrefUnit(v);
              setPrefPro("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem preferência" />
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">Profissional preferido</Label>
          <Select value={prefPro} onValueChange={setPrefPro}>
            <SelectTrigger>
              <SelectValue placeholder="Sem preferência" />
            </SelectTrigger>
            <SelectContent>
              {filteredPros.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block">O que você gosta?</Label>
          <Textarea
            rows={3}
            value={preferences}
            onChange={(e) => setPreferences(e.target.value.slice(0, 500))}
            placeholder="Ex.: prefiro ambientes silenciosos, gosto de chá antes da sessão…"
          />
        </div>
        <div>
          <Label className="mb-1 block">Alergias / restrições</Label>
          <Textarea
            rows={2}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value.slice(0, 500))}
            placeholder="Informe qualquer alergia ou restrição importante."
          />
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <Save className="mr-1.5 h-4 w-4" /> Salvar alterações
          </>
        )}
      </Button>

      {/* Dialog de termo */}
      <Dialog open={!!openConsent} onOpenChange={(o) => !o && setOpenConsent(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{openConsent?.templateTitle}</DialogTitle>
            <DialogDescription>
              Leia o termo abaixo e digite seu nome para assinar.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-72 rounded-md border p-3 text-sm">
            <p className="whitespace-pre-wrap">{openConsent?.templateBody}</p>
          </ScrollArea>
          <div>
            <Label htmlFor="signed">Seu nome completo</Label>
            <Input
              id="signed"
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              placeholder="Como assinatura"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenConsent(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSignConsent}>Assinar termo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
