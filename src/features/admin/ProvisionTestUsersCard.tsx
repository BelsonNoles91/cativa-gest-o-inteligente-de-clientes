/**
 * ProvisionTestUsersCard — cria contas demo (owner/manager/frontdesk/professional/client)
 * para o tenant atualmente selecionado. Visível apenas para super admin.
 *
 * Chama a edge function `admin-provision-test-users` (Service Role) que:
 *  - cria/atualiza usuários no Auth com email confirmado
 *  - garante membership ativo no tenant
 *  - para professional, cria registro em `professionals`
 *  - para client, cria registro em `clients` + vínculo em `client_users`
 */
import { useState } from "react";
import { Loader2, Sparkles, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { supabase } from "@/integrations/supabase/client";

interface ProvisionedAccount {
  role: string;
  email: string;
  user_id: string;
  status: "created" | "existing";
  password_set: boolean;
  notes?: string;
}

interface Response {
  tenant: { id: string; slug: string; name: string };
  password: string;
  accounts: ProvisionedAccount[];
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  frontdesk: "Recepção",
  professional: "Profissional",
  client: "Cliente (portal)",
};

export function ProvisionTestUsersCard() {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [password, setPassword] = useState("Cativa@2026");
  const [domain, setDomain] = useState("cativa.test");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Response | null>(null);

  const run = async () => {
    if (!currentTenant) {
      toast({ title: "Selecione um tenant primeiro", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke<Response>(
        "admin-provision-test-users",
        { body: { tenant_id: currentTenant.id, password, email_domain: domain } },
      );
      if (error) throw error;
      if (!data) throw new Error("Resposta vazia");
      setResult(data);
      toast({
        title: "Contas provisionadas",
        description: `${data.accounts.length} contas no tenant ${data.tenant.name}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado";
      toast({ title: "Falha ao provisionar", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado" });
  };

  return (
    <Card className="border-dashed border-primary/40 bg-primary/5">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle>Contas de teste por perfil</CardTitle>
            <CardDescription>
              Cria contas demo (owner, manager, frontdesk, professional, client) para o tenant
              atual <strong>{currentTenant?.name ?? "—"}</strong>. Idempotente: se já existirem,
              apenas garante o vínculo e reseta a senha.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="prov-pwd">Senha padrão</Label>
            <Input
              id="prov-pwd"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prov-domain">Domínio dos e-mails</Label>
            <Input
              id="prov-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="cativa.test"
            />
          </div>
        </div>

        <Button
          onClick={run}
          disabled={loading || !currentTenant}
          className="w-full sm:w-auto"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Provisionar contas
        </Button>

        {result && (
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <p className="text-sm font-medium">
              Tenant: {result.tenant.name} • Senha:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{result.password}</code>
            </p>
            <ul className="space-y-1.5">
              {result.accounts.map((acc) => (
                <li
                  key={acc.role}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-background px-2.5 py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {acc.notes ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                    <span className="font-medium">{ROLE_LABELS[acc.role] ?? acc.role}</span>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{acc.email}</code>
                    <span className="text-xs text-muted-foreground">
                      {acc.status === "created" ? "criado" : "atualizado"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(`${acc.email} / ${result.password}`)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copiar
                  </Button>
                  {acc.notes && (
                    <p className="w-full text-xs text-destructive">{acc.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
