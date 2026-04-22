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

export function BrandingSettings() {
  const { currentTenant } = useTenant();
  const { loading: billingLoading, hasFeature } = useTenantBilling();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [primary, setPrimary] = useState("#6E3B5D");
  const [secondary, setSecondary] = useState("#E9D7E2");
  const [accent, setAccent] = useState("#7FAE9B");
  const [logoUrl, setLogoUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    if (!currentTenant) return;
    setLoading(true);
    supabase
      .from("tenant_settings")
      .select("brand_primary, brand_secondary, brand_accent, logo_url, whatsapp_phone")
      .eq("tenant_id", currentTenant.id)
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
  }, [currentTenant?.id]);

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
  if (!hasFeature("custom_branding")) {
    return (
      <PlanLockedNotice
        title="Branding personalizado disponível em planos superiores"
        description="Faça upgrade para personalizar cores, logo e identidade visual do seu portal e mensagens."
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
          <p className="text-[11px] text-muted-foreground">Usado para gerar mensagens e abrir conversas manualmente. Nenhum envio automático.</p>
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
          <div className="rounded-2xl p-5 text-white shadow-md" style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)` }}>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Logo ${currentTenant.name}`}
                  className="h-10 w-10 rounded-lg bg-white/20 object-contain p-1"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-xs opacity-80">Cativa</p>
                <p className="mt-0.5 font-display text-xl truncate">{currentTenant.name}</p>
              </div>
            </div>
            <button className="mt-4 rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: accent, color: "#fff" }}>
              Botão de ação
            </button>
          </div>
          <div className="rounded-xl p-4" style={{ background: secondary, color: primary }}>
            <p className="text-sm font-medium">Cartão secundário</p>
            <p className="text-xs opacity-80">Texto em superfície clara da marca</p>
          </div>
        </div>
      </div>
    </div>
  );
}
