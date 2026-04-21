/**
 * Tela de Importação e Exportação de dados.
 *
 * Fluxo de importação (4 passos):
 *   1. Escolher entidade (clientes, serviços, equipe, pacotes, agendamentos)
 *   2. Anexar CSV
 *   3. Mapear colunas (auto + ajuste manual) e prévia das primeiras linhas
 *   4. Confirmar e gravar (em chunks). Erros listados por linha.
 *
 * Exportações: clientes, serviços, agendamentos e métricas — em CSV ou JSON.
 *
 * Notas de portabilidade:
 *  - O parser CSV é interno (sem libs externas).
 *  - A persistência usa repositories existentes — trocar de backend não exige
 *    reescrever esta tela.
 */
import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shell/PageHeader";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { parseCsv, downloadFile, downloadJson } from "@/utils/csv";
import {
  importSchemas,
  autoMapHeaders,
  buildPreview,
  type ImportSchema,
  type ValidationError,
} from "@/services/import-export/schemas";
import {
  importClients,
  importServices,
  importPackages,
  importTeam,
  type ImportRunResult,
} from "@/services/import-export/importers";
import {
  exportClientsCsv,
  exportServicesCsv,
  exportAppointmentsCsv,
  exportMetricsCsv,
  buildClientRows,
  buildServiceRows,
  buildAppointmentRows,
} from "@/services/import-export/exporters";
import { listClients } from "@/repositories/clients";
import { listServices, listBasePrices } from "@/repositories/catalog";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type EntityKey = keyof typeof importSchemas;

const ENTITY_OPTIONS: Array<{ key: EntityKey; label: string }> = [
  { key: "clients", label: "Clientes" },
  { key: "services", label: "Serviços" },
  { key: "team", label: "Equipe" },
  { key: "packages", label: "Pacotes & Protocolos" },
  { key: "appointments", label: "Agendamentos" },
];

