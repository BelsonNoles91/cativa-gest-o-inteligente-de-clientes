# Planejamento de fechamento da implementação

> Baseado na comparação entre [prompt_original.txt](../prompt_original.txt) e o estado atual do projeto em 24/04/2026.

## Objetivo

Levar o projeto do estado atual de alta aderência funcional ao prompt para um
estado de prontidão operacional, com fechamento dos gaps que ainda impedem uma
entrega considerada completa.

## Fase atual

| Frente atual | Status | Completude | Leitura objetiva |
| --- | --- | ---: | --- |
| Frente 6 — Validação integrada dos fluxos críticos | Em validação operacional final com bloqueios técnicos parciais | 99% | Infra local, baseline pública, preflight autenticado, login real do usuário owner, matriz de contas QA por papel, smoke autenticada multi-rota e trilha visual autenticada crítica no perfil `iphone-14-portrait` já estão validados. A suíte `public-routes.spec.ts` das quatro rotas autenticadas também já passou integralmente em `iphone-se`, `iphone-14-landscape` e `ipad-portrait` na trilha preview-crítica. Em 24/04/2026, o bucket real `client-media`, o CRM de anexos, o portal de autoagendamento, a troca de contexto de unidade, o bloqueio de limite de unidades e o round-trip de import/export de clientes, serviços e equipe foram validados contra Supabase real. O fluxo de convite assistido recebeu E2E e correção de migration, mas a validação remota está bloqueada até aplicar a migration que corrige a RPC `create_team_invitation`. O bloqueio visual segue concentrado em `android-360-portrait`; as validações restantes dependem de e-mail real de cliente final, aplicação da migration de convite, limites extremos adicionais, onboarding completo com conta nova, expansão de import/export para pacotes/agendamentos e conferência humana de RLS/dispositivo. |

## Resumo executivo

| Bloco | Completude | Status | Leitura executiva |
| --- | ---: | --- | --- |
| Regras fixas e arquitetura obrigatória | 91% | Forte | Base arquitetural aderente; faltam validações finais de operação. |
| Etapa 1 — Fundação visual e estrutura | 96% | Forte | Estrutura, navegação e fundação visual consolidadas. |
| Etapa 2 — Auth, multi-tenant e permissões | 90% | Forte | Fluxo principal implementado; há diferenças pontuais de modelagem vs prompt. |
| Etapa 3 — CRM de clientes | 93% | Forte | Módulo maduro e próximo do objetivo final. |
| Etapa 4 — Catálogo, preços, pacotes e memberships | 92% | Forte | Bloco amplamente coberto; precisa de calibração fina. |
| Etapa 5 — Agenda e motor de agendamento | 92% | Forte | Núcleo sólido com visão explícita por recurso/sala. |
| Etapa 6 — Central de confirmação | 92% | Forte | Aderente às regras de operação manual. |
| Etapa 7 — Portal do cliente | 91% | Forte | Fluxos centrais presentes; precisa de validação integrada final. |
| Etapa 8 — Dashboards, métricas e Índice Cativa | 90% | Forte | Analytics forte e agora separado por contexto executivo, operacional e retenção. |
| Etapa 9 — Super admin, planos, trials e limites | 90% | Forte | Gestão robusta com consumo real de storage no app; resta alinhamento literal de modelagem. |
| Etapa 10 — Import/export, portabilidade, segurança e docs | 93% | Parcial avançado | Round-trip real de clientes, serviços e equipe validado por E2E; restam expansão para pacotes, agendamentos e validação humana de portabilidade completa. |
| Etapa 11 — Landing e planos públicos | 95% | Forte | Página pública madura e quase final. |

## Prioridades de execução

### Frente 1 — Sanear ambiente e validação técnica final

**Prioridade:** P0  
**Meta:** fazer o projeto voltar a fechar `test` e `build` no workspace atual.  
**Status:** concluído em 23/04/2026.

**Resultado**
- Dependências normalizadas no workspace.
- `npm test` passando com 321 testes.
- `npm run build` concluindo com geração do bundle e PWA.

**Tarefas**
1. Validar `package.json`, lockfile e consistência real do `node_modules`.
2. Reinstalar ou normalizar dependências de teste e build.
3. Rodar `npm test`.
4. Rodar `npm run build`.
5. Registrar a baseline de validação no repositório.

