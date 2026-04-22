/**
 * ProvisionUserDialog — fluxo mobile-first para o Super Admin provisionar
 * (convidar) um novo usuário em qualquer tenant. Gera um convite por token
 * (team_invitations) via RPC `admin_provision_team_invitation` com auditoria.
 *
 * O usuário recebe o link `/auth/aceite-convite?token=...` (copiável e
 * abrível pelo WhatsApp manual — sem API).
 */
import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Send, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ROLES, roleLabels, type Role } from "@/domain/roles";

const ASSIGNABLE_ROLES: Role[] = ROLES.filter((r) => r !== "super_admin" && r !== "client");

interface TenantOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenants: TenantOption[];
  defaultTenantId?: string | null;
  onCreated?: () => void;
}

interface InviteResult {
  id: string;
  token: string;
  inviteUrl: string;
  email: string;
  role: Role;
}

function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/auth/aceite-convite?token=${token}`;
  return `${window.location.origin}/auth/aceite-convite?token=${token}`;
}

export function ProvisionUserDialog({ open, onOpenChange, tenants, defaultTenantId, onCreated }: Props) {
  const { toast } = useToast();
  const [tenantId, setTenantId] = useState<string>(defaultTenantId ?? tenants[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("manager");
  const [message, setMessage] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("14");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  useEffect(() => {
    if (open) {
      setTenantId(defaultTenantId ?? tenants[0]?.id ?? "");
      setEmail("");
      setRole("manager");
      setMessage("");
      setExpiresInDays("14");
      setResult(null);
    }
  }, [open, defaultTenantId, tenants]);

  const sortedTenants = useMemo(
    () => [...tenants].sort((a, b) => a.name.localeCompare(b.name)),
    [tenants],
  );

  async function handleSubmit() {
    if (!tenantId) {
      toast({ title: "Selecione um estabelecimento", variant: "destructive" });
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      toast({ title: "E-mail inválido", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_provision_team_invitation", {
        _tenant_id: tenantId,
        _email: email.trim().toLowerCase(),
        _role: role,
        _message: message.trim() || null,
        _expires_in_days: parseInt(expiresInDays, 10) || 14,
      });
      if (error) throw error;
      const created = Array.isArray(data) ? data[0] : data;
      const inviteUrl = buildInviteUrl(created.token);
      setResult({ id: created.id, token: created.token, inviteUrl, email: created.email, role: created.role });
      toast({ title: "Convite criado", description: "Copie o link abaixo e compartilhe com o usuário." });
      onCreated?.();
    } catch (err) {
      toast({
        title: "Erro ao provisionar usuário",
        description: String((err as Error)?.message ?? err),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      toast({ title: "Link copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            Provisionar usuário
          </DialogTitle>
          <DialogDescription>
            Cria um convite por e-mail (token) válido por alguns dias. O usuário aceita pelo link
            e o vínculo com o estabelecimento é criado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estabelecimento</Label>
              <Select value={tenantId} onValueChange={setTenantId} disabled={submitting}>
                <SelectTrigger data-testid="provision-tenant"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {sortedTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                disabled={submitting}
                data-testid="provision-email"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={submitting}>
                  <SelectTrigger data-testid="provision-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Expira em (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mensagem (opcional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="Bem-vindo ao time! Acesse pelo link..."
                disabled={submitting}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full" data-testid="provision-submit">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Gerar convite
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="surface-card space-y-1 p-3 text-sm">
              <p className="font-medium">{result.email}</p>
              <p className="text-xs text-muted-foreground">Papel: {roleLabels[result.role]}</p>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Link do convite</Label>
              <div className="flex gap-2">
                <Input readOnly value={result.inviteUrl} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copiar link">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Compartilhe manualmente (WhatsApp, e-mail, etc). O link aparece também na aba Membros após aceite.
              </p>
            </div>
            <Button type="button" onClick={() => onOpenChange(false)} className="w-full">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
