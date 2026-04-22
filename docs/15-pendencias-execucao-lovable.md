# 15. Pendências Executáveis pelo Lovable

Este arquivo consolida apenas as pendências que ainda fazem sentido ser
executadas pelo **Lovable / agente de implementação**, com foco em fechar as
lacunas entre o `prompt_original.txt` e o estado atual do projeto.

> Este documento **não substitui** o
> [00-pendencias-por-fase.md](./00-pendencias-por-fase.md) nem o
> [14-checklist-pre-lancamento.md](./14-checklist-pre-lancamento.md).
> Eles continuam sendo a fonte para validação humana em ambiente real.

---

## Objetivo

Levar o projeto mais perto de **100% de aderência executável** ao prompt
original, sem reescrever a base existente e sem quebrar o que já está
funcionando.

## Regras para execução

Antes de executar qualquer bloco abaixo, o Lovable deve respeitar:

- Não recomeçar o projeto do zero.
- Trabalhar de forma incremental.
- Preservar comportamento já existente.
- Não criar módulo fiscal.
- Não usar API oficial nem não oficial do WhatsApp.
- Manter regras críticas em `services/`, `domain/`, `repositories/` e banco.
- Criar migrations incrementais quando houver mudança estrutural.
- Ao final de cada bloco, entregar:
  - arquivos alterados
  - migrations criadas
  - regras implementadas
  - pendências remanescentes
  - checklist rápido de validação manual

## Ordem recomendada

Executar nesta ordem:

1. Bloco A — Sanear ambiente de build e testes
2. Bloco B — Fechar convite real de equipe
3. Bloco C — Fechar medição e enforcement real de storage/profissionais
4. Bloco D — Fechar visão explícita por recurso/sala na agenda
5. Bloco E — Refinar analytics para aderência maior ao prompt
6. Bloco F — Alinhar divergências estruturais restantes com o prompt

---

## Bloco A — Sanear ambiente de build e testes

### Prioridade

`P0`

### Problema atual

O projeto está funcionalmente avançado, mas o workspace atual não fecha
validação básica de engenharia:

- `npm test` falha porque `vitest-axe` não está instalado.
- `npm run build` falha porque `vite-plugin-pwa` não está instalado.

### Objetivo

Restabelecer o estado mínimo esperado de engenharia:

- `npm install` coerente com `package.json`
- `npm test` verde
- `npm run build` verde

### Tarefas

1. Revisar `package.json`, lockfile e imports usados no projeto.
2. Adicionar as dependências faltantes necessárias para o estado atual do código.
3. Garantir compatibilidade entre `vite.config.ts`, testes e dependências.
4. Rodar:
   - `npm test`
   - `npm run build`
5. Corrigir qualquer quebra residual provocada por dependência ausente ou
   configuração inconsistente.

### Arquivos prováveis

- `package.json`
- `package-lock.json` ou `bun.lock`
- `vite.config.ts`
- `vitest.config.ts`

### Critérios de aceite

- `npm test` conclui sem falhas.
- `npm run build` conclui sem falhas.
- Nenhuma feature existente é removida para “fazer passar”.

---

## Bloco B — Fechar convite real de equipe

### Prioridade

`P1`

### Problema atual

O fluxo atual de convite ainda é parcial. Em
[src/services/team/inviteMember.ts](../src/services/team/inviteMember.ts)
o sistema apenas registra o convite em `audit_logs`, sem fechar um fluxo real
de aceite e materialização segura do vínculo.

### Objetivo

Implementar um fluxo real de convite de equipe compatível com o prompt:

- convite por e-mail
- aceite seguro
- criação/claim de membership
- compatível com multi-tenant e RLS

### Tarefas

1. Modelar a estrutura necessária para convite real.
   Sugestão:
   - `tenant_invitations` ou `team_invitations`
2. Criar migration incremental para:
   - tabela de convites
   - índices
   - RLS
   - funções auxiliares de aceite/claim, se necessário
3. Atualizar o fluxo de onboarding e configurações de equipe para usar essa
   estrutura em vez de apenas `audit_logs`.
4. Implementar estado mínimo do convite:
   - `pending`
   - `accepted`
   - `expired`
   - `revoked`
5. Ao aceitar o convite:
   - criar ou completar `tenant_memberships`
   - respeitar o papel convidado
   - vincular `professionals` quando aplicável
6. Registrar auditoria adequada.
7. Fechar enforcement de `max_professionals` no fluxo real de convite/aceite.

### Arquivos prováveis

- `src/services/team/inviteMember.ts`
- `src/features/settings/TeamSettings.tsx`
- `src/pages/auth/Onboarding.tsx`
- `supabase/migrations/*`

### Critérios de aceite

- Convite deixa de ser apenas log e vira entidade real.
- Existe fluxo claro de criação, leitura, cancelamento e aceite.
- O aceite cria acesso real ao tenant correto.
- O limite de profissionais passa a ser respeitado no fluxo real.

---

## Bloco C — Fechar medição e enforcement real de storage/profissionais

### Prioridade

`P1`

### Problema atual

No billing SaaS, parte do enforcement ainda está “soft”:

- `max_professionals` depende do fluxo real de convite
- `max_storage_mb` ainda depende de medição operacional do bucket

### Objetivo

Transformar limites hoje apenas informativos em limites efetivos e auditáveis.

### Tarefas

1. Consolidar `max_professionals` após o Bloco B.
2. Implementar medição real de uso de storage por tenant.
   Opções aceitáveis:
   - snapshot em tabela própria
   - job periódico
   - função SQL/edge function que calcule pelo bucket
