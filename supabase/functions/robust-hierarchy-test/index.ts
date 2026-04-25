
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id é obrigatório");

    console.log(`Iniciando teste robusto para tenant: ${tenant_id}`);

    // 1. Validar Isolamento (RLS)
    // Tentamos buscar dados de outro tenant usando um mock de política se fosse possível, 
    // mas aqui validaremos a contagem de registros vinculados.
    const { count: clientsCount } = await admin
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id);

    const { count: membersCount } = await admin
      .from("tenant_memberships")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id);

    // 2. Simular Fluxo de Agendamento Cruzado (Hierarquia)
    // Profissional -> Cliente -> Serviço
    const { data: pro } = await admin.from("professionals").select("id").eq("tenant_id", tenant_id).limit(1).single();
    const { data: client } = await admin.from("clients").select("id").eq("tenant_id", tenant_id).limit(1).single();
    const { data: service } = await admin.from("services").select("id").eq("tenant_id", tenant_id).limit(1).single();
    const { data: unit } = await admin.from("units").select("id").eq("tenant_id", tenant_id).limit(1).single();

    if (!pro || !client || !service || !unit) {
      return new Response(JSON.stringify({ 
        status: "incomplete", 
        message: "Faltam entidades básicas para completar o teste de relacionamento.",
        details: { pro: !!pro, client: !!client, service: !!service, unit: !!unit }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Teste de Concorrência Forte (Múltiplos agendamentos simultâneos)
    const startTime = new Date();
    startTime.setHours(14, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

    const appointmentData = {
      tenant_id,
      unit_id: unit.id,
      client_id: client.id,
      professional_id: pro.id,
      starts_at: startTime.toISOString(),
      ends_at: endTime.toISOString(),
      duration_minutes: 30,
      status: "confirmed"
    };

    console.log("Disparando 5 tentativas simultâneas para o mesmo slot...");
    
    // Tentamos disparar 5 inserts em paralelo. 
    // Em um sistema robusto com restrições de exclusão (EXCLUDE no Postgres), apenas 1 deve passar.
    const attempts = Array.from({ length: 5 }).map(() => 
      admin.from("appointments").insert(appointmentData).select()
    );

    const results = await Promise.all(attempts);
    
    const successes = results.filter(r => !r.error).length;
    const failures = results.filter(r => r.error).length;

    // Limpeza dos sucessos
    for (const res of results) {
      if (res.data && res.data[0]) {
        await admin.from("appointments").delete().eq("id", res.data[0].id);
      }
    }

    return new Response(JSON.stringify({
      status: successes === 1 ? "success" : "warning",
      metrics: {
        clients: clientsCount,
        members: membersCount,
        concurrency: {
          total_attempts: 5,
          successes,
          failures,
          integrity_kept: successes === 1 
            ? "SIM (Apenas 1 agendamento permitido no slot)" 
            : `NÃO (${successes} agendamentos permitidos - requer revisão de índices de exclusão)`
        }
      }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ status: "error", message: err.message || "Erro desconhecido" }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
