import { useState, useEffect } from "react";
import { AlertCircle, Plus, Loader2, Clock, CheckCircle2, Save } from "lucide-react";
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
  resolved_at: string | null;
};

export function IncidentsTab() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    title: "",
    description: "",
    status: "investigating" as Incident['status'],
    severity: "medium" as Incident['severity']
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

  async function updateStatus(id: string, status: Incident['status']) {
    const updates: any = { status };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('system_incidents')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    } else {
      loadIncidents();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-primary" />
          Gerenciamento de Incidentes
        </h2>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Incidente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Relatar Novo Incidente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input 
                  value={form.title} 
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ex: Instabilidade no processamento de pagamentos"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea 
                  value={form.description} 
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Detalhes sobre o que está acontecendo..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Severidade</Label>
                  <Select 
                    value={form.severity} 
                    onValueChange={(v: any) => setForm({...form, severity: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                    onValueChange={(v: any) => setForm({...form, status: v})}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investigating">Investigando</SelectItem>
                      <SelectItem value="identified">Identificado</SelectItem>
                      <SelectItem value="monitoring">Monitorando</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="w-full mt-4" onClick={handleCreate}>Criar Incidente</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : incidents.length === 0 ? (
        <div className="surface-card p-12 text-center text-muted-foreground">Nenhum incidente ativo ou recente.</div>
      ) : (
        <div className="grid gap-4">
          {incidents.map(inc => (
            <div key={inc.id} className="surface-card p-5 border-l-4 border-l-primary/20">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{inc.title}</h3>
                  <div className="flex gap-3 mt-1">
                    <StatusBadge tone={inc.severity === 'critical' ? 'danger' : inc.severity === 'high' ? 'warning' : 'brand'}>
                      {inc.severity}
                    </StatusBadge>
                    <StatusBadge tone={inc.status === 'resolved' ? 'success' : 'warning'}>
                      {inc.status}
                    </StatusBadge>
                  </div>
                </div>
                <div className="flex gap-2">
                  {inc.status !== 'resolved' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 text-success hover:text-success"
                      onClick={() => updateStatus(inc.id, 'resolved')}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Marcar Resolvido
                    </Button>
                  )}
                  <Select 
                    value={inc.status} 
                    onValueChange={(v: any) => updateStatus(inc.id, v)}
                  >
                    <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="investigating">Investigando</SelectItem>
                      <SelectItem value="identified">Identificado</SelectItem>
                      <SelectItem value="monitoring">Monitorando</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{inc.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground border-t border-border/50 pt-4">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Criado em: {new Date(inc.created_at).toLocaleString('pt-BR')}</span>
                {inc.resolved_at && <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> Resolvido em: {new Date(inc.resolved_at).toLocaleString('pt-BR')}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}