**Critério de aceite**
- `npm test` executando sem falhas.
- `npm run build` concluindo sem erro.
- Documento de pendências atualizado para refletir o resultado real.

### Frente 2 — Fechar gaps de aderência literal ao prompt

**Prioridade:** P1  
**Meta:** reduzir a distância entre a solução implementada e a estrutura explicitamente pedida no prompt.
**Status:** concluído em 23/04/2026 no escopo documental e de rastreabilidade.

**Gaps atuais**
- O prompt descreve `roles` como tabela; o projeto usa `app_role` + permissões.
- O prompt cita estruturas literais de trial/usage; o projeto implementa lógica equivalente com outra modelagem.
- Parte da documentação de pendências ainda retrata gaps já resolvidos no código.

**Tarefas**
1. Revisar a rastreabilidade bloco a bloco.
2. Decidir o que será mantido como divergência intencional e o que precisa convergir.
3. Atualizar documentação para refletir o estado real do código.
4. Marcar explicitamente as divergências aceitáveis de arquitetura.

**Critério de aceite**
- Toda divergência relevante entre prompt e implementação está classificada como:
  `implementado`, `implementado com adaptação` ou `pendente`.
- Não existem docs operacionais contradizendo o código atual.

### Frente 3 — Billing, planos e enforcement real de limites

**Prioridade:** P1  
**Meta:** tornar o controle de limites operacionalmente confiável.  
**Status:** parcialmente concluído em 23/04/2026.

**Avanços já fechados**
- O consumo exibido no app agora usa `tenant_storage_bytes_used(...)`.
- Uploads do CRM fazem bloqueio preventivo contra estouro do plano.
- O hard-limit do banco segue como proteção final.

**Tarefas**
1. Validar limites de membros, unidades e storage com cenários reais.
2. Garantir mensagens claras de bloqueio e estado de plano em todos os fluxos restantes.

**Critério de aceite**
- O uso exibido no produto corresponde ao uso real persistido.
- Limites de plano são bloqueados de forma previsível.
- O super admin e o tenant owner enxergam o mesmo estado de consumo.

### Frente 4 — Agenda: visão por recurso/sala e acabamento operacional

**Prioridade:** P1  
**Meta:** fechar o bloco de agenda na forma pedida pelo prompt.  
**Status:** parcialmente concluído em 23/04/2026.

**Avanços já fechados**
- A agenda agora permite visualização explícita agrupada por recurso/sala.
- O filtro por recurso foi incorporado à operação da tela.

**Tarefas**
1. Validar conflito, disponibilidade e bloqueio nesse contexto em banco real.
2. Ajustar detalhes finos de navegação e operação mobile, se necessário.

**Critério de aceite**
- Usuário consegue operar agenda por profissional e por recurso sem ambiguidade.
- Conflitos e bloqueios respeitam recurso/sala em todos os fluxos.

### Frente 5 — Analytics: separar contexto executivo, operacional e de retenção

**Prioridade:** P1  
**Meta:** alinhar o módulo analítico à leitura estratégica descrita no prompt.  
**Status:** parcialmente concluído em 23/04/2026.

**Avanços já fechados**
- O conteúdo analítico foi separado em visões `Executivo`, `Operacional` e `Retenção`.
- Coortes principais de retorno ficaram mais explícitas na experiência.

**Tarefas**
1. Avaliar necessidade de aprofundar coorte/funil/tendência com visualizações adicionais.
2. Validar a leitura com uso real e ajustar priorização dos blocos.

**Critério de aceite**
- Há leitura clara para operação diária e para gestão.
- O Índice Cativa continua consistente com os subindicadores exibidos.

### Frente 6 — Validação integrada dos fluxos críticos

**Prioridade:** P1  
**Meta:** confirmar que os módulos já implementados funcionam ponta a ponta.
**Status:** em expansão multi-dispositivo com bloqueio técnico parcial.

**Fluxos a validar**
1. Cadastro e login.
2. Onboarding do tenant.
3. Convite e aceite de membro.
4. Cadastro de cliente e anexos.
5. Criação de serviço, pacote e membership.
6. Agendamento, confirmação, reagendamento e cancelamento.
7. Portal do cliente.
8. Billing, limites e feature flags.

