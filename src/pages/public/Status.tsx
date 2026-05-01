import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { PremiumHeader } from "@/components/marketing/layout/PremiumHeader";
import { PremiumFooter } from "@/components/marketing/layout/PremiumFooter";

type ComponentStatus = {
  id: string;
  component_name: string;
  status: 'operational' | 'degraded' | 'partial_outage' | 'major_outage';
  last_updated: string;
};

type Incident = {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export default function StatusPage() {
  const [components, setComponents] = useState<ComponentStatus[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      const [{ data: compData }, { data: incData }] = await Promise.all([
        supabase.from('system_status').select('*').order('component_name'),
        supabase.from('system_incidents').select('*').order('created_at', { ascending: false }).limit(10)
      ]);
      
      if (compData) setComponents(compData as ComponentStatus[]);
      if (incData) setIncidents(incData as Incident[]);
      setLoading(false);
    }
    loadStatus();
  }, []);

  const overallStatus = components.every(c => c.status === 'operational') 
    ? 'operational' 
    : components.some(c => c.status === 'major_outage') 
      ? 'major_outage' 
      : 'degraded';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PremiumHeader />
      
      <main className="flex-1 container max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 text-primary text-sm font-medium mb-4">
            <Globe className="h-4 w-4" />
            Status do Sistema
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold mb-4">
            {overallStatus === 'operational' ? 'Todos os sistemas operacionais' : 'Estamos enfrentando instabilidades'}
          </h1>
          <p className="text-muted-foreground">
            Acompanhe em tempo real a saúde da plataforma Cativa.
          </p>
        </div>

        <section className="surface-card p-6 md:p-8 mb-8">
          <div className="grid gap-6 md:grid-cols-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse bg-muted rounded-xl" />
              ))
            ) : (
              components.map(comp => (
                <div key={comp.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/50">
                  <span className="font-medium text-sm">{comp.component_name}</span>
                  <StatusBadge tone={comp.status === 'operational' ? 'success' : comp.status === 'major_outage' ? 'danger' : 'warning'}>
                    {comp.status === 'operational' ? 'Operacional' : comp.status === 'major_outage' ? 'Fora do ar' : 'Instável'}
                  </StatusBadge>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Incidentes Recentes
          </h2>
          
          {incidents.length === 0 ? (
            <div className="surface-card p-12 text-center text-muted-foreground">
              Nenhum incidente registrado nos últimos dias.
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map(inc => (
                <div key={inc.id} className="surface-card p-5 border-l-4 border-l-primary/40">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{inc.title}</h3>
                    <StatusBadge tone={inc.status === 'resolved' ? 'success' : 'warning'}>
                      {inc.status}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{inc.description}</p>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span>Início: {new Date(inc.created_at).toLocaleString('pt-BR')}</span>
                    {inc.resolved_at && <span>Resolvido: {new Date(inc.resolved_at).toLocaleString('pt-BR')}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <PremiumFooter />
    </div>
  );
}
