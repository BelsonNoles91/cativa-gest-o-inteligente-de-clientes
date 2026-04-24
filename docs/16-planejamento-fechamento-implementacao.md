# Planejamento de fechamento da implementação

> Baseado na comparação entre [prompt_original.txt](../prompt_original.txt) e o estado atual do projeto em 23/04/2026.

## Objetivo

Levar o projeto do estado atual de alta aderência funcional ao prompt para um
estado de prontidão operacional, com fechamento dos gaps que ainda impedem uma
entrega considerada completa.

## Fase atual

| Frente atual | Status | Completude | Leitura objetiva |
| --- | --- | ---: | --- |
| Frente 6 — Validação integrada dos fluxos críticos | Em expansão multi-dispositivo com bloqueio técnico parcial | 95% | Infra local, baseline pública, preflight autenticado, login real do usuário owner, matriz de contas QA por papel, smoke autenticada multi-rota e trilha visual autenticada crítica no perfil `iphone-14-portrait` já estão validados. A trilha preview-crítica também já passou em `/app/clientes` e `/app/confirmacoes` nos perfis `iphone-se` e `iphone-14-landscape`. Seguem pendentes a baseline multi-dispositivo completa, portal real, bucket real e conferência humana de RLS/dispositivo. |

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
| Etapa 10 — Import/export, portabilidade, segurança e docs | 89% | Parcial avançado | Ambiente técnico saneado; restam ajustes finais de documentação e validação integrada. |
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
  `iphone-se` e `iphone-14-landscape` na trilha preview-crítica.
- O restante das validações exige bucket real, portal real, usuários reais e
  conferência humana de RLS/comportamento em dispositivos.

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