**Critério de aceite**
- Todos os fluxos críticos executam com banco real e sem inconsistência de permissão.
- As principais regras RLS e claims multi-tenant passam por validação manual.

**Estado atual**
- O workspace local já possui `E2E_USER` e `E2E_PASS` válidos para o usuário
  owner de QA; o bloqueio duro de autenticação caiu.
- A matriz de credenciais QA por papel também já foi validada.
- A smoke autenticada multi-rota já fecha de forma determinística no fluxo
  `bootstrap + build + preview`, cobrindo `/app/*` crítico.
- A trilha visual autenticada crítica no perfil `iphone-14-portrait` também já
  fecha de forma determinística para baseline das rotas principais, cenários
  transicionais e overlap do `BottomNav`.
- O encadeamento de toda essa trilha crítica em um único comando ainda sofre
  oscilação residual de `globalSetup`/rede Supabase no ambiente local.
- A primeira tentativa de remover o `globalSetup` da trilha crítica e usar
  apenas `storageState` bootstrapado não foi suficiente para manter a sessão
  autenticada nos perfis adicionais testados; a expansão multi-dispositivo
  segue aberta como pendência técnica.
- A trilha preview-crítica recebeu recuperação explícita de cold-start
  autenticado nas rotas visuais.
- O helper de `BottomNav` foi ajustado para priorizar
  `locator.boundingBox()`, reduzindo falso positivo em mobile.
- Em `/app/clientes`, os ajustes de contração/padding reduziram o overflow
  horizontal e a tela branca no preview autenticado foi corrigida após
  diagnóstico de `ReferenceError: cn is not defined`.
- Com isso, `/app/clientes` e `/app/confirmacoes` passaram com sucesso em
  `iphone-se`, `iphone-14-landscape` e `ipad-portrait` na trilha
  preview-crítica.
- A suíte `public-routes.spec.ts` com as quatro rotas autenticadas também foi
  validada integralmente em `iphone-se`, `iphone-14-landscape` e
  `ipad-portrait`.
- O bloqueio remanescente desta expansão está isolado no
  `android-360-portrait`.
- Em 24/04/2026, a execução elevada confirmou que esse perfil já consegue
  validar `/auth/login` no proxy Chromium 360px da trilha preview-crítica.
- Ainda assim, a trilha autenticada e o diagnóstico mínimo do perfil Android
  seguiram excedendo 10 minutos sem devolver resultado útil, consolidando o
  bloqueio como questão de runner/infraestrutura desse perfil.
- Em 24/04/2026, foi criado `scripts/e2e-storage-check.mjs` e o comando
  `npm run test:storage:check` para validar o bucket real `client-media`.
- A execução elevada do check confirmou, com o usuário
  `owner.studio-teste-qa@cativa.test`, upload no tenant `Studio Teste QA`,
  emissão de URL assinada, download do conteúdo e remoção do objeto de teste.
- Em 24/04/2026, foi criado `e2e/diagnostics/crm-media.spec.ts` e o comando
  `npm run test:crm:media` para validar o fluxo pela UI do CRM.
- A primeira execução validada criou um cliente pela UI, subiu um arquivo pela
  aba `Arquivos & Fotos`, validou o registro em `client_files`, leu o conteúdo
  por URL assinada, removeu o arquivo pela UI e confirmou cleanup no
  banco/storage.
- Na sequência, o mesmo E2E foi expandido e validado para foto/imagem:
  upload pela UI, persistência em `client_photos`, leitura por URL assinada,
  remoção pela UI e cleanup no banco/storage.
- Em 24/04/2026, foi criado `e2e/diagnostics/portal-booking.spec.ts` e o
  comando `npm run test:portal:booking`.
- A execução validou portal e autoagendamento com sessão real, vínculo
  temporário em `client_users`, cliente real, serviço real, preço,
  horário da unidade, disponibilidade do profissional, slot via
  `get_available_slots`, criação de appointment `source=client_portal` e
  cleanup no banco.
