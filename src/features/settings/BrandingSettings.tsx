/**
 * BrandingSettings — cores, logo (upload) e WhatsApp do negócio.
 * Bloqueado para planos sem a feature `custom_branding`.
 */
import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { PlanLockedNotice } from "@/features/billing/PlanLockedNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoUploader } from "@/components/brand/LogoUploader";

function readableTextColor(background: string) {
  const value = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return "#1F2933";
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  return whiteContrast >= 4.5 ? "#FFFFFF" : "#1F2933";
}

export function BrandingSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const { loading: billingLoading, hasFeature } = useTenantBilling();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [primary, setPrimary] = useState("#6E3B5D");
  const [secondary, setSecondary] = useState("#E9D7E2");
  const [accent, setAccent] = useState("#7FAE9B");
  const [logoUrl, setLogoUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    supabase
      .from("tenant_settings")
      .select("brand_primary, brand_secondary, brand_accent, logo_url, whatsapp_phone")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrimary(data.brand_primary ?? "#6E3B5D");
          setSecondary(data.brand_secondary ?? "#E9D7E2");
          setAccent(data.brand_accent ?? "#7FAE9B");
          setLogoUrl(data.logo_url ?? "");
          setWhatsapp(data.whatsapp_phone ?? "");
        }
        setLoading(false);
      });
  }, [tenantId]);

  const onSave = async () => {
    if (!currentTenant) return;
    setSaving(true);
    const { error } = await supabase.from("tenant_settings").upsert({
      tenant_id: currentTenant.id,
      brand_primary: primary,
      brand_secondary: secondary,
      brand_accent: accent,
      logo_url: logoUrl || null,
      whatsapp_phone: whatsapp || null,
    });
    setSaving(false);
    if (error) { toast.error("Não foi possível salvar", { description: error.message }); return; }
    toast.success("Branding atualizado");
  };

  if (!currentTenant) return null;
  if (billingLoading || loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (!hasFeature("custom_logo")) {
    return (
      <PlanLockedNotice
        title="Branding personalizado e Logo disponível em planos superiores"
        description="O plano Apoio (Gratuito) permite apenas o uso do nome do seu negócio. Faça upgrade para o plano Empreendedor para enviar sua logo e personalizar as cores do seu portal."
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="surface-card p-5 md:p-6 space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { v: primary, set: setPrimary, l: "Primária" },
            { v: secondary, set: setSecondary, l: "Secundária" },
            { v: accent, set: setAccent, l: "Acento" },
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
          <Label>Logo do estabelecimento</Label>
          <LogoUploader
            folder={currentTenant.id}
            value={logoUrl || null}
            onChange={async (url) => {
              setLogoUrl(url ?? "");
              // persiste imediatamente para refletir em Header/Portal sem precisar clicar em Salvar.
              await supabase
                .from("tenant_settings")
                .upsert({ tenant_id: currentTenant.id, logo_url: url ?? null });
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>WhatsApp do negócio</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(11) 99999-0000" className="h-11 rounded-xl" />
          <p className="text-xs text-muted-foreground">Usado para gerar mensagens e abrir conversas manualmente. Nenhum envio automático.</p>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={saving} className="h-11 rounded-xl bg-gradient-brand">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Save className="mr-2 h-4 w-4" /> Salvar</>)}
          </Button>
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pré-visualização</p>
          <h3 className="mt-1 font-display text-lg">Sua marca</h3>
        </div>
        <div className="px-5 pb-5 space-y-3">
          <div className="rounded-2xl p-5 shadow-md" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)`, color: readableTextColor(primary) }}>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logo ${currentTenant.name}`}
                  className="h-10 w-10 rounded-lg bg-white/20 object-contain p-1"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-xs font-medium">Cativa</p>
                <p className="mt-0.5 font-display text-xl truncate">{currentTenant.name}</p>
              </div>
            </div>
            <button className="mt-4 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: accent, color: readableTextColor(accent) }}>
              Botão de ação
            </button>
          </div>
          <div className="rounded-xl p-4" style={{ background: secondary, color: readableTextColor(secondary) }}>
            <p className="text-sm font-medium">Cartão secundário</p>
            <p className="text-xs">Texto em superfície clara da marca</p>
          </div>
        </div>
      </div>
    </div>
  );
}
