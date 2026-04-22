import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  Boxes,
  Crown,
  FileStack,
  Loader2,
  PackageOpen,
  Pencil,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  createMembership,
  createPackage,
  createProtocol,
  deleteMembership,
  deletePackage,
  deleteProtocol,
  listMembershipBenefits,
  listMemberships,
  listPackageItems,
  listPackages,
  listProtocols,
  listProtocolSessions,
  listServices,
  updateMembership,
  updatePackage,
  updateProtocol,
  type CreateMembershipInput,
  type CreatePackageInput,
  type CreateProtocolInput,
} from "@/repositories/catalog";
import {
  billingCycleLabels,
  formatPrice,
  packageKindLabels,
  type Membership,
  type MembershipBenefit,
  type MembershipBillingCycle,
  type Package,
  type PackageItem,
  type PackageKind,
  type Protocol,
  type ProtocolSession,
  type Service,
} from "@/domain/catalog";

type PackageFormState = {
  name: string;
  kind: PackageKind;
  description: string;
  price: string;
  validityDays: string;
  recommendedIntervalDays: string;
  usageRules: string;
  notes: string;
  isActive: boolean;
};

type MembershipFormState = {
  name: string;
  description: string;
  price: string;
  billingCycle: MembershipBillingCycle;
  notes: string;
  isActive: boolean;
};

type ProtocolFormState = {
  name: string;
  description: string;
  totalSessions: string;
  recommendedIntervalDays: string;
  totalPrice: string;
  preInstructions: string;
  postInstructions: string;
  isActive: boolean;
};

type PackageLine = {
  serviceId: string;
  sessions: string;
};

type MembershipLine = {
  serviceId: string;
  sessionsPerCycle: string;
  discountPct: string;
};

type ProtocolLine = {
  serviceId: string;
  intervalDays: string;
  notes: string;
};

const EMPTY_PACKAGE_FORM: PackageFormState = {
  name: "",
  kind: "package",
  description: "",
  price: "",
  validityDays: "",
  recommendedIntervalDays: "",
  usageRules: "",
  notes: "",
  isActive: true,
};

const EMPTY_MEMBERSHIP_FORM: MembershipFormState = {
  name: "",
  description: "",
  price: "",
  billingCycle: "monthly",
  notes: "",
  isActive: true,
};

const EMPTY_PROTOCOL_FORM: ProtocolFormState = {
  name: "",
  description: "",
  totalSessions: "",
  recommendedIntervalDays: "",
  totalPrice: "",
  preInstructions: "",
  postInstructions: "",
  isActive: true,
};

