import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Scissors,
  Tags,
  ShieldBan,
  Clock3,
  Sparkles,
  Pencil,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  createCategory,
  createCancellationPolicy,
  createService,
  deleteCategory,
  deleteCancellationPolicy,
  deleteService,
  listBasePrices,
  listCancellationPolicies,
  listCategories,
  listProfessionalPriceOverrides,
  listServices,
  listUnitPriceOverrides,
  saveProfessionalPriceOverrides,
  saveUnitPriceOverrides,
  updateCategory,
  updateCancellationPolicy,
  updateService,
  type CreateServiceInput,
  type ServiceProfessionalPriceOverride,
  type ServiceUnitPriceOverride,
} from "@/repositories/catalog";
import { listProfessionalsLite, type ProfessionalLite } from "@/repositories/scheduling";
import {
  formatDuration,
  formatPrice,
  totalBlockedMinutes,
  type CancellationPolicy,
  type Service,
  type ServiceCategory,
} from "@/domain/catalog";

type ServiceFormState = {
  name: string;
  description: string;
  internalCode: string;
  categoryId: string;
  cancellationPolicyId: string;
  durationMinutes: string;
  bufferBeforeMinutes: string;
  bufferAfterMinutes: string;
  processingMinutes: string;
  minAdvanceHours: string;
  maxAdvanceDays: string;
  idealReturnWindowDays: string;
  requiresResource: boolean;
  resourceLabel: string;
  eligibleForPackage: boolean;
  eligibleForMembership: boolean;
  preAppointmentInstructions: string;
  postAppointmentInstructions: string;
  isActive: boolean;
  isFeatured: boolean;
  basePrice: string;
};

type CategoryFormState = {
  name: string;
  description: string;
  color: string;
  icon: string;
  parentId: string;
  position: string;
  isActive: boolean;
};

type PolicyFormState = {
  name: string;
  description: string;
  hoursBeforeNoCharge: string;
  lateCancelFeePct: string;
  noShowFeePct: string;
  isDefault: boolean;
};

type PriceOverrideForm = {
  unitId?: string;
  professionalId?: string;
  amount: string;
  durationMinutes: string;
};

const EMPTY_SERVICE_FORM: ServiceFormState = {
  name: "",
  description: "",
  internalCode: "",
  categoryId: "none",
  cancellationPolicyId: "none",
  durationMinutes: "30",
  bufferBeforeMinutes: "0",
  bufferAfterMinutes: "0",
  processingMinutes: "0",
  minAdvanceHours: "0",
  maxAdvanceDays: "60",
  idealReturnWindowDays: "",
  requiresResource: false,
  resourceLabel: "",
  eligibleForPackage: true,
  eligibleForMembership: true,
  preAppointmentInstructions: "",
  postAppointmentInstructions: "",
  isActive: true,
  isFeatured: false,
  basePrice: "",
};

const EMPTY_CATEGORY_FORM: CategoryFormState = {
  name: "",
  description: "",
  color: "#C46A6A",
  icon: "",
  parentId: "none",
  position: "0",
  isActive: true,
};

const EMPTY_POLICY_FORM: PolicyFormState = {
  name: "",
  description: "",
  hoursBeforeNoCharge: "24",
  lateCancelFeePct: "0",
  noShowFeePct: "0",
  isDefault: false,
};

