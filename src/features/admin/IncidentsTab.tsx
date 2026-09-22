import { useState, useEffect } from "react";
import {
  AlertCircle,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  Save,
  MessageSquare,
  History,
  Send,
  AlertTriangle,
  Info
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";

type Incident = {
  id: string;
  title: string;
  description: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

const STATUS_TEMPLATES: Record<Incident['status'], string> = {
  investigating: "Estamos investigando relatos de problemas com [NOME DO COMPONENTE]. Traremos atualizações em breve.",
  identified: "Identificamos a causa raiz do problema em [NOME DO COMPONENTE]. Nossa equipe técnica já está trabalhando na correção.",
  monitoring: "A correção foi aplicada e estamos monitorando a estabilidade do sistema. Tudo parece estar voltando ao normal.",
  resolved: "O incidente foi completamente resolvido. Todos os sistemas estão operacionais. Agradecemos a paciência."
};

export function IncidentsTab() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "investigating" as Incident['status'],
    severity: "medium" as Incident['severity']
  });

  const [updateForm, setUpdateForm] = useState({
    status: "investigating" as Incident['status'],
    message: ""
  });

  async function loadIncidents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_incidents')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setIncidents(data as Incident[]);
    setLoading(false);
  }

  useEffect(() => {
    loadIncidents();
  }, []);

  async function handleCreate() {
    if (!form.title) return;

    const { error } = await supabase
      .from('system_incidents')
      .insert([form]);

    if (error) {
      toast({ title: "Erro ao criar incidente", variant: "destructive" });
    } else {
      toast({ title: "Incidente criado com sucesso" });
      setIsDialogOpen(false);
      loadIncidents();
      setForm({ title: "", description: "", status: "investigating", severity: "medium" });
    }
  }

  const openUpdateDialog = (incident: Incident) => {
    setSelectedIncident(incident);
    setUpdateForm({
      status: incident.status,
      message: STATUS_TEMPLATES[incident.status]
    });
    setIsUpdateDialogOpen(true);
  };

  async function handleUpdateStatus() {
    if (!selectedIncident) return;

    const updates: Partial<Incident> = {
      status: updateForm.status,
      description: updateForm.message,
      updated_at: new Date().toISOString()
    };

    if (updateForm.status === 'resolved') updates.resolved_at = new Date().toISOString();

    const { error } = await supabase
      .from('system_incidents')
      .update(updates)
      .eq('id', selectedIncident.id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      toast({ title: "Status do incidente atualizado" });
      setIsUpdateDialogOpen(false);
      loadIncidents();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-primary" />
            Central de Incidentes
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Gerencie crises e comunique o status aos usuários em tempo real.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" /> Novo Incidente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Relatar Novo Incidente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título do Incidente</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ex: Instabilidade no processamento de pagamentos"
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Severidade</Label>
                  <Select
                    value={form.severity}
                    onValueChange={(v) => setForm({...form, severity: v as Incident['severity']})}
                  >
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status Inicial</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm({...form, status: v as Incident['status']})}
                  >
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investigating">Investigando</SelectItem>
                      <SelectItem value="identified">Identificado</SelectItem>
                      <SelectItem value="monitoring">Monitorando</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição / Primeira Mensagem</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Detalhes sobre o que está acontecendo..."
                  className="min-h-[120px] resize-none"
                />
              </div>
              <Button className="w-full h-11 mt-2" onClick={handleCreate}>Publicar Incidente</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : incidents.length === 0 ? (
        <div className="surface-card p-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-medium">Tudo sob controle</h3>
          <p className="text-muted-foreground">Nenhum incidente ativo ou histórico recente para exibir.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {incidents.map(inc => (
            <div key={inc.id} className={`surface-card p-0 overflow-hidden border-l-4 ${inc.status === 'resolved' ? 'border-l-success/40' : 'border-l-primary shadow-md'}`}>
              <div className="p-5">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg">{inc.title}</h3>
                      <StatusBadge tone={inc.severity === 'critical' ? 'danger' : inc.severity === 'high' ? 'warning' : 'brand'} className="text-[10px] uppercase font-bold tracking-wider">
                        {inc.severity}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(inc.created_at).toLocaleString('pt-BR')}</span>
                      {inc.status === 'resolved' && (
                        <span className="flex items-center gap-1 text-success font-medium">
                          · <CheckCircle2 className="h-3 w-3" /> Resolvido em {new Date(inc.resolved_at!).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge tone={inc.status === 'resolved' ? 'success' : 'warning'} className="h-9 px-3 text-xs uppercase font-bold">
                      {inc.status}
                    </StatusBadge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2"
                      onClick={() => openUpdateDialog(inc)}
                    >
                      <Send className="h-3.5 w-3.5" /> Atualizar Status
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                    <p className="text-sm leading-relaxed">{inc.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de Atualização Semi-Automática */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Atualizar Incidente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label>Novo Status</Label>
              <Select
                value={updateForm.status}
                onValueChange={(v: Incident['status']) => setUpdateForm({
                  status: v,
                  message: STATUS_TEMPLATES[v]
                })}
              >
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">Investigando</SelectItem>
                  <SelectItem value="identified">Identificado</SelectItem>
                  <SelectItem value="monitoring">Monitorando</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <Label>Mensagem Pública (Status Page)</Label>
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium uppercase tracking-tighter">Sugestão Automática</span>
              </div>
              <Textarea
                value={updateForm.message}
                onChange={e => setUpdateForm({...updateForm, message: e.target.value})}
                placeholder="Escreva a mensagem que aparecerá na página de status..."
                className="min-h-[140px] resize-none leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground italic flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                Dica: substitua [NOME DO COMPONENTE] pelo sistema afetado.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsUpdateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpdateStatus} className="gap-2">
                <Save className="h-4 w-4" /> Salvar e Notificar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