export default function PackagesPage() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);

  const [services, setServices] = useState<Service[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [protocols, setProtocols] = useState<Protocol[]>([]);

  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null);

  const [packageForm, setPackageForm] = useState<PackageFormState>(EMPTY_PACKAGE_FORM);
  const [packageItems, setPackageItems] = useState<PackageLine[]>([]);
  const [savingPackage, setSavingPackage] = useState(false);

  const [membershipForm, setMembershipForm] = useState<MembershipFormState>(EMPTY_MEMBERSHIP_FORM);
  const [membershipBenefits, setMembershipBenefits] = useState<MembershipLine[]>([]);
  const [savingMembership, setSavingMembership] = useState(false);

  const [protocolForm, setProtocolForm] = useState<ProtocolFormState>(EMPTY_PROTOCOL_FORM);
  const [protocolSteps, setProtocolSteps] = useState<ProtocolLine[]>([]);
  const [savingProtocol, setSavingProtocol] = useState(false);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) ?? null,
    [packages, selectedPackageId],
  );
  const selectedMembership = useMemo(
    () => memberships.find((item) => item.id === selectedMembershipId) ?? null,
    [memberships, selectedMembershipId],
  );
  const selectedProtocol = useMemo(
    () => protocols.find((item) => item.id === selectedProtocolId) ?? null,
    [protocols, selectedProtocolId],
  );

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        const [nextServices, nextPackages, nextMemberships, nextProtocols] = await Promise.all([
          listServices({ tenantId: currentTenant.id, activeOnly: true }),
          listPackages(currentTenant.id),
          listMemberships(currentTenant.id),
          listProtocols(currentTenant.id),
        ]);
        if (ignore) return;
        setServices(nextServices);
        setPackages(nextPackages);
        setMemberships(nextMemberships);
        setProtocols(nextProtocols);
        setSelectedPackageId((prev) => {
          if (prev && nextPackages.some((item) => item.id === prev)) return prev;
          return nextPackages[0]?.id ?? null;
        });
        setSelectedMembershipId((prev) => {
          if (prev && nextMemberships.some((item) => item.id === prev)) return prev;
          return nextMemberships[0]?.id ?? null;
        });
        setSelectedProtocolId((prev) => {
          if (prev && nextProtocols.some((item) => item.id === prev)) return prev;
          return nextProtocols[0]?.id ?? null;
        });
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao carregar pacotes e planos",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, refreshToken, toast]);

  useEffect(() => {
    if (!selectedPackage) {
      setPackageForm(EMPTY_PACKAGE_FORM);
      setPackageItems([]);
      return;
    }
    setPackageForm(packageToForm(selectedPackage));
    void (async () => {
      try {
        const items = await listPackageItems(selectedPackage.id);
        setPackageItems(items.map(packageItemToForm));
      } catch (error) {
        toast({
          title: "Erro ao carregar itens do pacote",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      }
    })();
  }, [selectedPackage, toast]);

  useEffect(() => {
    if (!selectedMembership) {
      setMembershipForm(EMPTY_MEMBERSHIP_FORM);
      setMembershipBenefits([]);
      return;
    }
    setMembershipForm(membershipToForm(selectedMembership));
    void (async () => {
      try {
        const benefits = await listMembershipBenefits(selectedMembership.id);
        setMembershipBenefits(benefits.map(membershipBenefitToForm));
      } catch (error) {
        toast({
          title: "Erro ao carregar benefícios",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      }
    })();
  }, [selectedMembership, toast]);

  useEffect(() => {
    if (!selectedProtocol) {
      setProtocolForm(EMPTY_PROTOCOL_FORM);
      setProtocolSteps([]);
      return;
    }
    setProtocolForm(protocolToForm(selectedProtocol));
    void (async () => {
      try {
        const steps = await listProtocolSessions(selectedProtocol.id);
        setProtocolSteps(steps.map(protocolSessionToForm));
      } catch (error) {
        toast({
          title: "Erro ao carregar sessões do protocolo",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      }
    })();
  }, [selectedProtocol, toast]);

  async function refreshData() {
    setRefreshToken((current) => current + 1);
  }

  async function handleSavePackage() {
    if (!currentTenant || !packageForm.name.trim()) return;
    setSavingPackage(true);
    try {
      const payload = packageFormToPayload(packageForm, currentTenant.id, packageItems);
      if (selectedPackage) {
        await updatePackage(selectedPackage.id, payload);
        toast({ title: "Pacote atualizado" });
      } else {
        const created = await createPackage(payload as CreatePackageInput);
        setSelectedPackageId(created.id);
        toast({ title: "Pacote criado" });
      }
      await refreshData();
    } catch (error) {
      toast({
        title: "Falha ao salvar pacote",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingPackage(false);
    }
  }

  async function handleDeletePackage() {
    if (!selectedPackage) return;
    setSavingPackage(true);
    try {
      await deletePackage(selectedPackage.id);
      toast({ title: "Pacote removido" });
      setSelectedPackageId(null);
      await refreshData();
    } catch (error) {
      toast({
        title: "Falha ao remover pacote",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingPackage(false);
    }
  }

  async function handleSaveMembership() {
    if (!currentTenant || !membershipForm.name.trim()) return;
    setSavingMembership(true);
    try {
      const payload = membershipFormToPayload(membershipForm, currentTenant.id, membershipBenefits);
      if (selectedMembership) {
        await updateMembership(selectedMembership.id, payload);
        toast({ title: "Membership atualizado" });
      } else {
        const created = await createMembership(payload as CreateMembershipInput);
        setSelectedMembershipId(created.id);
        toast({ title: "Membership criado" });
      }
      await refreshData();
    } catch (error) {
      toast({
        title: "Falha ao salvar membership",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingMembership(false);
    }
  }

  async function handleDeleteMembership() {
    if (!selectedMembership) return;
    setSavingMembership(true);
    try {
      await deleteMembership(selectedMembership.id);
      toast({ title: "Membership removido" });
      setSelectedMembershipId(null);
      await refreshData();
    } catch (error) {
      toast({
        title: "Falha ao remover membership",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingMembership(false);
    }
  }

  async function handleSaveProtocol() {
    if (!currentTenant || !protocolForm.name.trim()) return;
    setSavingProtocol(true);
    try {
      const payload = protocolFormToPayload(protocolForm, currentTenant.id, protocolSteps);
      if (selectedProtocol) {
        await updateProtocol(selectedProtocol.id, payload);
        toast({ title: "Protocolo atualizado" });
      } else {
        const created = await createProtocol(payload as CreateProtocolInput);
        setSelectedProtocolId(created.id);
        toast({ title: "Protocolo criado" });
      }
      await refreshData();
    } catch (error) {
      toast({
        title: "Falha ao salvar protocolo",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingProtocol(false);
    }
  }

  async function handleDeleteProtocol() {
    if (!selectedProtocol) return;
    setSavingProtocol(true);
    try {
      await deleteProtocol(selectedProtocol.id);
      toast({ title: "Protocolo removido" });
      setSelectedProtocolId(null);
      await refreshData();
    } catch (error) {
      toast({
        title: "Falha ao remover protocolo",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingProtocol(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pacotes, Memberships e Protocolos"
        description="Monte ofertas recorrentes, combos terapêuticos e jornadas clínicas usando o mesmo catálogo de serviços."
        icon={<PackageOpen className="h-5 w-5" />}
        actions={
          <Button data-testid="packages-refresh" variant="outline" onClick={() => void refreshData()}>
            <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Pacotes" value={String(packages.length)} helper="Combos e ofertas fechadas" />
        <MetricCard label="Memberships" value={String(memberships.length)} helper="Receita recorrente por ciclo" />
        <MetricCard label="Protocolos" value={String(protocols.length)} helper="Jornadas clínicas e sequenciais" />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <Tabs defaultValue="packages" className="space-y-6">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
            <TabsTrigger value="packages" className="rounded-full border border-border bg-card px-3 py-1.5">Pacotes</TabsTrigger>
            <TabsTrigger value="memberships" className="rounded-full border border-border bg-card px-3 py-1.5">Memberships</TabsTrigger>
            <TabsTrigger value="protocols" className="rounded-full border border-border bg-card px-3 py-1.5">Protocolos</TabsTrigger>
          </TabsList>

          <TabsContent value="packages">
            <CatalogSplitLayout
              sidebarTitle="Pacotes"
              sidebarDescription="Venda fechada com sessões, validade e regras claras."
              icon={<Boxes className="h-5 w-5" />}
              items={packages.map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${packageKindLabels[item.kind]} · ${formatPrice(item.priceCents)}`,
                active: item.isActive,
              }))}
              selectedId={selectedPackageId}
              onSelect={setSelectedPackageId}
              onCreate={() => {
                setSelectedPackageId(null);
                setPackageForm(EMPTY_PACKAGE_FORM);
                setPackageItems([]);
              }}
              emptyTitle="Nenhum pacote cadastrado"
              editor={(
                <CatalogEditorCard
                  title={selectedPackage ? selectedPackage.name : "Novo pacote"}
                  description="Defina valor, validade e quais serviços entram na oferta."
                  status={selectedPackage ? (selectedPackage.isActive ? "ativo" : "inativo") : null}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome" required>
                      <Input value={packageForm.name} onChange={(event) => setPackageForm((current) => ({ ...current, name: event.target.value }))} />
                    </Field>
                    <Field label="Tipo">
                      <Select value={packageForm.kind} onValueChange={(value) => setPackageForm((current) => ({ ...current, kind: value as PackageKind }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="package">Pacote</SelectItem>
                          <SelectItem value="combo">Combo</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Preço total (R$)">
                      <Input type="number" step="0.01" value={packageForm.price} onChange={(event) => setPackageForm((current) => ({ ...current, price: event.target.value }))} />
                    </Field>
                    <Field label="Validade (dias)">
                      <Input type="number" value={packageForm.validityDays} onChange={(event) => setPackageForm((current) => ({ ...current, validityDays: event.target.value }))} />
                    </Field>
                    <Field label="Intervalo recomendado (dias)">
                      <Input type="number" value={packageForm.recommendedIntervalDays} onChange={(event) => setPackageForm((current) => ({ ...current, recommendedIntervalDays: event.target.value }))} />
                    </Field>
                    <ToggleField
                      label="Ativo"
                      description="Pacotes inativos deixam de ser oferecidos."
                      checked={packageForm.isActive}
                      onCheckedChange={(checked) => setPackageForm((current) => ({ ...current, isActive: checked }))}
                    />
                  </div>

                  <Field label="Descrição">
                    <Textarea value={packageForm.description} onChange={(event) => setPackageForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
                  </Field>
                  <Field label="Regras de uso">
                    <Textarea value={packageForm.usageRules} onChange={(event) => setPackageForm((current) => ({ ...current, usageRules: event.target.value }))} rows={3} />
                  </Field>
                  <Field label="Notas internas">
                    <Textarea value={packageForm.notes} onChange={(event) => setPackageForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
                  </Field>

                  <LineEditorSection
                    title="Itens do pacote"
                    description="Escolha serviços elegíveis e quantas sessões cada um inclui."
                    actionLabel="Adicionar item"
                    onAdd={() => setPackageItems((current) => [...current, { serviceId: "none", sessions: "1" }])}
                  >
                    {packageItems.length === 0 ? (
                      <EmptyState title="Sem itens" description="Adicione pelo menos um serviço ao pacote." />
                    ) : (
                      packageItems.map((item, index) => (
                        <div key={`package-${index}`} className="grid gap-3 rounded-2xl border border-border/70 p-3 md:grid-cols-[1.4fr_1fr_auto]">
                          <Field label="Serviço">
                            <Select value={item.serviceId} onValueChange={(value) => updateLine(setPackageItems, index, "serviceId", value)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Selecione</SelectItem>
                                {services.map((service) => (
                                  <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Sessões">
                            <Input type="number" value={item.sessions} onChange={(event) => updateLine(setPackageItems, index, "sessions", event.target.value)} />
                          </Field>
                          <div className="flex items-end">
                            <Button variant="ghost" onClick={() => setPackageItems((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </LineEditorSection>

                  <EditorActions
                    saving={savingPackage}
                    saveLabel="Salvar pacote"
                    onSave={() => void handleSavePackage()}
                    onDelete={selectedPackage ? () => void handleDeletePackage() : undefined}
                  />
                </CatalogEditorCard>
              )}
            />
          </TabsContent>

          <TabsContent value="memberships">
            <CatalogSplitLayout
              sidebarTitle="Memberships"
              sidebarDescription="Planos recorrentes com sessões por ciclo e descontos."
              icon={<Crown className="h-5 w-5" />}
              items={memberships.map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${billingCycleLabels[item.billingCycle]} · ${formatPrice(item.priceCents)}`,
                active: item.isActive,
              }))}
              selectedId={selectedMembershipId}
              onSelect={setSelectedMembershipId}
              onCreate={() => {
                setSelectedMembershipId(null);
                setMembershipForm(EMPTY_MEMBERSHIP_FORM);
                setMembershipBenefits([]);
              }}
              emptyTitle="Nenhum membership cadastrado"
              editor={(
                <CatalogEditorCard
                  title={selectedMembership ? selectedMembership.name : "Novo membership"}
                  description="Defina cobrança recorrente e benefícios por serviço."
                  status={selectedMembership ? (selectedMembership.isActive ? "ativo" : "inativo") : null}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome" required>
                      <Input value={membershipForm.name} onChange={(event) => setMembershipForm((current) => ({ ...current, name: event.target.value }))} />
                    </Field>
                    <Field label="Ciclo de cobrança">
                      <Select value={membershipForm.billingCycle} onValueChange={(value) => setMembershipForm((current) => ({ ...current, billingCycle: value as MembershipBillingCycle }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Preço por ciclo (R$)">
                      <Input type="number" step="0.01" value={membershipForm.price} onChange={(event) => setMembershipForm((current) => ({ ...current, price: event.target.value }))} />
                    </Field>
                    <ToggleField
                      label="Ativo"
                      description="Memberships inativos deixam de ser vendidos."
                      checked={membershipForm.isActive}
                      onCheckedChange={(checked) => setMembershipForm((current) => ({ ...current, isActive: checked }))}
                    />
                  </div>

                  <Field label="Descrição">
                    <Textarea value={membershipForm.description} onChange={(event) => setMembershipForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
                  </Field>
                  <Field label="Notas internas">
                    <Textarea value={membershipForm.notes} onChange={(event) => setMembershipForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
                  </Field>

                  <LineEditorSection
                    title="Benefícios por ciclo"
                    description="Informe sessões incluídas e descontos extras por serviço."
                    actionLabel="Adicionar benefício"
                    onAdd={() => setMembershipBenefits((current) => [...current, { serviceId: "none", sessionsPerCycle: "1", discountPct: "0" }])}
                  >
                    {membershipBenefits.length === 0 ? (
                      <EmptyState title="Sem benefícios" description="Adicione ao menos um benefício por ciclo." />
                    ) : (
                      membershipBenefits.map((benefit, index) => (
                        <div key={`membership-${index}`} className="grid gap-3 rounded-2xl border border-border/70 p-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                          <Field label="Serviço">
                            <Select value={benefit.serviceId} onValueChange={(value) => updateLine(setMembershipBenefits, index, "serviceId", value)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Selecione</SelectItem>
                                {services.map((service) => (
                                  <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Sessões/ciclo">
                            <Input type="number" value={benefit.sessionsPerCycle} onChange={(event) => updateLine(setMembershipBenefits, index, "sessionsPerCycle", event.target.value)} />
                          </Field>
                          <Field label="Desconto (%)">
                            <Input type="number" value={benefit.discountPct} onChange={(event) => updateLine(setMembershipBenefits, index, "discountPct", event.target.value)} />
                          </Field>
                          <div className="flex items-end">
                            <Button variant="ghost" onClick={() => setMembershipBenefits((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </LineEditorSection>

                  <EditorActions
                    saving={savingMembership}
                    saveLabel="Salvar membership"
                    onSave={() => void handleSaveMembership()}
                    onDelete={selectedMembership ? () => void handleDeleteMembership() : undefined}
                  />
                </CatalogEditorCard>
              )}
            />
          </TabsContent>

          <TabsContent value="protocols">
            <CatalogSplitLayout
              sidebarTitle="Protocolos"
              sidebarDescription="Estruture jornadas com etapas, intervalo ideal e instruções clínicas."
              icon={<FileStack className="h-5 w-5" />}
              items={protocols.map((item) => ({
                id: item.id,
                title: item.name,
                subtitle: `${item.totalSessions} sessões${item.totalPriceCents ? ` · ${formatPrice(item.totalPriceCents)}` : ""}`,
                active: item.isActive,
              }))}
              selectedId={selectedProtocolId}
              onSelect={setSelectedProtocolId}
              onCreate={() => {
                setSelectedProtocolId(null);
                setProtocolForm(EMPTY_PROTOCOL_FORM);
                setProtocolSteps([]);
              }}
              emptyTitle="Nenhum protocolo cadastrado"
              editor={(
                <CatalogEditorCard
                  title={selectedProtocol ? selectedProtocol.name : "Novo protocolo"}
                  description="Defina a sequência clínica e suas instruções de execução."
                  status={selectedProtocol ? (selectedProtocol.isActive ? "ativo" : "inativo") : null}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome" required>
                      <Input value={protocolForm.name} onChange={(event) => setProtocolForm((current) => ({ ...current, name: event.target.value }))} />
                    </Field>
                    <Field label="Sessões totais">
                      <Input type="number" value={protocolForm.totalSessions} onChange={(event) => setProtocolForm((current) => ({ ...current, totalSessions: event.target.value }))} />
                    </Field>
                    <Field label="Intervalo recomendado (dias)">
                      <Input type="number" value={protocolForm.recommendedIntervalDays} onChange={(event) => setProtocolForm((current) => ({ ...current, recommendedIntervalDays: event.target.value }))} />
                    </Field>
                    <Field label="Preço total (R$)">
                      <Input type="number" step="0.01" value={protocolForm.totalPrice} onChange={(event) => setProtocolForm((current) => ({ ...current, totalPrice: event.target.value }))} />
                    </Field>
                    <ToggleField
                      label="Ativo"
                      description="Protocolos inativos deixam de ser oferecidos."
                      checked={protocolForm.isActive}
                      onCheckedChange={(checked) => setProtocolForm((current) => ({ ...current, isActive: checked }))}
                    />
                  </div>

                  <Field label="Descrição">
                    <Textarea value={protocolForm.description} onChange={(event) => setProtocolForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
                  </Field>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Instruções pré">
                      <Textarea value={protocolForm.preInstructions} onChange={(event) => setProtocolForm((current) => ({ ...current, preInstructions: event.target.value }))} rows={3} />
                    </Field>
                    <Field label="Instruções pós">
                      <Textarea value={protocolForm.postInstructions} onChange={(event) => setProtocolForm((current) => ({ ...current, postInstructions: event.target.value }))} rows={3} />
                    </Field>
                  </div>

                  <LineEditorSection
                    title="Sessões do protocolo"
                    description="Defina a ordem das etapas usando o catálogo de serviços."
                    actionLabel="Adicionar sessão"
                    onAdd={() => setProtocolSteps((current) => [...current, { serviceId: "none", intervalDays: "", notes: "" }])}
                  >
                    {protocolSteps.length === 0 ? (
                      <EmptyState title="Sem sessões" description="Adicione as etapas do protocolo." />
                    ) : (
                      protocolSteps.map((step, index) => (
                        <div key={`protocol-${index}`} className="grid gap-3 rounded-2xl border border-border/70 p-3 md:grid-cols-[1.4fr_1fr_1.2fr_auto]">
                          <Field label={`Sessão ${index + 1}`}>
                            <Select value={step.serviceId} onValueChange={(value) => updateLine(setProtocolSteps, index, "serviceId", value)}>
                              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Selecione</SelectItem>
                                {services.map((service) => (
                                  <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field label="Intervalo (dias)">
                            <Input type="number" value={step.intervalDays} onChange={(event) => updateLine(setProtocolSteps, index, "intervalDays", event.target.value)} />
                          </Field>
                          <Field label="Notas">
                            <Input value={step.notes} onChange={(event) => updateLine(setProtocolSteps, index, "notes", event.target.value)} />
                          </Field>
                          <div className="flex items-end">
                            <Button variant="ghost" onClick={() => setProtocolSteps((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </LineEditorSection>

                  <EditorActions
                    saving={savingProtocol}
                    saveLabel="Salvar protocolo"
                    onSave={() => void handleSaveProtocol()}
                    onDelete={selectedProtocol ? () => void handleDeleteProtocol() : undefined}
                  />
                </CatalogEditorCard>
              )}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CatalogSplitLayout({
  sidebarTitle,
  sidebarDescription,
  icon,
  items,
  selectedId,
  onSelect,
  onCreate,
  emptyTitle,
  editor,
}: {
  sidebarTitle: string;
  sidebarDescription: string;
  icon: ReactNode;
  items: Array<{ id: string; title: string; subtitle: string; active: boolean }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  emptyTitle: string;
  editor: ReactNode;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">{icon}</span>
            <div>
              <CardTitle className="text-base">{sidebarTitle}</CardTitle>
              <CardDescription>{sidebarDescription}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" /> Novo
          </Button>
          <Separator />
          {items.length === 0 ? (
            <EmptyState title={emptyTitle} description="Cadastre um novo item para começar." />
          ) : (
            items.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${selectedId === item.id ? "border-primary bg-primary-soft/40" : "border-border/70 hover:border-primary/40"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <StatusBadge tone={item.active ? "success" : "neutral"}>
                    {item.active ? "ativo" : "inativo"}
                  </StatusBadge>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {editor}
    </div>
  );
}

function CatalogEditorCard({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description: string;
  status: string | null;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="border-b border-border/70 bg-gradient-soft">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">{description}</CardDescription>
          </div>
          {status ? <StatusBadge tone={status === "ativo" ? "success" : "neutral"}>{status}</StatusBadge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">{children}</CardContent>
    </Card>
  );
}

function LineEditorSection({
  title,
  description,
  actionLabel,
  onAdd,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" /> {actionLabel}
        </Button>
      </div>
      {children}
    </div>
  );
}

function EditorActions({
  saving,
  saveLabel,
  onSave,
  onDelete,
}: {
  saving: boolean;
  saveLabel: string;
  onSave: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
        {saveLabel}
      </Button>
      {onDelete ? (
        <Button variant="ghost" onClick={onDelete} disabled={saving}>
          <Trash2 className="mr-2 h-4 w-4" /> Remover
        </Button>
      ) : null}
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function updateLine<T extends object>(
  setter: Dispatch<SetStateAction<T[]>>,
  index: number,
  field: keyof T,
  value: string,
) {
  setter((current) => current.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    return { ...item, [field]: value } as T;
  }));
}

function packageToForm(item: Package): PackageFormState {
  return {
    name: item.name,
    kind: item.kind,
    description: item.description ?? "",
    price: centsToAmount(item.priceCents),
    validityDays: item.validityDays == null ? "" : String(item.validityDays),
    recommendedIntervalDays: item.recommendedIntervalDays == null ? "" : String(item.recommendedIntervalDays),
    usageRules: item.usageRules ?? "",
    notes: item.notes ?? "",
    isActive: item.isActive,
  };
}

function packageItemToForm(item: PackageItem): PackageLine {
  return {
    serviceId: item.serviceId,
    sessions: String(item.sessions),
  };
}

function membershipToForm(item: Membership): MembershipFormState {
  return {
    name: item.name,
    description: item.description ?? "",
    price: centsToAmount(item.priceCents),
    billingCycle: item.billingCycle,
    notes: item.notes ?? "",
    isActive: item.isActive,
  };
}

function membershipBenefitToForm(item: MembershipBenefit): MembershipLine {
  return {
    serviceId: item.serviceId,
    sessionsPerCycle: String(item.sessionsPerCycle),
    discountPct: String(item.discountPct),
  };
}

function protocolToForm(item: Protocol): ProtocolFormState {
  return {
    name: item.name,
    description: item.description ?? "",
    totalSessions: String(item.totalSessions),
    recommendedIntervalDays: item.recommendedIntervalDays == null ? "" : String(item.recommendedIntervalDays),
    totalPrice: item.totalPriceCents == null ? "" : centsToAmount(item.totalPriceCents),
    preInstructions: item.preInstructions ?? "",
    postInstructions: item.postInstructions ?? "",
    isActive: item.isActive,
  };
}

function protocolSessionToForm(item: ProtocolSession): ProtocolLine {
  return {
    serviceId: item.serviceId,
    intervalDays: item.intervalDays == null ? "" : String(item.intervalDays),
    notes: item.notes ?? "",
  };
}

function packageFormToPayload(form: PackageFormState, tenantId: string, items: PackageLine[]) {
  return {
    tenantId,
    name: form.name.trim(),
    kind: form.kind,
    description: emptyToUndefined(form.description),
    priceCents: form.price.trim() ? amountToCents(form.price) : 0,
    validityDays: parseOptionalNumber(form.validityDays),
    recommendedIntervalDays: parseOptionalNumber(form.recommendedIntervalDays),
    usageRules: emptyToUndefined(form.usageRules),
    notes: emptyToUndefined(form.notes),
    isActive: form.isActive,
    items: items
      .filter((item) => item.serviceId !== "none")
      .map((item) => ({
        serviceId: item.serviceId,
        sessions: parseInt(item.sessions || "0", 10) || 0,
      })),
  };
}

function membershipFormToPayload(form: MembershipFormState, tenantId: string, benefits: MembershipLine[]) {
  return {
    tenantId,
    name: form.name.trim(),
    description: emptyToUndefined(form.description),
    priceCents: form.price.trim() ? amountToCents(form.price) : 0,
    billingCycle: form.billingCycle,
    notes: emptyToUndefined(form.notes),
    isActive: form.isActive,
    benefits: benefits
      .filter((item) => item.serviceId !== "none")
      .map((item) => ({
        serviceId: item.serviceId,
        sessionsPerCycle: parseInt(item.sessionsPerCycle || "0", 10) || 0,
        discountPct: parseInt(item.discountPct || "0", 10) || 0,
      })),
  };
}

function protocolFormToPayload(form: ProtocolFormState, tenantId: string, steps: ProtocolLine[]) {
  return {
    tenantId,
    name: form.name.trim(),
    description: emptyToUndefined(form.description),
    totalSessions: parseOptionalNumber(form.totalSessions) ?? steps.filter((step) => step.serviceId !== "none").length,
    recommendedIntervalDays: parseOptionalNumber(form.recommendedIntervalDays),
    totalPriceCents: form.totalPrice.trim() ? amountToCents(form.totalPrice) : null,
    preInstructions: emptyToUndefined(form.preInstructions),
    postInstructions: emptyToUndefined(form.postInstructions),
    isActive: form.isActive,
    steps: steps
      .filter((item) => item.serviceId !== "none")
      .map((item) => ({
        serviceId: item.serviceId,
        intervalDays: parseOptionalNumber(item.intervalDays),
        notes: emptyToUndefined(item.notes),
      })),
  };
}

function amountToCents(value: string) {
  return Math.round(Number(value || "0") * 100);
}

function centsToAmount(value: number) {
  return (value / 100).toFixed(2);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