export default function ServicesPage() {
  const [searchParams] = useSearchParams();
  const { currentTenant, availableUnits } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [basePrices, setBasePrices] = useState<Map<string, number>>(new Map());
  const [professionals, setProfessionals] = useState<ProfessionalLite[]>([]);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(EMPTY_SERVICE_FORM);
  const [serviceOverridesUnits, setServiceOverridesUnits] = useState<PriceOverrideForm[]>([]);
  const [serviceOverridesProfessionals, setServiceOverridesProfessionals] = useState<PriceOverrideForm[]>([]);
  const [loadingOverrides, setLoadingOverrides] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
  const [savingCategory, setSavingCategory] = useState(false);

  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CancellationPolicy | null>(null);
  const [policyForm, setPolicyForm] = useState<PolicyFormState>(EMPTY_POLICY_FORM);
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    const nextSearch = searchParams.get("search");
    if (!nextSearch) return;
    setSearch((current) => (current === nextSearch ? current : nextSearch));
  }, [searchParams]);

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const filteredServices = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return services.filter((service) => {
      const matchesSearch =
        !normalized ||
        service.name.toLowerCase().includes(normalized) ||
        service.description?.toLowerCase().includes(normalized) ||
        service.internalCode?.toLowerCase().includes(normalized);
      const matchesCategory = categoryFilter === "all" || service.categoryId === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [services, search, categoryFilter]);

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        const [nextCategories, nextServices, nextPolicies, nextBasePrices, nextProfessionals] = await Promise.all([
          listCategories(currentTenant.id),
          listServices({ tenantId: currentTenant.id }),
          listCancellationPolicies(currentTenant.id),
          listBasePrices(currentTenant.id),
          listProfessionalsLite(currentTenant.id),
        ]);
        if (ignore) return;
        setCategories(nextCategories);
        setServices(nextServices);
        setPolicies(nextPolicies);
        setBasePrices(new Map(Array.from(nextBasePrices.entries()).map(([key, value]) => [key, value.amountCents])));
        setProfessionals(nextProfessionals);
        setSelectedServiceId((prev) => {
          if (prev && nextServices.some((service) => service.id === prev)) return prev;
          return nextServices[0]?.id ?? null;
        });
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao carregar catálogo",
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
    if (!selectedService) {
      setServiceForm(EMPTY_SERVICE_FORM);
      setServiceOverridesUnits([]);
      setServiceOverridesProfessionals([]);
      return;
    }
    setServiceForm(serviceToForm(selectedService, basePrices.get(selectedService.id)));
  }, [selectedService, basePrices]);

  useEffect(() => {
    if (!selectedService) return;
    let ignore = false;
    setLoadingOverrides(true);
    void (async () => {
      try {
        const [unitOverrides, professionalOverrides] = await Promise.all([
          listUnitPriceOverrides(selectedService.id),
          listProfessionalPriceOverrides(selectedService.id),
        ]);
        if (ignore) return;
        setServiceOverridesUnits(unitOverrides.map(unitOverrideToForm));
        setServiceOverridesProfessionals(professionalOverrides.map(professionalOverrideToForm));
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao carregar precificação avançada",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      } finally {
        if (!ignore) setLoadingOverrides(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [selectedService, toast]);

  async function refreshCatalog() {
    setRefreshToken((current) => current + 1);
  }

  async function handleSaveService() {
    if (!currentTenant) return;
    if (!serviceForm.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do serviço.", variant: "destructive" });
      return;
    }
    setSavingService(true);
    try {
      const payload = serviceFormToPayload(serviceForm, currentTenant.id);
      if (selectedService) {
        await updateService(selectedService.id, payload);
        toast({ title: "Serviço atualizado" });
      } else {
        const created = await createService(payload as CreateServiceInput);
        setSelectedServiceId(created.id);
        toast({ title: "Serviço criado" });
      }
      await refreshCatalog();
    } catch (error) {
      toast({
        title: "Falha ao salvar serviço",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingService(false);
    }
  }

  async function handleDeleteService() {
    if (!selectedService) return;
    setSavingService(true);
    try {
      await deleteService(selectedService.id);
      toast({ title: "Serviço removido" });
      setSelectedServiceId(null);
      await refreshCatalog();
    } catch (error) {
      toast({
        title: "Falha ao remover serviço",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingService(false);
    }
  }

  async function handleSavePricing() {
    if (!currentTenant || !selectedService) return;
    setSavingPricing(true);
    try {
      await Promise.all([
        saveUnitPriceOverrides({
          tenantId: currentTenant.id,
          serviceId: selectedService.id,
          overrides: serviceOverridesUnits
            .filter((item) => item.unitId && item.amount.trim())
            .map((item) => ({
              unitId: item.unitId as string,
              amountCents: amountToCents(item.amount),
              durationMinutes: parseOptionalNumber(item.durationMinutes),
            })),
        }),
        saveProfessionalPriceOverrides({
          tenantId: currentTenant.id,
          serviceId: selectedService.id,
          overrides: serviceOverridesProfessionals
            .filter((item) => item.professionalId && item.amount.trim())
            .map((item) => ({
              professionalId: item.professionalId as string,
              amountCents: amountToCents(item.amount),
              durationMinutes: parseOptionalNumber(item.durationMinutes),
            })),
        }),
      ]);
      toast({ title: "Precificação avançada salva" });
      await refreshCatalog();
    } catch (error) {
      toast({
        title: "Falha ao salvar precificação",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingPricing(false);
    }
  }

  async function handleSaveCategory() {
    if (!currentTenant || !categoryForm.name.trim()) return;
    setSavingCategory(true);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: categoryForm.name.trim(),
          parentId: categoryForm.parentId === "none" ? null : categoryForm.parentId,
          description: emptyToNull(categoryForm.description),
          color: emptyToNull(categoryForm.color),
          icon: emptyToNull(categoryForm.icon),
          position: parseInt(categoryForm.position || "0", 10) || 0,
          isActive: categoryForm.isActive,
        });
        toast({ title: "Categoria atualizada" });
      } else {
        await createCategory({
          tenantId: currentTenant.id,
          name: categoryForm.name.trim(),
          description: emptyToNull(categoryForm.description),
          color: emptyToNull(categoryForm.color),
          icon: emptyToNull(categoryForm.icon),
          parentId: categoryForm.parentId === "none" ? null : categoryForm.parentId,
          position: parseInt(categoryForm.position || "0", 10) || 0,
          isActive: categoryForm.isActive,
        });
        toast({ title: "Categoria criada" });
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryForm(EMPTY_CATEGORY_FORM);
      await refreshCatalog();
    } catch (error) {
      toast({
        title: "Falha ao salvar categoria",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleDeleteCategory(category: ServiceCategory) {
    try {
      await deleteCategory(category.id);
      toast({ title: "Categoria removida" });
      await refreshCatalog();
    } catch (error) {
      toast({
        title: "Falha ao remover categoria",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleSavePolicy() {
    if (!currentTenant || !policyForm.name.trim()) return;
    setSavingPolicy(true);
    try {
      const payload = {
        name: policyForm.name.trim(),
        description: emptyToNull(policyForm.description),
        hoursBeforeNoCharge: parseInt(policyForm.hoursBeforeNoCharge || "0", 10) || 0,
        lateCancelFeePct: parseInt(policyForm.lateCancelFeePct || "0", 10) || 0,
        noShowFeePct: parseInt(policyForm.noShowFeePct || "0", 10) || 0,
        isDefault: policyForm.isDefault,
      };
      if (editingPolicy) {
        await updateCancellationPolicy(editingPolicy.id, payload);
        toast({ title: "Política atualizada" });
      } else {
        await createCancellationPolicy({ tenantId: currentTenant.id, ...payload });
        toast({ title: "Política criada" });
      }
      setPolicyDialogOpen(false);
      setEditingPolicy(null);
      setPolicyForm(EMPTY_POLICY_FORM);
      await refreshCatalog();
    } catch (error) {
      toast({
        title: "Falha ao salvar política",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingPolicy(false);
    }
  }

  async function handleDeletePolicy(policy: CancellationPolicy) {
    try {
      await deleteCancellationPolicy(policy.id);
      toast({ title: "Política removida" });
      await refreshCatalog();
    } catch (error) {
      toast({
        title: "Falha ao remover política",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  function startNewService() {
    setSelectedServiceId(null);
    setServiceForm(EMPTY_SERVICE_FORM);
    setServiceOverridesUnits([]);
    setServiceOverridesProfessionals([]);
  }

  const activeCount = services.filter((service) => service.isActive).length;
  const featuredCount = services.filter((service) => service.isFeatured).length;
  const avgBlockedMinutes = services.length
    ? Math.round(
        services.reduce((sum, service) => sum + totalBlockedMinutes(service), 0) / services.length,
      )
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Serviços"
        description="Gerencie categorias, regras operacionais, políticas de cancelamento e preços por unidade ou profissional."
        icon={<Sparkles className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <div className="inline-flex items-center rounded-xl border border-border/70 bg-background/60 p-1 shadow-sm backdrop-blur">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium"
                onClick={() => void refreshCatalog()}
                title="Atualizar catálogo"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium"
                onClick={() => {
                  setEditingCategory(null);
                  setCategoryForm(EMPTY_CATEGORY_FORM);
                  setCategoryDialogOpen(true);
                }}
                title="Nova categoria"
              >
                <Tags className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Categoria</span>
              </Button>
              <Separator orientation="vertical" className="mx-0.5 h-5" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-medium"
                onClick={() => {
                  setEditingPolicy(null);
                  setPolicyForm(EMPTY_POLICY_FORM);
                  setPolicyDialogOpen(true);
                }}
                title="Nova política"
              >
                <ShieldBan className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Política</span>
              </Button>
            </div>
            <Button onClick={startNewService} className="h-9 rounded-xl shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Novo serviço
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Serviços ativos" value={String(activeCount)} helper={`${services.length} cadastrados`} />
        <MetricCard label="Destaques" value={String(featuredCount)} helper="Vitrine do portal e agenda" />
        <MetricCard label="Bloqueio médio" value={formatDuration(avgBlockedMinutes)} helper="Duração + buffers + processamento" />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Categorias</CardTitle>
                <CardDescription>Estruture o catálogo por segmento, especialidade ou jornada.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {categories.length === 0 ? (
                  <EmptyState
                    title="Nenhuma categoria"
                    description="Crie categorias para organizar o catálogo."
                    action={<Button size="sm" onClick={() => setCategoryDialogOpen(true)}>Nova categoria</Button>}
                  />
                ) : (
                  categories.map((category) => (
                    <div key={category.id} className="rounded-2xl border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color ?? "#d4b59e" }} />
                            <p className="font-medium">{category.name}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{category.description || "Sem descrição"}</p>
                        </div>
                        <StatusBadge tone={category.isActive ? "success" : "neutral"}>
                          {category.isActive ? "ativa" : "inativa"}
                        </StatusBadge>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingCategory(category);
                          setCategoryForm({
                            name: category.name,
                            description: category.description ?? "",
                            color: category.color ?? "#C46A6A",
                            icon: category.icon ?? "",
                            parentId: category.parentId ?? "none",
                            position: String(category.position),
                            isActive: category.isActive,
                          });
                          setCategoryDialogOpen(true);
                        }}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void handleDeleteCategory(category)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Lista de serviços</CardTitle>
                <CardDescription>Busque, filtre e selecione um item para editar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, descrição ou código"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue placeholder="Filtrar categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Separator />
                {filteredServices.length === 0 ? (
                  <EmptyState title="Nenhum serviço encontrado" description="Ajuste os filtros ou cadastre um novo serviço." />
                ) : (
                  <div className="space-y-2">
                    {filteredServices.map((service) => (
                      <button
                        type="button"
                        key={service.id}
                        onClick={() => setSelectedServiceId(service.id)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${selectedServiceId === service.id ? "border-primary bg-primary-soft/40" : "border-border/70 hover:border-primary/40"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {categories.find((category) => category.id === service.categoryId)?.name ?? "Sem categoria"}
                            </p>
                          </div>
                          <StatusBadge tone={service.isActive ? "success" : "neutral"}>
                            {service.isActive ? "ativo" : "inativo"}
                          </StatusBadge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{formatDuration(service.durationMinutes)}</span>
                          <span>{formatPrice(basePrices.get(service.id) ?? 0)}</span>
                          {service.isFeatured ? <span>Destaque</span> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Políticas de cancelamento</CardTitle>
                <CardDescription>Aplicadas nos serviços e usadas pela agenda e portal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {policies.length === 0 ? (
                  <EmptyState title="Sem políticas cadastradas" description="Cadastre pelo menos uma política padrão." />
                ) : (
                  policies.map((policy) => (
                    <div key={policy.id} className="rounded-2xl border border-border/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{policy.name}</p>
                            {policy.isDefault ? <StatusBadge tone="brand">padrão</StatusBadge> : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sem cobrança até {policy.hoursBeforeNoCharge}h antes · atraso {policy.lateCancelFeePct}% · no-show {policy.noShowFeePct}%
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingPolicy(policy);
                          setPolicyForm({
                            name: policy.name,
                            description: policy.description ?? "",
                            hoursBeforeNoCharge: String(policy.hoursBeforeNoCharge),
                            lateCancelFeePct: String(policy.lateCancelFeePct),
                            noShowFeePct: String(policy.noShowFeePct),
                            isDefault: policy.isDefault,
                          });
                          setPolicyDialogOpen(true);
                        }}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void handleDeletePolicy(policy)}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>

          <section>
            {!selectedService && serviceForm === EMPTY_SERVICE_FORM ? (
              <Card>
                <CardContent className="pt-6">
                  <EmptyState
                    icon={<Scissors className="h-6 w-6" />}
                    title="Nenhum serviço selecionado"
                    description="Crie um novo serviço ou selecione um item da lista para editar."
                    action={<Button data-critical-action data-testid="services-create-cta" onClick={startNewService}><Plus className="mr-2 h-4 w-4" />Novo serviço</Button>}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-border/70 bg-gradient-soft">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {selectedService ? selectedService.name : "Novo serviço"}
                      </CardTitle>
                      <CardDescription className="mt-1 max-w-2xl">
                        Defina duração, preços, buffers, políticas e regras operacionais.
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedService ? (
                        <StatusBadge tone={selectedService.isActive ? "success" : "neutral"}>
                          {selectedService.isActive ? "ativo" : "inativo"}
                        </StatusBadge>
                      ) : null}
                      {selectedService?.isFeatured ? <StatusBadge tone="brand">destaque</StatusBadge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <Tabs defaultValue="resumo" className="space-y-6">
                    <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                      <TabsTrigger value="resumo" className="rounded-full border border-border bg-card px-3 py-1.5">Resumo</TabsTrigger>
                      <TabsTrigger value="precificacao" className="rounded-full border border-border bg-card px-3 py-1.5">Precificação</TabsTrigger>
                      <TabsTrigger value="regras" className="rounded-full border border-border bg-card px-3 py-1.5">Regras</TabsTrigger>
                    </TabsList>

                    <TabsContent value="resumo" className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Nome" required>
                          <Input value={serviceForm.name} onChange={(event) => setServiceForm((current) => ({ ...current, name: event.target.value }))} />
                        </Field>
                        <Field label="Código interno">
                          <Input value={serviceForm.internalCode} onChange={(event) => setServiceForm((current) => ({ ...current, internalCode: event.target.value }))} />
                        </Field>
                        <Field label="Categoria">
                          <Select value={serviceForm.categoryId} onValueChange={(value) => setServiceForm((current) => ({ ...current, categoryId: value }))}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem categoria</SelectItem>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="Política de cancelamento">
                          <Select value={serviceForm.cancellationPolicyId} onValueChange={(value) => setServiceForm((current) => ({ ...current, cancellationPolicyId: value }))}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem política</SelectItem>
                              {policies.map((policy) => (
                                <SelectItem key={policy.id} value={policy.id}>{policy.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      <Field label="Descrição">
                        <Textarea value={serviceForm.description} onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))} rows={4} />
                      </Field>

                      <div className="grid gap-4 md:grid-cols-4">
                        <Field label="Duração (min)" required>
                          <Input type="number" value={serviceForm.durationMinutes} onChange={(event) => setServiceForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
                        </Field>
                        <Field label="Buffer antes">
                          <Input type="number" value={serviceForm.bufferBeforeMinutes} onChange={(event) => setServiceForm((current) => ({ ...current, bufferBeforeMinutes: event.target.value }))} />
                        </Field>
                        <Field label="Buffer depois">
                          <Input type="number" value={serviceForm.bufferAfterMinutes} onChange={(event) => setServiceForm((current) => ({ ...current, bufferAfterMinutes: event.target.value }))} />
                        </Field>
                        <Field label="Processamento">
                          <Input type="number" value={serviceForm.processingMinutes} onChange={(event) => setServiceForm((current) => ({ ...current, processingMinutes: event.target.value }))} />
                        </Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <Field label="Preço base (R$)">
                          <Input type="number" step="0.01" value={serviceForm.basePrice} onChange={(event) => setServiceForm((current) => ({ ...current, basePrice: event.target.value }))} />
                        </Field>
                        <Field label="Antecedência mínima (h)">
                          <Input type="number" value={serviceForm.minAdvanceHours} onChange={(event) => setServiceForm((current) => ({ ...current, minAdvanceHours: event.target.value }))} />
                        </Field>
                        <Field label="Antecedência máxima (dias)">
                          <Input type="number" value={serviceForm.maxAdvanceDays} onChange={(event) => setServiceForm((current) => ({ ...current, maxAdvanceDays: event.target.value }))} />
                        </Field>
                        <Field label="Retorno ideal (dias)">
                          <Input type="number" value={serviceForm.idealReturnWindowDays} onChange={(event) => setServiceForm((current) => ({ ...current, idealReturnWindowDays: event.target.value }))} />
                        </Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <ToggleField
                          label="Exigir recurso"
                          description="Obriga sala, maca ou equipamento específico na agenda."
                          checked={serviceForm.requiresResource}
                          onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, requiresResource: checked }))}
                        />
                        <Field label="Rótulo do recurso">
                          <Input value={serviceForm.resourceLabel} onChange={(event) => setServiceForm((current) => ({ ...current, resourceLabel: event.target.value }))} placeholder="Ex.: Sala 3 / Laser" />
                        </Field>
                        <ToggleField
                          label="Elegível para pacote"
                          description="Permite incluir o serviço em combos e pacotes."
                          checked={serviceForm.eligibleForPackage}
                          onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, eligibleForPackage: checked }))}
                        />
                        <ToggleField
                          label="Elegível para membership"
                          description="Permite oferecer dentro de planos recorrentes."
                          checked={serviceForm.eligibleForMembership}
                          onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, eligibleForMembership: checked }))}
                        />
                        <ToggleField
                          label="Ativo"
                          description="Serviços inativos não devem ser usados no agendamento."
                          checked={serviceForm.isActive}
                          onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, isActive: checked }))}
                        />
                        <ToggleField
                          label="Destaque"
                          description="Aparece como oferta principal no catálogo."
                          checked={serviceForm.isFeatured}
                          onCheckedChange={(checked) => setServiceForm((current) => ({ ...current, isFeatured: checked }))}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="precificacao" className="space-y-6">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Preço e duração por unidade</CardTitle>
                            <CardDescription>Sobrepõe o preço base conforme a unidade.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {loadingOverrides ? (
                              <div className="flex h-24 items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              </div>
                            ) : (
                              <>
                                {serviceOverridesUnits.map((override, index) => (
                                  <OverrideEditor
                                    key={`unit-${index}`}
                                    label="Unidade"
                                    value={override.unitId ?? "none"}
                                    options={availableUnits.map((unit) => ({ value: unit.id, label: unit.name }))}
                                    amount={override.amount}
                                    durationMinutes={override.durationMinutes}
                                    onValueChange={(value) => updateUnitOverride(index, value, setServiceOverridesUnits)}
                                    onAmountChange={(value) => updateUnitOverride(index, value, setServiceOverridesUnits, "amount")}
                                    onDurationChange={(value) => updateUnitOverride(index, value, setServiceOverridesUnits, "durationMinutes")}
                                    onRemove={() => setServiceOverridesUnits((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                  />
                                ))}
                                <Button variant="outline" size="sm" onClick={() => setServiceOverridesUnits((current) => [...current, { unitId: undefined, amount: "", durationMinutes: "" }])}>
                                  <Plus className="mr-2 h-4 w-4" /> Adicionar unidade
                                </Button>
                              </>
                            )}
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Preço e duração por profissional</CardTitle>
                            <CardDescription>Use quando houver senioridade ou comissão distinta.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {loadingOverrides ? (
                              <div className="flex h-24 items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              </div>
                            ) : (
                              <>
                                {serviceOverridesProfessionals.map((override, index) => (
                                  <OverrideEditor
                                    key={`professional-${index}`}
                                    label="Profissional"
                                    value={override.professionalId ?? "none"}
                                    options={professionals.map((professional) => ({ value: professional.id, label: professional.displayName }))}
                                    amount={override.amount}
                                    durationMinutes={override.durationMinutes}
                                    onValueChange={(value) => updateProfessionalOverride(index, value, setServiceOverridesProfessionals)}
                                    onAmountChange={(value) => updateProfessionalOverride(index, value, setServiceOverridesProfessionals, "amount")}
                                    onDurationChange={(value) => updateProfessionalOverride(index, value, setServiceOverridesProfessionals, "durationMinutes")}
                                    onRemove={() => setServiceOverridesProfessionals((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                                  />
                                ))}
                                <Button variant="outline" size="sm" onClick={() => setServiceOverridesProfessionals((current) => [...current, { professionalId: undefined, amount: "", durationMinutes: "" }])}>
                                  <Plus className="mr-2 h-4 w-4" /> Adicionar profissional
                                </Button>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="regras" className="space-y-4">
                      <Field label="Instruções pré-atendimento">
                        <Textarea value={serviceForm.preAppointmentInstructions} onChange={(event) => setServiceForm((current) => ({ ...current, preAppointmentInstructions: event.target.value }))} rows={4} />
                      </Field>
                      <Field label="Instruções pós-atendimento">
                        <Textarea value={serviceForm.postAppointmentInstructions} onChange={(event) => setServiceForm((current) => ({ ...current, postAppointmentInstructions: event.target.value }))} rows={4} />
                      </Field>

                      <div className="grid gap-4 md:grid-cols-3">
                        <SummaryBlock label="Bloqueio total" value={formatDuration(totalBlockedMinutes(serviceFormToSummary(serviceForm)))} />
                        <SummaryBlock label="Preço base" value={serviceForm.basePrice ? formatPrice(amountToCents(serviceForm.basePrice)) : "Não definido"} />
                        <SummaryBlock label="Antecedência" value={`${serviceForm.minAdvanceHours || 0}h até ${serviceForm.maxAdvanceDays || 0} dias`} />
                      </div>
                    </TabsContent>
                  </Tabs>

                  <Separator className="my-6" />

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void handleSaveService()} disabled={savingService}>
                      {savingService ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Salvar serviço
                    </Button>
                    {selectedService ? (
                      <>
                        <Button variant="outline" onClick={() => void handleSavePricing()} disabled={savingPricing}>
                          {savingPricing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}
                          Salvar preços avançados
                        </Button>
                        <Button variant="ghost" onClick={() => void handleDeleteService()} disabled={savingService}>
                          <Trash2 className="mr-2 h-4 w-4" /> Remover serviço
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        </div>
      )}

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Use categorias para organizar o catálogo e facilitar filtros futuros.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Nome" required>
              <Input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Descrição">
              <Textarea value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cor">
                <Input type="color" value={categoryForm.color} onChange={(event) => setCategoryForm((current) => ({ ...current, color: event.target.value }))} />
              </Field>
              <Field label="Ícone">
                <Input value={categoryForm.icon} onChange={(event) => setCategoryForm((current) => ({ ...current, icon: event.target.value }))} placeholder="Ex.: sparkles" />
              </Field>
              <Field label="Categoria pai">
                <Select value={categoryForm.parentId} onValueChange={(value) => setCategoryForm((current) => ({ ...current, parentId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem pai</SelectItem>
                    {categories.filter((category) => category.id !== editingCategory?.id).map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Posição">
                <Input type="number" value={categoryForm.position} onChange={(event) => setCategoryForm((current) => ({ ...current, position: event.target.value }))} />
              </Field>
            </div>
            {editingCategory ? (
              <ToggleField
                label="Categoria ativa"
                description="Categorias inativas deixam de ser usadas nas telas operacionais."
                checked={categoryForm.isActive}
                onCheckedChange={(checked) => setCategoryForm((current) => ({ ...current, isActive: checked }))}
              />
            ) : null}
            <Button onClick={() => void handleSaveCategory()} disabled={savingCategory}>
              {savingCategory ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar categoria
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? "Editar política" : "Nova política"}</DialogTitle>
            <DialogDescription>Essas regras orientam agenda, portal e cobrança em cancelamentos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Nome" required>
              <Input value={policyForm.name} onChange={(event) => setPolicyForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Descrição">
              <Textarea value={policyForm.description} onChange={(event) => setPolicyForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Sem cobrança até (h)">
                <Input type="number" value={policyForm.hoursBeforeNoCharge} onChange={(event) => setPolicyForm((current) => ({ ...current, hoursBeforeNoCharge: event.target.value }))} />
              </Field>
              <Field label="Taxa atraso (%)">
                <Input type="number" value={policyForm.lateCancelFeePct} onChange={(event) => setPolicyForm((current) => ({ ...current, lateCancelFeePct: event.target.value }))} />
              </Field>
              <Field label="Taxa no-show (%)">
                <Input type="number" value={policyForm.noShowFeePct} onChange={(event) => setPolicyForm((current) => ({ ...current, noShowFeePct: event.target.value }))} />
              </Field>
            </div>
            <ToggleField
              label="Política padrão"
              description="Use como padrão para novos serviços."
              checked={policyForm.isDefault}
              onCheckedChange={(checked) => setPolicyForm((current) => ({ ...current, isDefault: checked }))}
            />
            <Button onClick={() => void handleSavePolicy()} disabled={savingPolicy}>
              {savingPolicy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar política
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function serviceToForm(service: Service, basePriceCents?: number): ServiceFormState {
  return {
    name: service.name,
    description: service.description ?? "",
    internalCode: service.internalCode ?? "",
    categoryId: service.categoryId ?? "none",
    cancellationPolicyId: service.cancellationPolicyId ?? "none",
    durationMinutes: String(service.durationMinutes),
    bufferBeforeMinutes: String(service.bufferBeforeMinutes),
    bufferAfterMinutes: String(service.bufferAfterMinutes),
    processingMinutes: String(service.processingMinutes),
    minAdvanceHours: String(service.minAdvanceHours),
    maxAdvanceDays: String(service.maxAdvanceDays),
    idealReturnWindowDays: service.idealReturnWindowDays == null ? "" : String(service.idealReturnWindowDays),
    requiresResource: service.requiresResource,
    resourceLabel: service.resourceLabel ?? "",
    eligibleForPackage: service.eligibleForPackage,
    eligibleForMembership: service.eligibleForMembership,
    preAppointmentInstructions: service.preAppointmentInstructions ?? "",
    postAppointmentInstructions: service.postAppointmentInstructions ?? "",
    isActive: service.isActive,
    isFeatured: service.isFeatured,
    basePrice: basePriceCents == null ? "" : centsToAmount(basePriceCents),
  };
}

function serviceFormToPayload(form: ServiceFormState, tenantId: string) {
  return {
    tenantId,
    name: form.name.trim(),
    description: emptyToUndefined(form.description),
    internalCode: emptyToUndefined(form.internalCode),
    categoryId: form.categoryId === "none" ? undefined : form.categoryId,
    cancellationPolicyId: form.cancellationPolicyId === "none" ? undefined : form.cancellationPolicyId,
    durationMinutes: parseInt(form.durationMinutes || "0", 10) || 0,
    bufferBeforeMinutes: parseInt(form.bufferBeforeMinutes || "0", 10) || 0,
    bufferAfterMinutes: parseInt(form.bufferAfterMinutes || "0", 10) || 0,
    processingMinutes: parseInt(form.processingMinutes || "0", 10) || 0,
    minAdvanceHours: parseInt(form.minAdvanceHours || "0", 10) || 0,
    maxAdvanceDays: parseInt(form.maxAdvanceDays || "0", 10) || 0,
    idealReturnWindowDays: parseOptionalNumber(form.idealReturnWindowDays),
    requiresResource: form.requiresResource,
    resourceLabel: emptyToUndefined(form.resourceLabel),
    eligibleForPackage: form.eligibleForPackage,
    eligibleForMembership: form.eligibleForMembership,
    preAppointmentInstructions: emptyToUndefined(form.preAppointmentInstructions),
    postAppointmentInstructions: emptyToUndefined(form.postAppointmentInstructions),
    isActive: form.isActive,
    isFeatured: form.isFeatured,
    basePriceCents: form.basePrice.trim() ? amountToCents(form.basePrice) : undefined,
  };
}

function unitOverrideToForm(item: ServiceUnitPriceOverride): PriceOverrideForm {
  return {
    unitId: item.unitId,
    amount: centsToAmount(item.amountCents),
    durationMinutes: item.durationMinutes == null ? "" : String(item.durationMinutes),
  };
}

function professionalOverrideToForm(item: ServiceProfessionalPriceOverride): PriceOverrideForm {
  return {
    professionalId: item.professionalId,
    amount: centsToAmount(item.amountCents),
    durationMinutes: item.durationMinutes == null ? "" : String(item.durationMinutes),
  };
}

function updateUnitOverride(
  index: number,
  value: string,
  setter: Dispatch<SetStateAction<PriceOverrideForm[]>>,
  field: "unitId" | "amount" | "durationMinutes" = "unitId",
) {
  setter((current) => current.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    return { ...item, [field]: value === "none" ? undefined : value };
  }));
}

function updateProfessionalOverride(
  index: number,
  value: string,
  setter: Dispatch<SetStateAction<PriceOverrideForm[]>>,
  field: "professionalId" | "amount" | "durationMinutes" = "professionalId",
) {
  setter((current) => current.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    return { ...item, [field]: value === "none" ? undefined : value };
  }));
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

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function OverrideEditor({
  label,
  value,
  options,
  amount,
  durationMinutes,
  onValueChange,
  onAmountChange,
  onDurationChange,
  onRemove,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  amount: string;
  durationMinutes: string;
  onValueChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onDurationChange: (value: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border/70 p-3">
      <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
        <div className="space-y-2">
          <Label>{label}</Label>
          <Select value={value} onValueChange={onValueChange}>
            <SelectTrigger><SelectValue placeholder={`Selecione ${label.toLowerCase()}`} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Não definido</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Preço (R$)</Label>
          <Input type="number" step="0.01" value={amount} onChange={(event) => onAmountChange(event.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Duração (min)</Label>
          <Input type="number" value={durationMinutes} onChange={(event) => onDurationChange(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="ghost" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
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

function serviceFormToSummary(form: ServiceFormState) {
  return {
    durationMinutes: parseInt(form.durationMinutes || "0", 10) || 0,
    bufferBeforeMinutes: parseInt(form.bufferBeforeMinutes || "0", 10) || 0,
    bufferAfterMinutes: parseInt(form.bufferAfterMinutes || "0", 10) || 0,
    processingMinutes: parseInt(form.processingMinutes || "0", 10) || 0,
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function amountToCents(value: string) {
  return Math.round(Number(value || "0") * 100);
}

function centsToAmount(value: number) {
  return (value / 100).toFixed(2);
}
