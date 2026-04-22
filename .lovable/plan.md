

## Correção dos erros de build (sem alterar funcionalidades)

Vou corrigir 4 grupos de erros TypeScript que estão bloqueando o build, sem mudar comportamento e preservando os testes existentes. Em seguida rodo a suíte de testes (vitest) para validar que nada regrediu.

---

### 1. Re-exportar tipos de domínio nos repositórios

`Agenda.tsx` e `Waitlist.tsx` importam `Client` e `Service` diretamente dos repositórios, mas os tipos vivem em `@/domain/*`. Solução de menor impacto: adicionar **re-exports** nos repositórios.

- `src/repositories/clients.ts` → adicionar `export type { Client } from "@/domain/client";`
- `src/repositories/catalog.ts` → adicionar `export type { Service } from "@/domain/catalog";`

Mantém os imports atuais nas páginas funcionando, sem refatorar 4 arquivos.

---

### 2. Analytics — `metrics.waitlist` inexistente

O hook `useAnalytics` expõe `waitlist` no nível raiz e só `waitlistConv` dentro de `metrics`. A página `Analytics.tsx` usa `metrics.waitlist.scheduled / metrics.waitlist.worked`.

- Em `src/features/analytics/useAnalytics.ts`, **incluir `waitlist`** dentro do objeto `metrics` retornado (mantendo também a exposição no nível raiz para compatibilidade). É um único acréscimo: `metrics: { ..., waitlist }`.

---

### 3. ConfirmationCenter — imports faltantes

`ConfirmationCenter.tsx` usa `<Separator />` e `<StatusBadge>` mas não importa nenhum dos dois.

- Adicionar no topo de `src/pages/app/ConfirmationCenter.tsx`:
  - `import { Separator } from "@/components/ui/separator";`
  - `import { StatusBadge } from "@/components/feedback/StatusBadge";`

---

### 4. Tabela `professionals` — colunas inexistentes

A tabela real só tem: `id, tenant_id, unit_id, user_id, display_name, role_title, bio, color, is_active, created_at, updated_at`. O código de import/export referencia `full_name, email, phone, specialty, commission_pct`, que **não existem** no schema atual. A escolha mais segura (sem alterar migrations) é **adequar import/export ao schema real**, mapeando:

- "Nome completo" / `fullName` → `display_name` (campo único de nome)
- "Especialidade" / `specialty` → `role_title`
- Remover campos sem coluna (`email`, `phone`, `commission_pct` no exporter / importer de equipe)

Arquivos a ajustar:

- `src/services/import-export/schemas.ts` — schema `teamImportSchema`: manter `fullName` (mapeado para display_name), substituir `specialty` por mapeamento que escreve em `role_title`, remover `email`, `phone`, `commissionPct` do schema (ou marcar como ignorados — preferimos remover para evitar promessa quebrada na UI).
- `src/services/import-export/importers.ts` (`importTeam`): payload deve usar apenas `tenant_id, display_name, role_title, is_active`. No `importAppointments`, ajustar mapa de profissionais para usar somente `display_name`.
- `src/services/import-export/exporters.ts` — simplificar `TeamExportRow` para `{ apelido_publico, especialidade, ativo }` (cabeçalhos pt-BR).
- `src/pages/app/DataImportExport.tsx` — `exportTeam` faz `select("full_name, display_name, email, phone, specialty, commission_pct, is_active")` → trocar para `select("display_name, role_title, is_active")` e mapear corretamente.
- `docs/seeds/*/team.csv` — atualizar cabeçalhos para refletir apenas as colunas suportadas (`Apelido público;Especialidade`), removendo as descontinuadas; manter linhas de exemplo coerentes.

---

### 5. Repository `portal.ts` — RPCs ausentes do `types.ts`

As RPCs `claim_portal_links_for_current_user` e `touch_portal_last_seen` **existem na migration** `20260421235500_fase5_portal_access_claims.sql`, mas o arquivo gerado `src/integrations/supabase/types.ts` está desatualizado e não as inclui. Como **NÃO devemos editar `types.ts` manualmente** (é regenerado automaticamente), a correção segura no código é usar um cast pontual:

- `supabase.rpc("claim_portal_links_for_current_user" as never)` 
- `supabase.rpc("touch_portal_last_seen" as never, { _link_id: linkId } as never)`

Comentário no código explicando que o cast some assim que os types forem regenerados.

---

### 6. Validação final

Após todas as edições:

1. Rodar `vitest run` para executar as 7 suítes (`example`, `csv`, `roles`, `scheduling`, `confirmation`, `catalog`, `client`, `analytics`).
2. Confirmar que o build TypeScript passa sem erros.
3. Entregar relatório curto: arquivos alterados, erros eliminados, status da suíte de testes.

### Não-objetivos

- Não alterar migrations.
- Não adicionar colunas em `professionals` (decisão de produto pendente).
- Não tocar em `src/integrations/supabase/types.ts` (auto-gerado).
- Não mexer em UI/UX nem em fluxos de negócio.

