/**
 * Configurações: modelos de anamnese digital.
 * O cliente responde e assina pelo portal.
 */
import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Plus, Save, Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/AuthProvider";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  deleteAnamnesisTemplate,
  listAnamnesisTemplates,
  saveAnamnesisTemplate,
  type AnamnesisQuestion,
  type AnamnesisTemplate,
} from "@/repositories/anamnesis";

interface Draft {
  id?: string;
  name: string;
  intro: string;
  active: boolean;
  questions: AnamnesisQuestion[];
}

const emptyDraft: Draft = { name: "", intro: "", active: true, questions: [] };

function newQuestion(): AnamnesisQuestion {
  return {
    id: `q_${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    type: "text",
    required: false,
  };
}

export function AnamnesisSettings() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const tenantId = currentTenant?.id ?? null;
  const [templates, setTemplates] = useState<AnamnesisTemplate[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setTemplates(await listAnamnesisTemplates(tenantId));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!tenantId) return;
    if (!draft.name.trim()) {
      toast({ title: "Dê um nome ao formulário", variant: "destructive" });
      return;
    }
    const questions = draft.questions.filter((q) => q.label.trim());
    if (questions.length === 0) {
      toast({ title: "Inclua pelo menos uma pergunta", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveAnamnesisTemplate({
        id: draft.id,
        tenantId,
        name: draft.name.trim(),
        intro: draft.intro.trim() || null,
        questions,
        active: draft.active,
        updatedBy: user?.id ?? null,
      });
      toast({ title: "Formulário salvo" });
      setDraft(emptyDraft);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast({ title: "Não foi possível salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAnamnesisTemplate(id);
      toast({ title: "Formulário removido" });
      if (draft.id === id) setDraft(emptyDraft);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast({ title: "Não foi possível remover", description: msg, variant: "destructive" });
    }
  }

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 rounded-2xl p-4">
        <header className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-display text-lg font-semibold">Anamnese digital</h2>
            <p className="text-sm text-muted-foreground">
              O cliente responde e assina pelo portal; a resposta fica na ficha dele.
            </p>
          </div>
        </header>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum formulário criado ainda.</p>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.questions.length} perguntas · {t.active ? "ativo" : "desativado"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() =>
                    setDraft({
                      id: t.id,
                      name: t.name,
                      intro: t.intro ?? "",
                      active: t.active,
                      questions: t.questions,
                    })
                  }
                >
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-[44px]"
                  aria-label={`Remover ${t.name}`}
                  onClick={() => void handleDelete(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="space-y-4 rounded-2xl p-4">
        <h3 className="font-medium">{draft.id ? "Editar formulário" : "Novo formulário"}</h3>
        <div className="space-y-1.5">
          <Label htmlFor="an-name">Nome</Label>
          <Input
            id="an-name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            className="h-11"
            placeholder="Ex.: Ficha de avaliação inicial"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="an-intro">Texto de abertura</Label>
          <Textarea
            id="an-intro"
            value={draft.intro}
            onChange={(e) => setDraft((d) => ({ ...d, intro: e.target.value }))}
            placeholder="Explique por que essas informações são importantes."
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-3">
          <p className="text-sm font-medium">Disponível para o cliente</p>
          <Switch
            checked={draft.active}
            onCheckedChange={(v) => setDraft((d) => ({ ...d, active: v }))}
            aria-label="Disponível para o cliente"
          />
        </div>

        <div className="space-y-2">
          <Label>Perguntas</Label>
          {draft.questions.map((q, i) => (
            <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
              <Input
                value={q.label}
                placeholder="Pergunta"
                className="h-11 w-full flex-1 sm:w-auto"
                aria-label={`Pergunta ${i + 1}`}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    questions: d.questions.map((x) =>
                      x.id === q.id ? { ...x, label: e.target.value } : x,
                    ),
                  }))
                }
              />
              <select
                value={q.type}
                aria-label={`Tipo da pergunta ${i + 1}`}
                className="h-11 rounded-xl border border-input bg-background px-2 text-sm"
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    questions: d.questions.map((x) =>
                      x.id === q.id
                        ? { ...x, type: e.target.value as AnamnesisQuestion["type"] }
                        : x,
                    ),
                  }))
                }
              >
                <option value="text">Texto</option>
                <option value="yesno">Sim ou não</option>
              </select>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={q.required}
                  aria-label={`Obrigatória ${i + 1}`}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({
                      ...d,
                      questions: d.questions.map((x) =>
                        x.id === q.id ? { ...x, required: v } : x,
                      ),
                    }))
                  }
                />
                Obrigatória
              </label>
              <Button
                variant="ghost"
                className="min-h-[44px]"
                aria-label={`Remover pergunta ${i + 1}`}
                onClick={() =>
                  setDraft((d) => ({ ...d, questions: d.questions.filter((x) => x.id !== q.id) }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="min-h-[44px] gap-2"
            onClick={() => setDraft((d) => ({ ...d, questions: [...d.questions, newQuestion()] }))}
          >
            <Plus className="h-4 w-4" /> Adicionar pergunta
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={saving} className="min-h-[44px] gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando…" : "Salvar formulário"}
          </Button>
          {draft.id && (
            <Button variant="ghost" className="min-h-[44px]" onClick={() => setDraft(emptyDraft)}>
              Cancelar
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
