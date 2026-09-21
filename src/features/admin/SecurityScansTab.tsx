import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitPullRequest,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";

type Scan = {
  id: string;
  created_at: string;
  source: string;
  git_ref: string | null;
  git_sha: string | null;
  pull_request: number | null;
  migrations: string[];
  critical_count: number;
  warning_count: number;
  accepted_count: number;
  report_md: string | null;
};

type Finding = {
  id: string;
  scan_id: string;
  check_id: string;
  title: string;
  severity: "critical" | "warning";
  object_name: string;
  accepted: boolean;
  accepted_reason: string | null;
};

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  warning: "Aviso",
};

function findingKey(f: Finding) {
  return `${f.check_id}:${f.object_name}`;
}

export function SecurityScansTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<Scan[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [currentId, setCurrentId] = useState<string>("");
  const [previousId, setPreviousId] = useState<string>("");

  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [migrationFilter, setMigrationFilter] = useState("");
  const [prFilter, setPrFilter] = useState("");

  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [advisorFinding, setAdvisorFinding] = useState("");
  const [advisorContext, setAdvisorContext] = useState("");
  const [advisorAnswer, setAdvisorAnswer] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: scanRows, error } = await supabase
        .from("security_scans")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const list = (scanRows ?? []) as Scan[];
      setScans(list);
      if (list.length > 0) {
        setCurrentId((prev) => prev || list[0].id);
        setPreviousId((prev) => prev || (list[1]?.id ?? ""));
      }

      if (list.length > 0) {
        const { data: findingRows, error: fErr } = await supabase
          .from("security_scan_findings")
          .select("id, scan_id, check_id, title, severity, object_name, accepted, accepted_reason")
          .in(
            "scan_id",
            list.map((s) => s.id),
          );
        if (fErr) throw fErr;
        setFindings((findingRows ?? []) as Finding[]);
      } else {
        setFindings([]);
      }
    } catch (error) {
      toast({
        title: "Não foi possível carregar o histórico",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      if (migrationFilter.trim()) {
        const needle = migrationFilter.trim().toLowerCase();
        if (!scan.migrations?.some((m) => m.toLowerCase().includes(needle))) return false;
      }
      if (prFilter.trim() && String(scan.pull_request ?? "") !== prFilter.trim()) return false;
      if (severityFilter === "critical" && scan.critical_count === 0) return false;
      if (severityFilter === "warning" && scan.warning_count === 0) return false;
      return true;
    });
  }, [scans, migrationFilter, prFilter, severityFilter]);

  const current = scans.find((s) => s.id === currentId) ?? null;
  const previous = scans.find((s) => s.id === previousId) ?? null;

  const comparison = useMemo(() => {
    const currentFindings = findings.filter(
      (f) => f.scan_id === currentId && (severityFilter === "all" || f.severity === severityFilter),
    );
    const previousFindings = findings.filter(
      (f) => f.scan_id === previousId && (severityFilter === "all" || f.severity === severityFilter),
    );
    const prevKeys = new Set(previousFindings.map(findingKey));
    const currKeys = new Set(currentFindings.map(findingKey));
    return {
      added: currentFindings.filter((f) => !prevKeys.has(findingKey(f))),
      resolved: previousFindings.filter((f) => !currKeys.has(findingKey(f))),
      kept: currentFindings.filter((f) => prevKeys.has(findingKey(f))),
    };
  }, [findings, currentId, previousId, severityFilter]);

  function openAdvisor(finding?: Finding) {
    setAdvisorAnswer("");
    setAdvisorContext("");
    setAdvisorFinding(
      finding
        ? `${finding.title} — objeto: ${finding.object_name} (checagem ${finding.check_id}, severidade ${finding.severity})`
        : "",
    );
    setAdvisorOpen(true);
  }

  async function runAdvisor() {
    if (!advisorFinding.trim()) return;
    setAdvisorLoading(true);
    setAdvisorAnswer("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/security-finding-advisor`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ finding: advisorFinding, context: advisorContext }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Falha ao gerar a análise.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const raw = line.slice(5).trim();
            if (!raw || raw === "[DONE]") continue;
            try {
              const event = JSON.parse(raw);
              if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
                answer += event.delta;
                setAdvisorAnswer(answer);
              }
            } catch {
              // ignora eventos parciais
            }
          }
        }
      }
      if (!answer.trim()) {
        setAdvisorAnswer("A IA não retornou texto para este achado. Adicione mais contexto e tente novamente.");
      }
    } catch (error) {
      toast({
        title: "Análise indisponível",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setAdvisorLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Severidade</Label>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="warning">Aviso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Migration</Label>
          <Input
            className="w-56"
            placeholder="ex.: 0002_create_security"
            value={migrationFilter}
            onChange={(e) => setMigrationFilter(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Pull request</Label>
          <Input
            className="w-32"
            placeholder="ex.: 42"
            value={prFilter}
            onChange={(e) => setPrFilter(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Atualizar
        </Button>
        <Button className="gap-2" onClick={() => openAdvisor()}>
          <Sparkles className="h-4 w-4" /> Analisar achado com IA
        </Button>
      </div>

      {scans.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma execução registrada ainda. Rode <code>npm run security:rescan</code> ou aguarde o
            próximo pull request com mudanças no banco.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Execução atual</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={currentId} onValueChange={setCurrentId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredScans.map((scan) => (
                      <SelectItem key={scan.id} value={scan.id}>
                        {new Date(scan.created_at).toLocaleString("pt-BR")} · {scan.source}
                        {scan.pull_request ? ` · PR #${scan.pull_request}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {current && <ScanSummary scan={current} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Comparar com</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={previousId} onValueChange={setPreviousId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma execução anterior" />
                  </SelectTrigger>
                  <SelectContent>
                    {scans
                      .filter((s) => s.id !== currentId)
                      .map((scan) => (
                        <SelectItem key={scan.id} value={scan.id}>
                          {new Date(scan.created_at).toLocaleString("pt-BR")} · {scan.source}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {previous && <ScanSummary scan={previous} />}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FindingGroup
              title="Novos"
              tone="critical"
              icon={<AlertTriangle className="h-4 w-4" />}
              items={comparison.added}
              onExplain={openAdvisor}
            />
            <FindingGroup
              title="Resolvidos"
              tone="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
              items={comparison.resolved}
              onExplain={openAdvisor}
            />
            <FindingGroup
              title="Persistentes"
              tone="neutral"
              icon={<ArrowRight className="h-4 w-4" />}
              items={comparison.kept}
              onExplain={openAdvisor}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Histórico de execuções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredScans.map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => setCurrentId(scan.id)}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
                    scan.id === currentId ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <span className="font-medium">
                    {new Date(scan.created_at).toLocaleString("pt-BR")}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge tone={scan.critical_count > 0 ? "danger" : "success"}>
                      {scan.critical_count} críticos
                    </StatusBadge>
                    <StatusBadge tone="warning">{scan.warning_count} avisos</StatusBadge>
                    {scan.pull_request ? (
                      <span className="inline-flex items-center gap-1">
                        <GitPullRequest className="h-3 w-3" /> #{scan.pull_request}
                      </span>
                    ) : null}
                    <span>{scan.source}</span>
                  </span>
                </button>
              ))}
              {filteredScans.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma execução corresponde aos filtros.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={advisorOpen} onOpenChange={setAdvisorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Análise de risco com IA
            </DialogTitle>
            <DialogDescription>
              Descreva o achado e o contexto. A IA explica o risco e sugere uma remediação priorizada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Achado</Label>
              <Textarea
                rows={3}
                value={advisorFinding}
                onChange={(e) => setAdvisorFinding(e.target.value)}
                placeholder="Ex.: policy permite leitura anônima na tabela clients"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contexto adicional (opcional)</Label>
              <Textarea
                rows={3}
                value={advisorContext}
                onChange={(e) => setAdvisorContext(e.target.value)}
                placeholder="Quem usa a tabela, se há dados pessoais, decisões já tomadas..."
              />
            </div>
            {advisorAnswer && (
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/40 p-3 text-sm leading-relaxed">
                {advisorAnswer}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvisorOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => void runAdvisor()} disabled={advisorLoading || !advisorFinding.trim()}>
              {advisorLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Gerar análise
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScanSummary({ scan }: { scan: Scan }) {
  return (
    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">{scan.critical_count}</span> críticos ·{" "}
        <span className="font-medium text-foreground">{scan.warning_count}</span> avisos ·{" "}
        {scan.accepted_count} aceitos
      </p>
      {scan.git_ref && <p>Branch: {scan.git_ref}</p>}
      {scan.migrations?.length > 0 && <p>Migrations: {scan.migrations.join(", ")}</p>}
    </div>
  );
}

function FindingGroup({
  title,
  tone,
  icon,
  items,
  onExplain,
}: {
  title: string;
  tone: "critical" | "success" | "neutral";
  icon: React.ReactNode;
  items: Finding[];
  onExplain: (finding: Finding) => void;
}) {
  const toneClass =
    tone === "critical"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : "text-muted-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-sm ${toneClass}`}>
          {icon} {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum item.</p>
        ) : (
          items.map((f) => (
            <div key={f.id} className="rounded-lg border border-border/60 p-2 text-xs">
              <p className="font-medium">{f.object_name}</p>
              <p className="text-muted-foreground">
                {f.title} · {SEVERITY_LABEL[f.severity] ?? f.severity}
                {f.accepted ? " · aceito" : ""}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 px-2 text-xs"
                onClick={() => onExplain(f)}
              >
                <Sparkles className="mr-1 h-3 w-3" /> Explicar risco
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
