/**
 * Configurações — shell com tabs internas (negócio, unidades, equipe, branding, preferências).
 */
import { useState } from "react";
import { Settings as SettingsIcon, Building2, MapPin, Users, Palette, SlidersHorizontal, Lock } from "lucide-react";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { PageHeader } from "@/components/shell/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BusinessSettings } from "@/features/settings/BusinessSettings";
import { UnitsSettings } from "@/features/settings/UnitsSettings";
import { TeamSettings } from "@/features/settings/TeamSettings";
import { BrandingSettings } from "@/features/settings/BrandingSettings";
import { PreferencesSettings } from "@/features/settings/PreferencesSettings";

const TABS = [
  { v: "business", label: "Negócio", icon: Building2 },
  { v: "units", label: "Unidades", icon: MapPin },
  { v: "team", label: "Equipe", icon: Users },
  { v: "branding", label: "Branding", icon: Palette },
  { v: "prefs", label: "Preferências", icon: SlidersHorizontal },
];

export default function Settings() {
  const { hasFeature } = useTenantBilling();
  const [tab, setTab] = useState("business");
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Personalize seu negócio, equipe e branding."
        icon={<SettingsIcon className="h-5 w-5" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto rounded-xl bg-muted/60 p-1">
            {TABS.map((t) => {
              const isLocked = t.v === "branding" && !hasFeature("custom_logo");
              return (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  data-testid={`settings-tab-${t.v}`}
                  className="gap-2 whitespace-nowrap rounded-lg px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <t.icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{t.label}</span>
                  {isLocked && <Lock className="ml-1 h-3 w-3 text-muted-foreground opacity-60" />}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="business"><BusinessSettings /></TabsContent>
          <TabsContent value="units" data-testid="settings-units-panel"><UnitsSettings /></TabsContent>
          <TabsContent value="team"><TeamSettings /></TabsContent>
          <TabsContent value="branding"><BrandingSettings /></TabsContent>
          <TabsContent value="prefs"><PreferencesSettings /></TabsContent>
        </div>
      </Tabs>
    </>
  );
}
