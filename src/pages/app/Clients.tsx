import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  Heart,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Tag,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import {
  addTimelineEvent,
  createClientMediaSignedUrl,
  createClient,
  createConsentResponse,
  createConsentTemplate,
  createNote,
  createTag,
  deleteFile,
  deleteNote,
  deletePhoto,
  getClient,
  listClientCustomValues,
  listClientTagIds,
  listClients,
  listConsentResponses,
  listConsentTemplates,
  listCustomFieldDefs,
  listFiles,
  listNotes,
  listPhotos,
  listTags,
  listTimeline,
  setClientTags,
  updateClient,
  uploadClientFile,
  uploadClientPhoto,
  upsertCustomValue,
  type CreateClientInput,
} from "@/repositories/clients";
import { listProfessionalsLite, type ProfessionalLite } from "@/repositories/scheduling";
import { computeCompleteness, clientStatusLabels, riskLevelLabels, type Client, type ClientRiskLevel, type ClientStatus, type ClientFile, type ClientNote, type ClientPhoto, type ClientTag, type ConsentResponse, type ConsentTemplate, type CustomFieldDefinition, type TimelineEvent } from "@/domain/client";
import { canAccess } from "@/domain/roles";
import { isUsageBlocked } from "@/domain/billing";
import { QuickFiltersBar } from "@/features/clients/QuickFiltersBar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type FiltersState = {
  search: string;
  status: ClientStatus | "all";
  vipOnly: boolean;
  inactiveOnly: boolean;
  highRiskOnly: boolean;
  needsReactivationOnly: boolean;
  birthdayMonth: string;
  preferredUnitId: string;
  preferredProfessionalId: string;
  origin: string;
  churnRiskScore: string;
};

const DEFAULT_FILTERS: FiltersState = {
  search: "",
  status: "all",
  vipOnly: false,
  inactiveOnly: false,
  highRiskOnly: false,
  needsReactivationOnly: false,
  birthdayMonth: "all",
  preferredUnitId: "all",
  preferredProfessionalId: "all",
  origin: "all",
  churnRiskScore: "all",
};

type ClientFormState = {
  fullName: string;
  phone: string;
  whatsappPhone: string;
  email: string;
  birthDate: string;
  origin: string;
  notes: string;
  allergies: string;
  contraindications: string;
  preferences: string;
  isVip: boolean;
  riskLevel: ClientRiskLevel;
  preferredUnitId: string;
  preferredProfessionalId: string;
};

const EMPTY_FORM: ClientFormState = {
  fullName: "",
  phone: "",
  whatsappPhone: "",
  email: "",
  birthDate: "",
  origin: "",
  notes: "",
  allergies: "",
  contraindications: "",
  preferences: "",
  isVip: false,
  riskLevel: "low",
  preferredUnitId: "none",
  preferredProfessionalId: "none",
};

type CustomValuesMap = Record<string, unknown>;