3. Persistir o valor calculado de forma portável.
4. Exibir consumo real no app do owner.
5. Aplicar bloqueio ou warning forte quando o limite for atingido.
6. Garantir que uploads de CRM respeitem esse limite.

### Arquivos prováveis

- `src/features/billing/useTenantBilling.ts`
- `src/pages/app/Billing.tsx`
- `src/pages/app/Clients.tsx`
- `supabase/migrations/*`
- scripts/jobs auxiliares, se necessários

### Critérios de aceite

- Consumo de profissionais é real, não estimado.
- Consumo de storage é real, não manual.
- O sistema informa claramente quando o tenant atingiu o limite.
- O comportamento é compatível com override de assinatura.

---

## Bloco D — Fechar visão explícita por recurso/sala na agenda

### Prioridade

`P2`

### Problema atual

O backend e o schema já suportam `resources`, mas a aderência de UI ao prompt
fica parcial porque a agenda ainda não apresenta uma visão explícita e clara
“por recurso/sala quando aplicável”.

### Objetivo

Fechar a aderência da agenda ao prompt também na experiência de uso.

### Tarefas

1. Revisar a página [Agenda](../src/pages/app/Agenda.tsx).
2. Adicionar filtro e/ou visão explícita por recurso/sala.
3. Destacar conflitos de recurso quando o serviço exigir recurso obrigatório.
4. Melhorar a leitura operacional para recepção em mobile e desktop.
5. Manter a lógica crítica no repositório/domínio, não só na UI.

### Arquivos prováveis

- `src/pages/app/Agenda.tsx`
- `src/repositories/scheduling.ts`
- `src/domain/scheduling.ts`

### Critérios de aceite

- Usuário consegue visualizar agenda também por recurso/sala.
- Conflitos de recurso ficam visíveis.
- Não há regressão nas visões diária/semanal já existentes.

---

## Bloco E — Refinar analytics para aderência maior ao prompt

### Prioridade

`P2`

### Problema atual

O módulo atual de analytics está forte, mas ainda há diferenças para o prompt:

- o prompt fala em dashboards mais explicitamente separados por contexto
- falta visão mais clara por coorte
- a regra de serviço principal em appointments multi-item ainda pode ser refinada
- parte dos cálculos ainda pode migrar para SQL/RPC se necessário

### Objetivo

Subir a aderência analítica sem desmontar o módulo atual.

### Tarefas

1. Reorganizar a UX de analytics para explicitar pelo menos:
   - executivo
   - operacional
   - retenção / recorrência
   - confirmação / no-show
2. Adicionar visão por coorte de clientes, se ainda não estiver explícita.
3. Formalizar a regra de “serviço principal” em agendamentos multi-item.
   Sugestão:
   - tornar a estratégia configurável ou centralizada em domínio
4. Revisar pontos com cálculo pesado no frontend e mover para SQL/RPC onde
   houver risco real de escala.
5. Preservar o `Índice Cativa` e `Next Best Action`.

### Arquivos prováveis

- `src/pages/app/Analytics.tsx`
- `src/features/analytics/*`
- `src/domain/analytics.ts`
- `src/repositories/analytics.ts`
- `supabase/migrations/*` ou funções SQL, se necessário

### Critérios de aceite

- Analytics fica mais próximo da estrutura pedida no prompt.
- Há leitura clara por contexto de gestão.
- Há tratamento explícito para appointments multi-item.
- Nenhuma fórmula principal é opaca.

---

## Bloco F — Alinhar divergências estruturais restantes com o prompt

### Prioridade

`P3`

### Problema atual

Existem pequenas divergências entre o que o prompt pediu literalmente e a
modelagem atual:

- o prompt cita `roles`, mas hoje a base usa `app_role` enum +
  `permissions`/`role_permissions`
- o prompt cita `trial_rules` e `usage_limits`, mas a implementação atual
  resolve isso por `plans`, overrides e limites efetivos

### Objetivo

Decidir e fechar a aderência final:

- ou alinhar o schema literalmente ao prompt
- ou documentar formalmente a equivalência, sem retrabalho desnecessário

### Tarefas

1. Revisar se faz sentido de produto criar:
   - tabela `roles`
   - tabela `trial_rules`
   - tabela `usage_limits`
2. Se a resposta for **sim**:
   - criar migrations incrementais
   - manter compatibilidade com a base atual
3. Se a resposta for **não**:
   - documentar formalmente a equivalência entre prompt e implementação real
   - atualizar a rastreabilidade
4. Não reestruturar o projeto sem necessidade objetiva.

### Arquivos prováveis

- `docs/12-rastreabilidade-prompt.md`
- `docs/04-database.md`
- `supabase/migrations/*`

### Critérios de aceite

- A divergência deixa de estar “implícita”.
- Ou o schema fica aderente ao prompt, ou a documentação explica a equivalência.

---

## Fora do escopo deste arquivo

Os itens abaixo **não devem ser tratados como backlog principal do Lovable**,
porque dependem de ambiente real, operador humano ou produção:

- validações reais de RLS por múltiplos perfis
- testes reais de e-mail
- testes em dispositivos físicos com WhatsApp
- smoke final em produção
- validação manual de seeds e importação com dados reais

Esses itens continuam em:

- [00-pendencias-por-fase.md](./00-pendencias-por-fase.md)
- [14-checklist-pre-lancamento.md](./14-checklist-pre-lancamento.md)

---

## Definição de pronto

Este backlog só pode ser considerado fechado quando:

- os blocos `P0` e `P1` estiverem concluídos
- `npm test` estiver verde
- `npm run build` estiver verde
- as divergências estruturais relevantes estiverem resolvidas ou documentadas
- o restante das pendências estiver restrito a validação humana em ambiente real
