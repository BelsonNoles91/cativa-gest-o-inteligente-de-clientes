/**
 * PublicPageSettings — administração do link único de divulgação (/e/:slug).
 * Owner e manager publicam a página, editam a apresentação e escolhem quais
 * unidades e serviços aparecem publicamente.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/features/tenant/TenantProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PublicLinkShareCard } from "@/features/settings/PublicLinkShareCard";
import { Textarea } from "@/components/ui/textarea";
import {
  getTenantPublicPageSettings,
  listServicesVisibility,
  listUnitsVisibility,
  saveTenantPublicPageSettings,
  setServiceVisibility,
  setUnitVisibility,
  type PublicVisibilityItem,
} from "@/repositories/public-page";

export function PublicPageSettings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const slug = currentTenant?.slug ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [website, setWebsite] = useState("");
  const [units, setUnits] = useState<PublicVisibilityItem[]>([]);
  const [services, setServices] = useState<PublicVisibilityItem[]>([]);

  const link = useMemo(
    () => `${typeof window !== "undefined" ? window.location.origin : ""}/e/${slug}`,
    [slug],
  );

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      getTenantPublicPageSettings(tenantId),
      listUnitsVisibility(tenantId),
      listServicesVisibility(tenantId),
    ])
      .then(([page, u, s]) => {
        if (!alive) return;
        if (page) {
          setPublished(page.isPublished);
          setHeadline(page.headline ?? "");
          setAbout(page.about ?? "");
          setCoverUrl(page.coverUrl ?? "");
          setWhatsapp(page.whatsapp ?? "");
          setInstagram(page.instagram ?? "");
          setWebsite(page.website ?? "");
        }
        setUnits(u);
        setServices(s);
      })
      .catch((error: unknown) => {
        toast.error("Não foi possível carregar a página pública", {
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tenantId]);

  const save = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      await saveTenantPublicPageSettings(tenantId, {
        isPublished: published,
        headline: headline.trim() || null,
        about: about.trim() || null,
        coverUrl: coverUrl.trim() || null,
        whatsapp: whatsapp.trim() || null,
        instagram: instagram.trim() || null,
        website: website.trim() || null,
      });
      toast.success(published ? "Página pública publicada" : "Alterações salvas");
    } catch (error) {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleUnit = async (item: PublicVisibilityItem, value: boolean) => {
    setUnits((prev) => prev.map((u) => (u.id === item.id ? { ...u, isPublic: value } : u)));
    try {
      await setUnitVisibility(item.id, value);
    } catch {
      setUnits((prev) => prev.map((u) => (u.id === item.id ? { ...u, isPublic: !value } : u)));
      toast.error("Não foi possível atualizar a unidade");
    }
  };

  const toggleService = async (item: PublicVisibilityItem, value: boolean) => {
    setServices((prev) => prev.map((s) => (s.id === item.id ? { ...s, isPublic: value } : s)));
    try {
      await setServiceVisibility(item.id, value);
    } catch {
      setServices((prev) => prev.map((s) => (s.id === item.id ? { ...s, isPublic: !value } : s)));
      toast.error("Não foi possível atualizar o serviço");
    }
  };

  if (!currentTenant) return null;
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PublicLinkShareCard
        link={link}
        slug={slug}
        tenantName={currentTenant?.name ?? "nosso estabelecimento"}
        published={published}
        onPublishedChange={setPublished}
      />

      <Card className="space-y-4 rounded-2xl p-5">
        <h3 className="font-semibold">Apresentação</h3>
        <div className="space-y-2">
          <Label htmlFor="pp-headline">Frase de destaque</Label>
          <Input
            id="pp-headline"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Beleza e cuidado com hora marcada"
            className="rounded-2xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pp-about">Sobre o estabelecimento</Label>
          <Textarea
            id="pp-about"
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            rows={4}
            className="rounded-2xl"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pp-cover">Imagem de capa (URL)</Label>
            <Input id="pp-cover" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="rounded-2xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-whats">WhatsApp</Label>
            <Input
              id="pp-whats"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="5591999999999"
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-insta">Instagram</Label>
            <Input
              id="pp-insta"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@seuestudio"
              className="rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-site">Site</Label>
            <Input id="pp-site" value={website} onChange={(e) => setWebsite(e.target.value)} className="rounded-2xl" />
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="min-h-[48px] rounded-2xl">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="space-y-3 rounded-2xl p-5">
          <h3 className="font-semibold">Unidades visíveis</h3>
          {units.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma unidade ativa.</p>}
          {units.map((u) => (
            <div key={u.id} className="flex min-h-[44px] items-center justify-between gap-3">
              <span className="text-sm">{u.name}</span>
              <Switch
                checked={u.isPublic}
                onCheckedChange={(v) => toggleUnit(u, v)}
                aria-label={`Mostrar ${u.name} na página pública`}
              />
            </div>
          ))}
        </Card>

        <Card className="space-y-3 rounded-2xl p-5">
          <h3 className="font-semibold">Serviços visíveis</h3>
          {services.length === 0 && <p className="text-sm text-muted-foreground">Nenhum serviço ativo.</p>}
          {services.map((s) => (
            <div key={s.id} className="flex min-h-[44px] items-center justify-between gap-3">
              <span className="text-sm">{s.name}</span>
              <Switch
                checked={s.isPublic}
                onCheckedChange={(v) => toggleService(s, v)}
                aria-label={`Mostrar ${s.name} na página pública`}
              />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