export default function DataImportExport() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const tenantId = currentTenant?.id;

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      <PageHeader
        title="Importar & Exportar"
        description="Migre dados de outras ferramentas e leve seus dados embora a qualquer momento."
      />

      {!tenantId ? (
        <Alert>
          <AlertTitle>Sem contexto de negócio</AlertTitle>
          <AlertDescription>Selecione um negócio para usar import/export.</AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="import" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="import">
              <Upload className="mr-2 h-4 w-4" /> Importar
            </TabsTrigger>
            <TabsTrigger value="export">
              <Download className="mr-2 h-4 w-4" /> Exportar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <ImportPanel tenantId={tenantId} userId={user?.id ?? ""} />
          </TabsContent>

          <TabsContent value="export">
            <ExportPanel tenantId={tenantId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// =============================================================================
// IMPORT
// =============================================================================
function ImportPanel({ tenantId, userId }: { tenantId: string; userId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entity, setEntity] = useState<EntityKey>("clients");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Array<Record<string, string>>>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ImportRunResult | null>(null);

  const schema: ImportSchema = importSchemas[entity];

  const preview = useMemo(() => {
    if (records.length === 0) return null;
    return buildPreview(records.slice(0, 8), schema, mapping);
  }, [records, schema, mapping]);

  const fullValidation = useMemo(() => {
    if (records.length === 0) return null;
    return buildPreview(records, schema, mapping);
  }, [records, schema, mapping]);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      setHeaders(parsed.headers);
      setRecords(parsed.records);
      setMapping(autoMapHeaders(parsed.headers, schema));
      setResult(null);
    };
    reader.readAsText(file, "utf-8");
  }

  function changeEntity(next: EntityKey) {
    setEntity(next);
    setHeaders([]);
    setRecords([]);
    setMapping({});
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runImport() {
    if (!fullValidation) return;
    if (fullValidation.errors.length > 0) {
      toast({
        title: "Corrija os erros antes de importar",
        description: `${fullValidation.errors.length} erros encontrados.`,
        variant: "destructive",
      });
      return;
    }
    setRunning(true);
    try {
      let res: ImportRunResult;
      switch (entity) {
        case "clients":
          res = await importClients(fullValidation.rows, { tenantId, createdBy: userId });
          break;
        case "services":
          res = await importServices(fullValidation.rows, { tenantId });
          break;
        case "packages":
          res = await importPackages(fullValidation.rows, { tenantId });
          break;
        case "team":
          res = await importTeam(fullValidation.rows, { tenantId });
          break;
        case "appointments":
          toast({
            title: "Indisponível neste momento",
            description:
              "Importação de agendamentos requer mapeamento de IDs e está liberada via suporte para migrações guiadas.",
          });
          setRunning(false);
          return;
        default:
          throw new Error("Entidade não suportada.");
      }
      setResult(res);
      toast({
        title: "Importação concluída",
        description: `${res.inserted} registros inseridos, ${res.failed} falharam.`,
      });
    } catch (err) {
      toast({
        title: "Falha na importação",
        description: err instanceof Error ? err.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. O que você quer importar?</CardTitle>
          <CardDescription>{schema.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-sm">
            <Label>Tipo de dado</Label>
            <Select value={entity} onValueChange={(v) => changeEntity(v as EntityKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((o) => (
                  <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            {schema.fields.map((f) => (
              <Badge key={f.key} variant={f.required ? "default" : "secondary"}>
                {f.label}{f.required ? " *" : ""}
              </Badge>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadFile(`modelo_${entity}.csv`, buildTemplateCsv(schema))}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Baixar modelo CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Anexar arquivo CSV</CardTitle>
          <CardDescription>UTF-8, separador vírgula ou ponto-e-vírgula.</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
          />
          {headers.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {headers.length} colunas detectadas, {records.length} linhas.
            </p>
          )}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Mapear colunas</CardTitle>
            <CardDescription>
              Tentamos mapear automaticamente. Ajuste se necessário. Colunas obrigatórias estão marcadas com *.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {schema.fields.map((field) => (
              <div key={field.key} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                <Label className="sm:col-span-1">
                  {field.label} {field.required && <span className="text-destructive">*</span>}
                </Label>
                <div className="sm:col-span-2">
                  <Select
                    value={mapping[field.key] ?? "__none__"}
                    onValueChange={(v) =>
                      setMapping((m) => ({ ...m, [field.key]: v === "__none__" ? null : v }))
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Não importar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Não importar —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>4. Prévia & validação</CardTitle>
            <CardDescription>
              Mostrando até 8 linhas. Erros bloqueiam a importação completa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fullValidation && fullValidation.errors.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{fullValidation.errors.length} erros encontrados</AlertTitle>
                <AlertDescription>
                  <ScrollArea className="mt-2 h-32">
                    <ul className="space-y-1 text-xs">
                      {fullValidation.errors.slice(0, 50).map((e, i) => (
                        <li key={i}>
                          Linha {e.rowIndex + 2} — <strong>{e.field}</strong>: {e.message}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Tudo validado</AlertTitle>
                <AlertDescription>
                  {records.length} registros prontos para importar.
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea className="max-h-72 rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    {schema.fields.map((f) => (
                      <th key={f.key} className="px-2 py-1 text-left">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className="border-t">
                      {schema.fields.map((f) => (
                        <td key={f.key} className="px-2 py-1">{String(r[f.key] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>

            <Separator />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                onClick={runImport}
                disabled={running || (fullValidation?.errors.length ?? 0) > 0}
              >
                {running ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Importar {records.length} registros
                  </>
                )}
              </Button>
            </div>

            {result && (
              <Alert variant={result.failed > 0 ? "destructive" : "default"}>
                <AlertTitle>Resultado</AlertTitle>
                <AlertDescription>
                  Inseridos: <strong>{result.inserted}</strong> · Falharam: <strong>{result.failed}</strong>
                  {result.errors.length > 0 && (
                    <ul className="mt-2 list-disc pl-4 text-xs">
                      {result.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>Lote {e.rowIndex}: {e.message}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function buildTemplateCsv(schema: ImportSchema): string {
  const headers = schema.fields.map((f) => f.label);
  return "\ufeff" + headers.join(",") + "\r\n";
}

// =============================================================================
// EXPORT
// =============================================================================
function ExportPanel({ tenantId }: { tenantId: string }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function exportClients(format: "csv" | "json") {
    setBusy("clients-" + format);
    try {
      const clients = await listClients({ tenantId, limit: 5000 });
      const filename = `clientes_${dateStamp()}.${format}`;
      if (format === "csv") downloadFile(filename, exportClientsCsv(clients));
      else downloadJson(filename, buildClientRows(clients));
      toast({ title: "Exportação concluída", description: `${clients.length} clientes.` });
    } finally {
      setBusy(null);
    }
  }

  async function exportServices(format: "csv" | "json") {
    setBusy("services-" + format);
    try {
      const services = await listServices({ tenantId });
      const priceMap = await listBasePrices(tenantId);
      const cents = new Map<string, number>();
      priceMap.forEach((p, k) => cents.set(k, p.amountCents));
      const filename = `servicos_${dateStamp()}.${format}`;
      if (format === "csv") downloadFile(filename, exportServicesCsv(services, cents));
      else downloadJson(filename, buildServiceRows(services, cents));
      toast({ title: "Exportação concluída", description: `${services.length} serviços.` });
    } finally {
      setBusy(null);
    }
  }

  async function exportAppointments(format: "csv" | "json") {
    setBusy("appts-" + format);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, tenant_id, unit_id, client_id, professional_id, resource_id, cancellation_policy_id, status, source, starts_at, ends_at, duration_minutes, buffer_before_minutes, buffer_after_minutes, is_walk_in, is_overbooked, total_price_cents, notes, internal_notes, confirmed_at, reminded_at, arrived_at, started_at, completed_at, canceled_at, no_show_at, canceled_reason, created_at, updated_at",
        )
        .eq("tenant_id", tenantId)
        .order("starts_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const appts = (data ?? []).map((a) => ({
        id: a.id,
        tenantId: a.tenant_id,
        unitId: a.unit_id,
        clientId: a.client_id,
        professionalId: a.professional_id,
        resourceId: a.resource_id,
        cancellationPolicyId: a.cancellation_policy_id,
        status: a.status,
        source: a.source,
        startsAt: a.starts_at,
        endsAt: a.ends_at,
        durationMinutes: a.duration_minutes,
        bufferBeforeMinutes: a.buffer_before_minutes,
        bufferAfterMinutes: a.buffer_after_minutes,
        isWalkIn: a.is_walk_in,
        isOverbooked: a.is_overbooked,
        totalPriceCents: a.total_price_cents,
        notes: a.notes,
        internalNotes: a.internal_notes,
        confirmedAt: a.confirmed_at,
        remindedAt: a.reminded_at,
        arrivedAt: a.arrived_at,
        startedAt: a.started_at,
        completedAt: a.completed_at,
        canceledAt: a.canceled_at,
        noShowAt: a.no_show_at,
        canceledReason: a.canceled_reason,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));
      const filename = `agendamentos_${dateStamp()}.${format}`;
      if (format === "csv") downloadFile(filename, exportAppointmentsCsv(appts));
      else downloadJson(filename, buildAppointmentRows(appts));
      toast({ title: "Exportação concluída", description: `${appts.length} agendamentos.` });
    } catch (err) {
      toast({
        title: "Falha ao exportar",
        description: err instanceof Error ? err.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  }

  async function exportMetrics() {
    setBusy("metrics");
    try {
      // métricas resumo: contadores por entidade
      const [clients, services, appts] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      ]);
      const rows = [
        { metrica: "Clientes cadastrados", valor: clients.count ?? 0, unidade: "clientes" },
        { metrica: "Serviços ativos", valor: services.count ?? 0, unidade: "serviços" },
        { metrica: "Agendamentos totais", valor: appts.count ?? 0, unidade: "agendamentos" },
      ];
      downloadFile(`metricas_${dateStamp()}.csv`, exportMetricsCsv(rows));
      toast({ title: "Métricas exportadas" });
    } finally {
      setBusy(null);
    }
  }

  const items: Array<{
    title: string;
    description: string;
    onCsv: () => void;
    onJson?: () => void;
    keyId: string;
  }> = [
    {
      title: "Clientes",
      description: "Toda a base de clientes ativos e inativos.",
      onCsv: () => exportClients("csv"),
      onJson: () => exportClients("json"),
      keyId: "clients",
    },
    {
      title: "Serviços",
      description: "Catálogo completo com preços base.",
      onCsv: () => exportServices("csv"),
      onJson: () => exportServices("json"),
      keyId: "services",
    },
    {
      title: "Agendamentos",
      description: "Últimos 5 mil agendamentos do negócio.",
      onCsv: () => exportAppointments("csv"),
      onJson: () => exportAppointments("json"),
      keyId: "appts",
    },
    {
      title: "Métricas resumo",
      description: "Totais consolidados — para auditoria/migração.",
      onCsv: () => exportMetrics(),
      keyId: "metrics",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <Card key={it.keyId}>
          <CardHeader>
            <CardTitle className="text-base">{it.title}</CardTitle>
            <CardDescription>{it.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={it.onCsv}
              disabled={busy === it.keyId + "-csv" || busy === it.keyId}
            >
              {(busy === it.keyId + "-csv" || busy === it.keyId) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              CSV
            </Button>
            {it.onJson && (
              <Button
                size="sm"
                variant="outline"
                onClick={it.onJson}
                disabled={busy === it.keyId + "-json"}
              >
                {busy === it.keyId + "-json" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                JSON
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