- A criação de conta nova de cliente final foi sondada, mas o Supabase Auth
  retornou `hasSession=false`, indicando exigência de confirmação por e-mail;
  por isso esse recorte permanece como pendência humana/operacional.
- Em 24/04/2026, foi criado `e2e/diagnostics/team-invite.spec.ts` e o comando
  `npm run test:team:invite` para validar convite e aceite pela tela
  `/auth/aceite-convite` com owner e convidado QA reais.
- A primeira execução do diagnóstico passou por preflight e build, mas revelou
  erro real no Supabase remoto: a RPC `create_team_invitation` falha com
  `column reference "id" is ambiguous`.
- Foi criada a migration
  `20260424090000_fix_team_invitation_ambiguous_id.sql`, corrigindo a
  ambiguidade em `create_team_invitation` e `admin_provision_team_invitation`.
- A validação final do convite fica pendente até essa migration ser aplicada
  no projeto Supabase remoto e o comando `npm run test:team:invite` ser
  reexecutado com sucesso.
- Em 24/04/2026, foi criado `e2e/diagnostics/tenant-switch.spec.ts` e o
  comando `npm run test:tenant:switch`.
- A execução validou, em preview/build local + Supabase real, recuperação de
  `cativa.currentTenantId` inválido em cache, criação de unidade temporária no
  tenant QA, troca de unidade pela UI mobile do `TenantSwitcher`, retorno para
  a unidade original e cleanup sem sobras (`E2E Unidade Contexto% = 0`).
- Em 24/04/2026, foi criado `e2e/diagnostics/plan-limits.spec.ts` e o comando
  `npm run test:plan:limits`.
- A execução validou, em preview/build local + Supabase real, o bloqueio de
  criação de nova unidade quando o plano/feature efetivo não permite expansão.
  O teste usa dados reais de assinatura/plano, pode criar unidades temporárias
  apenas se necessário para atingir um limite finito próximo e confirma cleanup
  sem sobras (`E2E Limite Unidade% = 0`).
- Em 24/04/2026, foi criado `e2e/diagnostics/client-limit.spec.ts` e o comando
  `npm run test:client:limit` para validar bloqueio de criação de cliente ao
  atingir `max_active_clients`.
- A execução ficou como `skipped` de forma intencional: o tenant QA está com
  `max_active_clients=2000` e apenas `1` cliente ativo, portanto não é seguro
  popular 1.999 clientes temporários para forçar o bloqueio. O diagnóstico está
  pronto e só cria até 3 clientes temporários quando o tenant estiver próximo do
  limite, mantendo cleanup sem sobras (`E2E Limite Cliente% = 0`).
- Em 24/04/2026, foi criado `e2e/diagnostics/import-export-clients.spec.ts` e
  o comando `npm run test:import-export:clients`.
- A execução validou, em preview/build local + Supabase real, importação CSV de
  cliente pela tela `/app/dados`, persistência do registro em `clients`,
  exportação CSV de clientes, presença do registro importado no arquivo
  baixado e cleanup sem sobras (`E2E Import Export Cliente% = 0`).
- Em 24/04/2026, foi criado `e2e/diagnostics/import-export-services.spec.ts` e
  o comando `npm run test:import-export:services`.
- A execução validou, em preview/build local + Supabase real, importação CSV de
  serviço pela tela `/app/dados`, persistência do registro em `services`,
  persistência do preço base em `service_prices`, exportação CSV de serviços,
  presença do registro importado no arquivo baixado e cleanup sem sobras
  (`E2E Serviço Import Export% = 0`).
- Em 24/04/2026, foi criado `e2e/diagnostics/import-export-team.spec.ts` e
  o comando `npm run test:import-export:team`.
- A execução validou, em preview/build local + Supabase real, importação CSV de
  profissional pela tela `/app/dados`, persistência em `professionals`,
  validação de comissão via RPC segura `list_professionals_with_commission`,
  exportação CSV de equipe com comissão e cleanup sem sobras
  (`E2E Profissional Import Export% = 0`).
- Durante essa validação, foi corrigido o exportador de equipe para buscar
  `commission_pct` pela RPC autorizada, em vez de depender de SELECT direto na
  coluna protegida.