export default function ClientsPage() {
  const [searchParams] = useSearchParams();
  const { currentTenant, availableUnits, currentRole } = useTenant();
  const { limits, usage, refresh: refreshBilling } = useTenantBilling();
  const { user } = useAuth();
  const { toast } = useToast();

  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [professionals, setProfessionals] = useState<ProfessionalLite[]>([]);
  const [tags, setTags] = useState<ClientTag[]>([]);
  const [ownProfessional, setOwnProfessional] = useState<{ id: string; name: string } | null>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [customDefs, setCustomDefs] = useState<CustomFieldDefinition[]>([]);
  const [customValues, setCustomValues] = useState<CustomValuesMap>({});
  const [consentTemplates, setConsentTemplates] = useState<ConsentTemplate[]>([]);
  const [consentResponses, setConsentResponses] = useState<ConsentResponse[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6E3B5D");
  const [savingTags, setSavingTags] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [fileDescription, setFileDescription] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoType, setPhotoType] = useState<ClientPhoto["photoType"]>("general");
  const [photoTakenAt, setPhotoTakenAt] = useState("");

  const [templateTitle, setTemplateTitle] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [creatingConsent, setCreatingConsent] = useState(false);

  useEffect(() => {
    const search = searchParams.get("search");
    if (!search) return;
    setFilters((current) => (current.search === search ? current : { ...current, search }));
  }, [searchParams]);

  const canManageTemplates = canAccess(currentRole, ["owner", "manager"]);

  const originOptions = useMemo(() => {
    const values = new Set<string>();
    clients.forEach((c) => {
      if (c.origin?.trim()) values.add(c.origin.trim());
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [clients]);

  useEffect(() => {
    if (!currentTenant) return;
    void (async () => {
      try {
        const [pros, allTags] = await Promise.all([
          listProfessionalsLite(currentTenant.id),
          listTags(currentTenant.id),
        ]);
        setProfessionals(pros);
        setTags(allTags);
      } catch (error) {
        toast({
          title: "Erro ao carregar dados auxiliares",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      }
    })();
  }, [currentTenant, toast]);

  // Descobre o profissional vinculado ao usuário logado dentro do tenant atual,
  // para habilitar o atalho "Meus clientes". RLS garante isolamento por tenant.
  useEffect(() => {
    if (!currentTenant || !user) {
      setOwnProfessional(null);
      return;
    }
    let ignoreOwn = false;
    void (async () => {
      const { data } = await supabase
        .from("professionals")
        .select("id, display_name")
        .eq("tenant_id", currentTenant.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (ignoreOwn) return;
      setOwnProfessional(data ? { id: data.id, name: data.display_name } : null);
    })();
    return () => {
      ignoreOwn = true;
    };
  }, [currentTenant, user]);

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoadingList(true);
    void (async () => {
      try {
        const list = await listClients({
          tenantId: currentTenant.id,
          search: filters.search || undefined,
          status: filters.status,
          vipOnly: filters.vipOnly,
          inactiveOnly: filters.inactiveOnly,
          highRiskOnly: filters.highRiskOnly,
          needsReactivationOnly: filters.needsReactivationOnly,
          birthdayMonth: filters.birthdayMonth === "all" ? undefined : Number(filters.birthdayMonth),
          preferredUnitId: filters.preferredUnitId === "all" ? undefined : filters.preferredUnitId,
          preferredProfessionalId: filters.preferredProfessionalId === "all" ? undefined : filters.preferredProfessionalId,
          origin: filters.origin === "all" ? undefined : filters.origin,
          churnRiskScoreMin: filters.churnRiskScore === "high" ? 70 : undefined,
          limit: 300,
        });
        if (ignore) return;
        setClients(list);
        setSelectedId((prev) => {
          if (prev && list.some((client) => client.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao carregar clientes",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      } finally {
        if (!ignore) setLoadingList(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, filters, toast]);

  useEffect(() => {
    if (!currentTenant || !selectedId) {
      setSelectedClient(null);
      return;
    }
    let ignore = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const [
          client,
          clientTagIds,
          clientNotes,
          clientFiles,
          clientPhotos,
          clientTimeline,
          defs,
          values,
          templates,
          responses,
        ] = await Promise.all([
          getClient(selectedId),
          listClientTagIds(selectedId),
          listNotes(selectedId),
          listFiles(selectedId),
          listPhotos(selectedId),
          listTimeline(selectedId),
          listCustomFieldDefs(currentTenant.id),
          listClientCustomValues(selectedId),
          listConsentTemplates(currentTenant.id),
          listConsentResponses(selectedId),
        ]);
        if (ignore) return;
        setSelectedClient(client);
        setSelectedTagIds(clientTagIds);
        setNotes(clientNotes);
        setFiles(clientFiles);
        setPhotos(clientPhotos);
        setTimeline(clientTimeline);
        setCustomDefs(defs);
        setCustomValues(values);
        setConsentTemplates(templates);
        setConsentResponses(responses);
        if (client) setForm(clientToForm(client));
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao abrir ficha do cliente",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      } finally {
        if (!ignore) setLoadingDetail(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [currentTenant, selectedId, toast]);

  useEffect(() => {
    if (photos.length === 0) {
      setPhotoUrls({});
      return;
    }
    let ignore = false;
    void (async () => {
      const entries = await Promise.all(
        photos.map(async (photo) => {
          const signedUrl = await createClientMediaSignedUrl(photo.storagePath, 3600);
          return [photo.id, signedUrl ?? ""] as const;
        }),
      );
      if (!ignore) setPhotoUrls(Object.fromEntries(entries));
    })();
    return () => {
      ignore = true;
    };
  }, [photos]);

  async function refreshSelectedClient() {
    if (!selectedId || !currentTenant) return;
    const [
      client,
      clientTagIds,
      clientNotes,
      clientFiles,
      clientPhotos,
      clientTimeline,
      defs,
      values,
      templates,
      responses,
    ] = await Promise.all([
      getClient(selectedId),
      listClientTagIds(selectedId),
      listNotes(selectedId),
      listFiles(selectedId),
      listPhotos(selectedId),
      listTimeline(selectedId),
      listCustomFieldDefs(currentTenant.id),
      listClientCustomValues(selectedId),
      listConsentTemplates(currentTenant.id),
      listConsentResponses(selectedId),
    ]);
    setSelectedClient(client);
    setSelectedTagIds(clientTagIds);
    setNotes(clientNotes);
    setFiles(clientFiles);
    setPhotos(clientPhotos);
    setTimeline(clientTimeline);
    setCustomDefs(defs);
    setCustomValues(values);
    setConsentTemplates(templates);
    setConsentResponses(responses);
    if (client) {
      setForm(clientToForm(client));
      setClients((prev) => prev.map((item) => (item.id === client.id ? client : item)));
    }
  }

  async function handleSaveForm() {
    if (!currentTenant || !user) return;
    if (!form.fullName.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do cliente.", variant: "destructive" });
      return;
    }
    const creatingNew = !editing || !selectedClient;
    if (
      creatingNew &&
      limits?.maxActiveClients !== null &&
      limits?.maxActiveClients !== undefined &&
      usage.activeClientsCount >= limits.maxActiveClients
    ) {
      toast({
        title: "Limite de clientes ativos atingido",
        description: "Ajuste o plano ou os overrides antes de cadastrar outro cliente.",
        variant: "destructive",
      });
      return;
    }
    setSavingForm(true);
    try {
      const payload = formToPayload(form, currentTenant.id, user.id, selectedClient?.status ?? "active");
      let saved: Client;
      if (editing && selectedClient) {
        saved = await updateClient(selectedClient.id, payload);
        await addTimelineEvent({
          tenantId: currentTenant.id,
          clientId: selectedClient.id,
          actorId: user.id,
          eventType: "manual",
          title: "Cadastro atualizado",
          description: "A ficha do cliente foi atualizada.",
        });
        toast({ title: "Cliente atualizado" });
      } else {
        saved = await createClient(payload as CreateClientInput);
        await addTimelineEvent({
          tenantId: currentTenant.id,
          clientId: saved.id,
          actorId: user.id,
          eventType: "manual",
          title: "Cliente cadastrado",
          description: "Novo cliente criado no CRM.",
        });
        toast({ title: "Cliente cadastrado" });
      }

      setClients((prev) => {
        const exists = prev.some((item) => item.id === saved.id);
        const next = exists
          ? prev.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...prev];
        return next.sort((a, b) => a.fullName.localeCompare(b.fullName));
      });
      setSelectedId(saved.id);
      setSelectedClient(saved);
      setForm(clientToForm(saved));
      setEditing(true);
      setOpenCreate(false);
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Falha ao salvar cliente",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingForm(false);
    }
  }

  async function handleCreateTag() {
    if (!currentTenant || !newTagName.trim()) return;
    try {
      const created = await createTag(currentTenant.id, newTagName.trim(), newTagColor);
      setTags((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedTagIds((prev) => Array.from(new Set([...prev, created.id])));
      setNewTagName("");
      toast({ title: "Tag criada" });
    } catch (error) {
      toast({
        title: "Erro ao criar tag",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleSaveTags() {
    if (!currentTenant || !selectedClient) return;
    setSavingTags(true);
    try {
      await setClientTags(currentTenant.id, selectedClient.id, selectedTagIds);
      toast({ title: "Tags atualizadas" });
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao salvar tags",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingTags(false);
    }
  }

  async function handleAddNote() {
    if (!currentTenant || !selectedClient || !user || !newNote.trim()) return;
    setSavingNote(true);
    try {
      await createNote({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        authorId: user.id,
        body: newNote.trim(),
      });
      await addTimelineEvent({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        actorId: user.id,
        eventType: "note",
        title: "Nota interna adicionada",
        description: newNote.trim(),
      });
      setNewNote("");
      toast({ title: "Nota registrada" });
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao registrar nota",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await deleteNote(noteId);
      toast({ title: "Nota removida" });
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao remover nota",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleFileUpload(file: File | null) {
    if (!currentTenant || !selectedClient) return;
    if (!file) return;
    const projectedStorageMb = usage.storageMb + (file.size / (1024 * 1024));
    if (isUsageBlocked(projectedStorageMb, limits?.maxStorageMb ?? null)) {
      toast({
        title: "Limite de armazenamento atingido",
        description: "O upload ultrapassa o armazenamento disponível no plano atual.",
        variant: "destructive",
      });
      return;
    }
    setUploadingFile(true);
    try {
      await uploadClientFile({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        uploadedBy: user?.id ?? null,
        file,
        description: fileDescription || null,
      });
      setFileDescription("");
      toast({ title: "Arquivo enviado" });
      await refreshBilling();
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro no upload do arquivo",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setUploadingFile(false);
    }
  }

  async function handlePhotoUpload(file: File | null) {
    if (!currentTenant || !selectedClient) return;
    if (!file) return;
    const projectedStorageMb = usage.storageMb + (file.size / (1024 * 1024));
    if (isUsageBlocked(projectedStorageMb, limits?.maxStorageMb ?? null)) {
      toast({
        title: "Limite de armazenamento atingido",
        description: "A foto excede o armazenamento disponível no plano atual.",
        variant: "destructive",
      });
      return;
    }
    setUploadingPhoto(true);
    try {
      await uploadClientPhoto({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        uploadedBy: user?.id ?? null,
        file,
        photoType,
        caption: photoCaption || null,
        takenAt: photoTakenAt || null,
      });
      setPhotoCaption("");
      setPhotoTakenAt("");
      setPhotoType("general");
      toast({ title: "Foto enviada" });
      await refreshBilling();
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro no upload da foto",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeleteFile(file: ClientFile) {
    try {
      await deleteFile(file.id, file.storagePath);
      toast({ title: "Arquivo removido" });
      await refreshBilling();
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao remover arquivo",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleDeletePhoto(photo: ClientPhoto) {
    try {
      await deletePhoto(photo.id, photo.storagePath);
      toast({ title: "Foto removida" });
      await refreshBilling();
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao remover foto",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleCustomValueChange(definitionId: string, value: unknown) {
    if (!currentTenant || !selectedClient) return;
    try {
      await upsertCustomValue({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        definitionId,
        value,
      });
      setCustomValues((prev) => ({ ...prev, [definitionId]: value }));
      toast({ title: "Campo customizado salvo" });
    } catch (error) {
      toast({
        title: "Erro ao salvar campo",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  async function handleCreateTemplate() {
    if (!currentTenant || !user || !templateTitle.trim() || !templateBody.trim()) return;
    setCreatingTemplate(true);
    try {
      await createConsentTemplate({
        tenantId: currentTenant.id,
        createdBy: user.id,
        title: templateTitle.trim(),
        body: templateBody.trim(),
      });
      setTemplateTitle("");
      setTemplateBody("");
      toast({ title: "Template criado" });
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao criar template",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setCreatingTemplate(false);
    }
  }

  async function handleCreateConsent(templateId: string) {
    if (!currentTenant || !selectedClient) return;
    setCreatingConsent(true);
    try {
      const template = consentTemplates.find((item) => item.id === templateId);
      await createConsentResponse({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        templateId,
        templateVersion: template?.version ?? 1,
      });
      await addTimelineEvent({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        actorId: user?.id ?? null,
        eventType: "consent",
        title: "Consentimento pendente criado",
        description: template?.title ?? null,
      });
      toast({ title: "Consentimento criado" });
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao criar consentimento",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setCreatingConsent(false);
    }
  }

  async function handleUpdateStatus(status: ClientStatus) {
    if (!currentTenant || !selectedClient || !user) return;
    try {
      await updateClient(selectedClient.id, { status });
      await addTimelineEvent({
        tenantId: currentTenant.id,
        clientId: selectedClient.id,
        actorId: user.id,
        eventType: "status_change",
        title: "Status alterado",
        description: `Status operacional alterado para ${clientStatusLabels[status]}`,
      });
      toast({ title: "Status atualizado" });
      await refreshSelectedClient();
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="CRM completo com busca rápida, ficha operacional, histórico, mídia e consentimentos."
        icon={<Users className="h-5 w-5" />}
        actions={
          <>
            <StatusBadge tone="brand" dot={false}>{clients.length} clientes</StatusBadge>
            {limits?.maxActiveClients !== null &&
            limits?.maxActiveClients !== undefined &&
            usage.activeClientsCount >= limits.maxActiveClients ? (
              <StatusBadge tone="warning" dot={false} data-testid="clients-active-limit-badge">Limite de clientes ativos atingido</StatusBadge>
            ) : null}
            <Dialog open={openCreate} onOpenChange={setOpenCreate}>
              <DialogTrigger asChild>
                <Button
                  data-critical-action
                  data-testid="clients-create-cta"
                  className="rounded-xl bg-gradient-brand"
                  disabled={
                    limits?.maxActiveClients !== null &&
                    limits?.maxActiveClients !== undefined &&
                    usage.activeClientsCount >= limits.maxActiveClients
                  }
                  onClick={() => {
                    setEditing(false);
                    setForm(EMPTY_FORM);
                    setOpenCreate(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Novo cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Novo cliente</DialogTitle>
                  <DialogDescription>
                    Preencha os dados principais do cliente para iniciar o relacionamento no CRM.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[72vh] pr-4">
                  <ClientForm
                    form={form}
                    setForm={setForm}
                    units={availableUnits}
                    professionals={professionals}
                    onSave={handleSaveForm}
                    saving={savingForm}
                    saveLabel="Cadastrar cliente"
                  />
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <QuickFiltersBar
        filters={filters}
        setFilters={setFilters}
        ownProfessionalId={ownProfessional?.id ?? null}
        ownProfessionalName={ownProfessional?.name ?? null}
        onClear={() =>
          setFilters((prev) => ({
            ...prev,
            vipOnly: false,
            inactiveOnly: false,
            highRiskOnly: false,
            needsReactivationOnly: false,
            birthdayMonth: "all",
            preferredProfessionalId: "all",
          }))
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] 2xl:grid-cols-[420px_1fr]">
        <section className="min-w-0 space-y-4">
          <FiltersCard
            filters={filters}
            setFilters={setFilters}
            units={availableUnits}
            professionals={professionals}
            origins={originOptions}
          />

          <Card className="min-w-0 w-full max-w-full overflow-hidden">
            <CardHeader className="min-w-0 px-4 pb-3 sm:px-6">
              <CardTitle className="text-base">Base de clientes</CardTitle>
              <CardDescription>Busca rápida para recepção e consulta operacional.</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 px-0 pb-0">
              {loadingList ? (
                <div className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : clients.length === 0 ? (
                <div className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <EmptyState
                    icon={<Users className="h-6 w-6" />}
                    title="Nenhum cliente encontrado"
                    description="Ajuste os filtros ou cadastre um novo cliente."
                  />
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-20rem)] w-full">
                  <ul className="divide-y divide-border/60">
                    {clients.map((client) => (
                      <li key={client.id}>
                        <button
                          type="button"
                          data-testid="client-list-item"
                          data-client-id={client.id}
                          data-client-name={client.fullName}
                          onClick={() => setSelectedId(client.id)}
                          className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-muted/40 sm:px-6 ${selectedId === client.id ? "bg-muted/60" : ""}`}
                        >
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-soft text-primary">
                            <UserRound className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{client.fullName}</p>
                              {client.isVip && <StatusBadge tone="warning">VIP</StatusBadge>}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {client.phone || client.email || "Sem contato principal"}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <StatusBadge tone={client.status === "active" ? "success" : client.status === "inactive" ? "neutral" : "danger"}>
                                {clientStatusLabels[client.status]}
                              </StatusBadge>
                              <StatusBadge tone={client.riskLevel === "high" ? "danger" : client.riskLevel === "medium" ? "warning" : "info"}>
                                {riskLevelLabels[client.riskLevel]}
                              </StatusBadge>
                              {client.needsReactivation && <StatusBadge tone="brand">Reativação</StatusBadge>}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="min-w-0">
          {!selectedId ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Selecione um cliente"
              description="Abra uma ficha para consultar histórico, dados e próximos passos."
            />
          ) : loadingDetail || !selectedClient ? (
            <Card className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-80 w-full" />
              </div>
            </Card>
          ) : (
            <div className="min-w-0 space-y-4">
              <ClientHero
                client={selectedClient}
                tags={tags.filter((tag) => selectedTagIds.includes(tag.id))}
                onEdit={() => setEditing((prev) => !prev)}
                completeness={computeCompleteness(selectedClient)}
              />

              {editing && (
                <Card>
                  <CardHeader>
                    <CardTitle>Editar ficha</CardTitle>
                    <CardDescription>Atualize os dados operacionais do cliente.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ClientForm
                      form={form}
                      setForm={setForm}
                      units={availableUnits}
                      professionals={professionals}
                      onSave={handleSaveForm}
                      saving={savingForm}
                      saveLabel="Salvar alterações"
                      selectedStatus={selectedClient.status}
                      onStatusChange={handleUpdateStatus}
                    />
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="summary" className="space-y-4">
                <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                  <TabsTrigger value="summary">Resumo</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="notes">Notas</TabsTrigger>
                  <TabsTrigger value="media" data-testid="client-media-tab">Arquivos & Fotos</TabsTrigger>
                  <TabsTrigger value="consents">Consentimentos</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="space-y-4">
                  <div className="grid min-w-0 gap-4 xl:grid-cols-[1.3fr_1fr]">
                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle>Dados principais</CardTitle>
                        <CardDescription>Campos centrais para retenção e operação diária.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        <InfoItem label="Telefone" value={selectedClient.phone} />
                        <InfoItem label="WhatsApp" value={selectedClient.whatsappPhone} />
                        <InfoItem label="E-mail" value={selectedClient.email} />
                        <InfoItem label="Nascimento" value={formatDate(selectedClient.birthDate)} />
                        <InfoItem label="Origem" value={selectedClient.origin} />
                        <InfoItem label="Última visita" value={formatDateTime(selectedClient.lastVisitAt)} />
                        <InfoItem label="Próxima visita" value={formatDateTime(selectedClient.nextVisitAt)} />
                        <InfoItem label="Cidade / UF" value={formatLocation(selectedClient.city, selectedClient.state)} />
                        <InfoItem label="Observações" value={selectedClient.notes} full />
                        <InfoItem label="Preferências" value={selectedClient.preferences} full />
                        <InfoItem label="Alergias" value={selectedClient.allergies} full />
                        <InfoItem label="Contraindicações" value={selectedClient.contraindications} full />
                      </CardContent>
                    </Card>

                    <div className="min-w-0 space-y-4">
                      <Card className="min-w-0">
                        <CardHeader>
                          <CardTitle>Tags & status</CardTitle>
                          <CardDescription>Classifique o cliente para atendimento e reativação.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {tags.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma tag criada ainda.</p>
                            ) : (
                              tags.map((tag) => {
                                const active = selectedTagIds.includes(tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => setSelectedTagIds((prev) => active ? prev.filter((id) => id !== tag.id) : [...prev, tag.id])}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}
                                  >
                                    {tag.name}
                                  </button>
                                );
                              })
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
                            <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Nova tag" />
                            <Input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
                            <Button variant="outline" onClick={handleCreateTag}>
                              <Plus className="mr-1.5 h-4 w-4" /> Criar
                            </Button>
                          </div>
                          <Button onClick={handleSaveTags} disabled={savingTags}>
                            {savingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
                            Salvar tags
                          </Button>
                        </CardContent>
                      </Card>

                      <Card className="min-w-0">
                        <CardHeader>
                          <CardTitle>Campos customizados</CardTitle>
                          <CardDescription>Configuráveis por tenant para aprofundar a ficha.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {customDefs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum campo customizado configurado.</p>
                          ) : (
                            customDefs.map((def) => (
                              <CustomFieldEditor
                                key={def.id}
                                definition={def}
                                value={customValues[def.id]}
                                onSave={handleCustomValueChange}
                              />
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="timeline">
                  <Card>
                    <CardHeader>
                      <CardTitle>Timeline do cliente</CardTitle>
                      <CardDescription>Centro da visão operacional do histórico do cliente.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {timeline.length === 0 ? (
                        <EmptyState
                          icon={<CalendarDays className="h-6 w-6" />}
                          title="Sem eventos na timeline"
                          description="Notas, uploads, fotos, consentimentos e eventos manuais aparecerão aqui."
                        />
                      ) : (
                        <ul className="space-y-4">
                          {timeline.map((event) => (
                            <li key={event.id} className="flex gap-3">
                              <div className="mt-1 grid h-9 w-9 place-items-center rounded-xl bg-gradient-soft text-primary">
                                {timelineIcon(event.eventType)}
                              </div>
                              <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-card p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-medium">{event.title}</p>
                                  <span className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt)}</span>
                                </div>
                                {event.description && <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>}
                                <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">{event.eventType}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes">
                  <Card>
                    <CardHeader>
                      <CardTitle>Notas internas</CardTitle>
                      <CardDescription>Anotações rápidas para recepção e profissional.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Textarea
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          rows={4}
                          placeholder="Escreva uma nota interna útil para a operação..."
                        />
                        <Button onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
                          {savingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                          Registrar nota
                        </Button>
                      </div>
                      <Separator />
                      {notes.length === 0 ? (
                        <EmptyState
                          icon={<StickyNote className="h-6 w-6" />}
                          title="Sem notas internas"
                          description="Use as notas para registrar contexto operacional importante."
                        />
                      ) : (
                        <ul className="space-y-3">
                          {notes.map((note) => (
                            <li key={note.id} className="rounded-2xl border border-border/70 bg-card p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                  {note.isPinned ? "Fixada" : "Nota"} · {formatDateTime(note.createdAt)}
                                </p>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}>
                                  Remover
                                </Button>
                              </div>
                              <p className="mt-2 text-sm">{note.body}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="media" className="space-y-4">
                  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle>Arquivos</CardTitle>
                        <CardDescription>Anexos, documentos e materiais de apoio.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label>Descrição opcional</Label>
                          <Input
                            data-testid="client-file-description"
                            value={fileDescription}
                            onChange={(e) => setFileDescription(e.target.value)}
                            placeholder="Ex.: ficha assinada, laudo, termo..."
                          />
                          <Label htmlFor="client-file-upload" className="cursor-pointer">
                            <span className="inline-flex items-center rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40">
                              {uploadingFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                              Enviar arquivo
                            </span>
                          </Label>
                          <input
                            id="client-file-upload"
                            data-testid="client-file-upload-input"
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              void handleFileUpload(file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </div>
                        <Separator />
                        {files.length === 0 ? (
                          <EmptyState
                            icon={<FileText className="h-6 w-6" />}
                            title="Sem arquivos anexados"
                            description="Uploads ficam organizados e visíveis na ficha."
                          />
                        ) : (
                          <ul className="space-y-3" data-testid="client-files-list">
                            {files.map((file) => (
                              <li
                                key={file.id}
                                data-testid="client-file-item"
                                data-file-name={file.fileName}
                                className="rounded-2xl border border-border/70 bg-card p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium">{file.fileName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatBytes(file.sizeBytes)} · {formatDateTime(file.createdAt)}
                                    </p>
                                  </div>
                                  <Button
                                    data-testid="client-file-remove"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteFile(file)}
                                  >
                                    Remover
                                  </Button>
                                </div>
                                {file.description && <p className="mt-2 text-sm text-muted-foreground">{file.description}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle>Fotos e antes/depois</CardTitle>
                        <CardDescription>Registro visual simples e profissional do cliente.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={photoType} onValueChange={(value) => setPhotoType(value as ClientPhoto["photoType"])}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">Geral</SelectItem>
                                <SelectItem value="before">Antes</SelectItem>
                                <SelectItem value="after">Depois</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Data da foto</Label>
                            <Input type="datetime-local" value={photoTakenAt} onChange={(e) => setPhotoTakenAt(e.target.value)} />
                          </div>
                        </div>
                        <Input
                          data-testid="client-photo-caption"
                          value={photoCaption}
                          onChange={(e) => setPhotoCaption(e.target.value)}
                          placeholder="Legenda opcional"
                        />
                        <Label htmlFor="client-photo-upload" className="cursor-pointer">
                          <span className="inline-flex items-center rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted/40">
                            {uploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                            Enviar foto
                          </span>
                        </Label>
                        <input
                          id="client-photo-upload"
                          data-testid="client-photo-upload-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            void handlePhotoUpload(file);
                            e.currentTarget.value = "";
                          }}
                        />
                        <Separator />
                        {photos.length === 0 ? (
                          <EmptyState
                            icon={<Camera className="h-6 w-6" />}
                            title="Sem fotos cadastradas"
                            description="Fotos de antes/depois ou de referência aparecerão aqui."
                          />
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {photos.map((photo) => (
                              <div
                                key={photo.id}
                                data-testid="client-photo-item"
                                data-photo-id={photo.id}
                                className="overflow-hidden rounded-2xl border border-border/70 bg-card"
                              >
                                <div className="aspect-[4/3] bg-muted">
                                  {photoUrls[photo.id] ? (
                                    <img src={photoUrls[photo.id]} alt={photo.caption ?? "Foto do cliente"} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="grid h-full place-items-center text-muted-foreground">
                                      <Camera className="h-6 w-6" />
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2 p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <StatusBadge tone={photo.photoType === "after" ? "success" : photo.photoType === "before" ? "warning" : "neutral"}>
                                      {photo.photoType === "before" ? "Antes" : photo.photoType === "after" ? "Depois" : "Geral"}
                                    </StatusBadge>
                                    <Button
                                      data-testid="client-photo-remove"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeletePhoto(photo)}
                                    >
                                      Remover
                                    </Button>
                                  </div>
                                  {photo.caption && <p className="text-sm">{photo.caption}</p>}
                                  <p className="text-xs text-muted-foreground">{formatDateTime(photo.takenAt || photo.createdAt)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="consents" className="space-y-4">
                  <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle>Templates de consentimento</CardTitle>
                        <CardDescription>Base inicial para formulários e termos digitais.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {canManageTemplates && (
                          <div className="space-y-2 rounded-2xl border border-border/70 p-4">
                            <Input value={templateTitle} onChange={(e) => setTemplateTitle(e.target.value)} placeholder="Título do template" />
                            <Textarea value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} rows={5} placeholder="Conteúdo do termo..." />
                            <Button onClick={handleCreateTemplate} disabled={creatingTemplate}>
                              {creatingTemplate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                              Criar template
                            </Button>
                          </div>
                        )}
                        {consentTemplates.length === 0 ? (
                          <EmptyState
                            icon={<ShieldAlert className="h-6 w-6" />}
                            title="Sem templates"
                            description="Crie os primeiros termos para assinatura digital inicial."
                          />
                        ) : (
                          <ul className="space-y-3">
                            {consentTemplates.map((template) => (
                              <li key={template.id} className="rounded-2xl border border-border/70 bg-card p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-medium">{template.title}</p>
                                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{template.body}</p>
                                  </div>
                                  <StatusBadge tone={template.isActive ? "success" : "neutral"}>
                                    v{template.version}
                                  </StatusBadge>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2">
                                  <p className="text-xs text-muted-foreground">{formatDateTime(template.createdAt)}</p>
                                  <Button size="sm" variant="outline" onClick={() => void handleCreateConsent(template.id)} disabled={creatingConsent}>
                                    Gerar pendente
                                  </Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="min-w-0">
                      <CardHeader>
                        <CardTitle>Respostas do cliente</CardTitle>
                        <CardDescription>Histórico de pendências e assinaturas já registradas.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {consentResponses.length === 0 ? (
                          <EmptyState
                            icon={<CheckCircle2 className="h-6 w-6" />}
                            title="Sem respostas registradas"
                            description="Gere um consentimento pendente para este cliente."
                          />
                        ) : (
                          <ul className="space-y-3">
                            {consentResponses.map((response) => (
                              <li key={response.id} className="rounded-2xl border border-border/70 bg-card p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">
                                    {consentTemplates.find((item) => item.id === response.templateId)?.title ?? "Template removido"}
                                  </p>
                                  <StatusBadge tone={response.status === "signed" ? "success" : response.status === "declined" ? "danger" : "warning"}>
                                    {response.status}
                                  </StatusBadge>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Criado em {formatDateTime(response.createdAt)}
                                  {response.signedAt ? ` · assinado em ${formatDateTime(response.signedAt)}` : ""}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FiltersCard({
  filters,
  setFilters,
  units,
  professionals,
  origins,
}: {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  units: Array<{ id: string; name: string }>;
  professionals: ProfessionalLite[];
  origins: string[];
}) {
  const statusLabel =
    filters.status === "all"
      ? "Todos os status"
      : filters.status === "active"
        ? "Ativo"
        : filters.status === "inactive"
          ? "Inativo"
          : "Bloqueado";
  const birthdayLabel =
    filters.birthdayMonth === "all"
      ? "Todos os meses"
      : monthLabel(Number(filters.birthdayMonth) - 1);
  const unitLabel =
    filters.preferredUnitId === "all"
      ? "Todas as unidades"
      : units.find((u) => u.id === filters.preferredUnitId)?.name ?? "Todas as unidades";
  const professionalLabel =
    filters.preferredProfessionalId === "all"
      ? "Todos os profissionais"
      : professionals.find((p) => p.id === filters.preferredProfessionalId)?.displayName ??
        "Todos os profissionais";
  const originLabel = filters.origin === "all" ? "Todas as origens" : filters.origin;

  return (
    <Card className="min-w-0 w-full max-w-full">
      <CardHeader className="px-4 pb-3 sm:px-6">
        <CardTitle className="text-base">Busca e filtros</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            placeholder="Buscar por nome, telefone ou e-mail"
            className="min-w-0 pl-9"
          />
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 [&>*]:min-w-0">
          <FilterSelectTooltip fieldLabel="Status" valueLabel={statusLabel}>
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as ClientStatus | "all" }))}>
              <SelectTrigger className="min-w-0 w-full" aria-label={`Status: ${statusLabel}`}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </FilterSelectTooltip>
          <FilterSelectTooltip fieldLabel="Aniversariantes" valueLabel={birthdayLabel}>
            <Select value={filters.birthdayMonth} onValueChange={(value) => setFilters((prev) => ({ ...prev, birthdayMonth: value }))}>
              <SelectTrigger className="min-w-0 w-full" aria-label={`Aniversariantes: ${birthdayLabel}`}>
                <SelectValue placeholder="Aniversariantes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{monthLabel(i)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSelectTooltip>
          <FilterSelectTooltip fieldLabel="Unidade preferida" valueLabel={unitLabel}>
            <Select value={filters.preferredUnitId} onValueChange={(value) => setFilters((prev) => ({ ...prev, preferredUnitId: value }))}>
              <SelectTrigger className="min-w-0 w-full" aria-label={`Unidade preferida: ${unitLabel}`}>
                <SelectValue placeholder="Unidade preferida" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSelectTooltip>
          <FilterSelectTooltip fieldLabel="Profissional preferido" valueLabel={professionalLabel}>
            <Select value={filters.preferredProfessionalId} onValueChange={(value) => setFilters((prev) => ({ ...prev, preferredProfessionalId: value }))}>
              <SelectTrigger className="min-w-0 w-full" aria-label={`Profissional preferido: ${professionalLabel}`}>
                <SelectValue placeholder="Profissional preferido" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os profissionais</SelectItem>
                {professionals.map((professional) => (
                  <SelectItem key={professional.id} value={professional.id}>{professional.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSelectTooltip>
          <FilterSelectTooltip
            fieldLabel="Origem"
            valueLabel={originLabel}
            className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
          >
            <Select value={filters.origin} onValueChange={(value) => setFilters((prev) => ({ ...prev, origin: value }))}>
              <SelectTrigger className="min-w-0 w-full" aria-label={`Origem: ${originLabel}`}>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                {origins.map((origin) => (
                  <SelectItem key={origin} value={origin}>{origin}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterSelectTooltip>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filters.vipOnly} onClick={() => setFilters((prev) => ({ ...prev, vipOnly: !prev.vipOnly }))}>VIP</FilterChip>
          <FilterChip active={filters.inactiveOnly} onClick={() => setFilters((prev) => ({ ...prev, inactiveOnly: !prev.inactiveOnly }))}>Inativos</FilterChip>
          <FilterChip active={filters.highRiskOnly} onClick={() => setFilters((prev) => ({ ...prev, highRiskOnly: !prev.highRiskOnly }))}>Risco alto</FilterChip>
          <FilterChip active={filters.needsReactivationOnly} onClick={() => setFilters((prev) => ({ ...prev, needsReactivationOnly: !prev.needsReactivationOnly }))}>Reativação</FilterChip>
        </div>
      </CardContent>
    </Card>
  );
}

function ClientHero({
  client,
  tags,
  onEdit,
  completeness,
}: {
  client: Client;
  tags: ClientTag[];
  onEdit: () => void;
  completeness: number;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-soft px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-semibold">{client.fullName}</h2>
                {client.isVip && <StatusBadge tone="warning">VIP</StatusBadge>}
                {client.needsReactivation && <StatusBadge tone="brand">Reativação</StatusBadge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {client.phone || client.whatsappPhone || client.email || "Sem contato principal"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone={client.status === "active" ? "success" : client.status === "inactive" ? "neutral" : "danger"}>
                  {clientStatusLabels[client.status]}
                </StatusBadge>
                <StatusBadge tone={client.riskLevel === "high" ? "danger" : client.riskLevel === "medium" ? "warning" : "info"}>
                  {riskLevelLabels[client.riskLevel]}
                </StatusBadge>
                {tags.map((tag) => (
                  <span key={tag.id} className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium">
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
            <div className="rounded-2xl border border-border/70 bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Completude</p>
              <div className="mt-1 flex items-end gap-1">
                <span className="font-display text-3xl">{completeness}</span>
                <span className="pb-1 text-sm text-muted-foreground">/100</span>
              </div>
            </div>
            <Button variant="outline" className="ml-auto rounded-xl lg:ml-0" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Editar ficha
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ClientForm({
  form,
  setForm,
  units,
  professionals,
  onSave,
  saving,
  saveLabel,
  selectedStatus,
  onStatusChange,
}: {
  form: ClientFormState;
  setForm: React.Dispatch<React.SetStateAction<ClientFormState>>;
  units: Array<{ id: string; name: string }>;
  professionals: ProfessionalLite[];
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  selectedStatus?: ClientStatus;
  onStatusChange?: (status: ClientStatus) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" required>
          <Input
            data-testid="client-form-full-name"
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
          />
        </Field>
        <Field label="Origem">
          <Input
            data-testid="client-form-origin"
            value={form.origin}
            onChange={(e) => setForm((prev) => ({ ...prev, origin: e.target.value }))}
          />
        </Field>
        <Field label="Telefone">
          <Input
            data-testid="client-form-phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
        </Field>
        <Field label="WhatsApp">
          <Input value={form.whatsappPhone} onChange={(e) => setForm((prev) => ({ ...prev, whatsappPhone: e.target.value }))} />
        </Field>
        <Field label="E-mail">
          <Input
            data-testid="client-form-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </Field>
        <Field label="Nascimento">
          <Input type="date" value={form.birthDate} onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))} />
        </Field>
        <Field label="Status VIP">
          <Select value={String(form.isVip)} onValueChange={(value) => setForm((prev) => ({ ...prev, isVip: value === "true" }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Cliente regular</SelectItem>
              <SelectItem value="true">VIP</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Nível de risco">
          <Select value={form.riskLevel} onValueChange={(value) => setForm((prev) => ({ ...prev, riskLevel: value as ClientRiskLevel }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixo</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="high">Alto</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {onStatusChange && (
          <Field label="Status operacional">
            <Select value={selectedStatus || "active"} onValueChange={(value) => onStatusChange(value as ClientStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Unidade preferida">
          <Select value={form.preferredUnitId} onValueChange={(value) => setForm((prev) => ({ ...prev, preferredUnitId: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem preferência</SelectItem>
              {units.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Profissional preferido">
          <Select value={form.preferredProfessionalId} onValueChange={(value) => setForm((prev) => ({ ...prev, preferredProfessionalId: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem preferência</SelectItem>
              {professionals.map((professional) => (
                <SelectItem key={professional.id} value={professional.id}>{professional.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Observações">
        <Textarea value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} rows={4} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Preferências">
          <Textarea value={form.preferences} onChange={(e) => setForm((prev) => ({ ...prev, preferences: e.target.value }))} rows={4} />
        </Field>
        <Field label="Alergias">
          <Textarea value={form.allergies} onChange={(e) => setForm((prev) => ({ ...prev, allergies: e.target.value }))} rows={4} />
        </Field>
        <Field label="Contraindicações">
          <Textarea value={form.contraindications} onChange={(e) => setForm((prev) => ({ ...prev, contraindications: e.target.value }))} rows={4} />
        </Field>
      </div>
      <Button data-testid="client-form-submit" onClick={onSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        {saveLabel}
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/40"}`}
    >
      {children}
    </button>
  );
}

function InfoItem({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string | null | undefined;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

function CustomFieldEditor({
  definition,
  value,
  onSave,
}: {
  definition: CustomFieldDefinition;
  value: unknown;
  onSave: (definitionId: string, value: unknown) => void;
}) {
  const stringValue = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);

  if (definition.fieldType === "boolean") {
    return (
      <div className="space-y-2">
        <Label>{definition.label}</Label>
        <Select value={String(value === true)} onValueChange={(next) => onSave(definition.id, next === "true")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Não</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (definition.fieldType === "select" && definition.options.length > 0) {
    return (
      <div className="space-y-2">
        <Label>{definition.label}</Label>
        <Select value={stringValue || "__empty__"} onValueChange={(next) => onSave(definition.id, next === "__empty__" ? null : next)}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__">Sem valor</SelectItem>
            {definition.options.map((option) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const isTextArea = definition.fieldType === "textarea";
  return (
    <div className="space-y-2">
      <Label>{definition.label}</Label>
      {isTextArea ? (
        <Textarea
          defaultValue={stringValue}
          rows={3}
          onBlur={(e) => onSave(definition.id, e.target.value || null)}
        />
      ) : (
        <Input
          type={definition.fieldType === "number" ? "number" : definition.fieldType === "date" ? "date" : "text"}
          defaultValue={stringValue}
          onBlur={(e) => onSave(definition.id, e.target.value || null)}
        />
      )}
    </div>
  );
}

function clientToForm(client: Client): ClientFormState {
  return {
    fullName: client.fullName,
    phone: client.phone ?? "",
    whatsappPhone: client.whatsappPhone ?? "",
    email: client.email ?? "",
    birthDate: client.birthDate ?? "",
    origin: client.origin ?? "",
    notes: client.notes ?? "",
    allergies: client.allergies ?? "",
    contraindications: client.contraindications ?? "",
    preferences: client.preferences ?? "",
    isVip: client.isVip,
    riskLevel: client.riskLevel,
    preferredUnitId: client.preferredUnitId ?? "none",
    preferredProfessionalId: client.preferredProfessionalId ?? "none",
  };
}

function formToPayload(form: ClientFormState, tenantId: string, createdBy: string, status: ClientStatus) {
  return {
    tenantId,
    createdBy,
    fullName: form.fullName.trim(),
    phone: emptyToUndefined(form.phone),
    whatsappPhone: emptyToUndefined(form.whatsappPhone),
    email: emptyToUndefined(form.email),
    birthDate: emptyToUndefined(form.birthDate),
    origin: emptyToUndefined(form.origin),
    notes: emptyToUndefined(form.notes),
    allergies: emptyToUndefined(form.allergies),
    contraindications: emptyToUndefined(form.contraindications),
    preferences: emptyToUndefined(form.preferences),
    isVip: form.isVip,
    riskLevel: form.riskLevel,
    preferredUnitId: form.preferredUnitId === "none" ? undefined : form.preferredUnitId,
    preferredProfessionalId: form.preferredProfessionalId === "none" ? undefined : form.preferredProfessionalId,
    status,
  };
}

function emptyToUndefined(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLocation(city: string | null | undefined, state: string | null | undefined) {
  const parts = [city, state].filter(Boolean);
  return parts.length ? parts.join(" / ") : "—";
}

function formatBytes(value: number | null | undefined) {
  if (!value) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function monthLabel(index: number) {
  return new Date(2026, index, 1).toLocaleDateString("pt-BR", { month: "long" });
}

function FilterSelectTooltip({
  fieldLabel,
  valueLabel,
  className,
  children,
}: {
  fieldLabel: string;
  valueLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <div className={cn("min-w-0", className)}>{children}</div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="max-w-xs">
        <span className="font-medium">{fieldLabel}:</span> {valueLabel}
      </TooltipContent>
    </Tooltip>
  );
}

function timelineIcon(type: TimelineEvent["eventType"]) {
  switch (type) {
    case "note": return <StickyNote className="h-4 w-4" />;
    case "file": return <FileText className="h-4 w-4" />;
    case "photo": return <Camera className="h-4 w-4" />;
    case "consent": return <ShieldAlert className="h-4 w-4" />;
    case "appointment": return <CalendarDays className="h-4 w-4" />;
    case "status_change": return <AlertCircle className="h-4 w-4" />;
    case "manual": return <Sparkles className="h-4 w-4" />;
    case "system": return <CheckCircle2 className="h-4 w-4" />;
    default: return <Heart className="h-4 w-4" />;
  }
}