- O restante das validações exige cenários extremos adicionais de storage,
  profissionais e clientes ativos, expansão de import/export para pacotes e
  agendamentos, além de conferência humana de
  RLS/comportamento em dispositivos.

**Avanços finais desta preparação**
- Preflight local de ambiente implementado em `scripts/e2e-preflight.mjs`.
- Script `test:visual:check` criado para leitura rápida do estado do ambiente.
- Script `test:visual:auth` criado para impedir execução inútil sem credenciais.
- Preflight agora também valida reachability do Supabase e login real antes do Playwright.
- Spec `e2e/visual/public-routes.spec.ts` corrigido para não sobrescrever a
  sessão autenticada com `storageState` vazio.
- Script `test:visual:roles` criado e validado com sucesso para a matriz de
  usuários QA por papel.
- Smoke autenticada separada criada em `playwright.smoke.config.ts`.
- `globalSetup` passou a tentar autenticação direta via Supabase antes do
  fallback por UI.
- Script `generate-storage-state.mjs` criado para bootstrap direto da sessão
  autenticada sem depender do `globalSetup` na trilha de smoke.
- `test:auth:smoke` agora valida `/app`, `/app/agenda`, `/app/clientes` e
  `/app/confirmacoes` em modo serial com sessão real bootstrapada.
- `test:visual:auth:critical` criado para consolidar a validação visual
  autenticada crítica no perfil principal sem depender da suíte completa em
  todos os dispositivos na mesma rodada.
- `test:storage:check` criado e validado contra o Supabase real para cobrir
  upload, signed URL, download e cleanup no bucket `client-media`.
- `test:crm:media` criado e validado contra preview/build local + Supabase
  real para cobrir criação de cliente, upload/remoção de arquivo e foto pela
  UI do CRM e cleanup.
- `test:portal:booking` criado e validado contra preview/build local +
  Supabase real para cobrir vínculo portal e autoagendamento ponta a ponta.
- `test:team:invite` criado para cobrir convite e aceite de membro pela UI.
- Migration de correção da RPC de convite criada; falta aplicar no Supabase
  remoto e reexecutar o diagnóstico.
- `test:tenant:switch` criado e validado contra Supabase real para cobrir
  recuperação de tenant inválido em cache e troca real de unidade no app.
- `test:plan:limits` criado e validado contra Supabase real para cobrir
  bloqueio de criação de unidade por limite/feature efetiva de plano.
- `test:client:limit` criado para cobrir `max_active_clients`; a execução atual
  pulou por limite alto demais no tenant QA (`2000` vs `1` ativo).
- `test:import-export:clients` criado e validado contra Supabase real para
  cobrir round-trip mínimo de clientes: CSV importado, registro persistido,
  CSV exportado e cleanup.
- `test:import-export:services` criado e validado contra Supabase real para
  cobrir round-trip mínimo de serviços: CSV importado, preço base persistido,
  CSV exportado e cleanup.
- `test:import-export:team` criado e validado contra Supabase real para cobrir
  round-trip mínimo de equipe: CSV importado, comissão validada/exportada via
  RPC segura e cleanup.

## Ordem recomendada

1. Frente 1 — Sanear ambiente e recuperar confiança de build/test.
2. Frente 2 — Consolidar rastreabilidade real e remover divergências documentais.
3. Frente 3 — Fechar enforcement de billing e limites.
4. Frente 4 — Refinar agenda por recurso/sala.
5. Frente 5 — Refinar analytics por contexto.
6. Frente 6 — Executar validação ponta a ponta.

## Meta de conclusão por fase

| Fase | Resultado esperado | Impacto na completude geral |
| --- | --- | --- |
| Fase A | Ambiente estável com build/test verdes | concluída |
| Fase B | Rastreabilidade e docs alinhadas ao código | concluída |
| Fase C | Billing e limites fechados | ~93% para ~95% |
| Fase D | Agenda e analytics refinados | concluída |
| Fase E | Validação integrada concluída | ~97% para ~98%+ |

## Observações

- O projeto já está em estágio avançado; o foco agora é fechamento, não reconstrução.
- Parte das pendências antigas já foi superada pelo código e precisa apenas ser removida da documentação.
- O maior risco atual deixou de ser ambiente local e passou a ser validação autenticada em ambiente real.
