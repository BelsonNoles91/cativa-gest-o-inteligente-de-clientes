# Auditoria de continuidade — fases 3 a 18 (24/09/2026)

Este registro continua as fases 0–2 documentadas em `19`, `20` e `21`. Os testes abaixo são os executados nesta sessão. Uma verificação parcial não é marcada como PASS da fase inteira.

## 1. Visão geral e arquitetura

Aplicação React/TypeScript/Vite com Supabase Auth, Postgres/RLS, Storage, RPCs e Edge Functions; Playwright para E2E/visual e Vitest para testes locais. O envio pelo WhatsApp continua humano: o app prepara texto e abre `wa.me`.

## 2. Perfis e módulos analisados

Os perfis mapeados na [matriz da fase 0](19-auditoria-fase0-matriz-funcional.md) incluem super_admin, owner, manager, frontdesk, professional e cliente do portal. Nesta continuação houve leitura de guards, agenda, confirmação, portal, storage, páginas públicas, migrations, build e configuração de testes. A cobertura funcional em sessão real para **cada perfil** ainda não foi executada.

## 3. Achados, bugs e correções

| Prioridade | Achado | Evidência | Situação |
| --- | --- | --- | --- |
| P1 | O projeto CLI (`supabase/config.toml`: `uqskxftzmjsumykpkwus`) é diferente do fallback de runtime em `vite.config.ts` (`pegvtrvqdvzxysndddts`). Um `migration list --linked` limpo verifica o primeiro, enquanto um build sem env usa o segundo. | Dump e tipos do projeto CLI: 17 tabelas e 24 funções dos tipos locais ausentes. Requisições HEAD às sete tabelas correspondentes no runtime deram HTTP 200; quatro RPCs públicas de leitura também deram HTTP 200. | Divergência de alvo comprovada; **não** foi provado que o backend de runtime carece desses objetos. Alvo de deploy e cadeia de migrations precisam ser reconciliados antes do gate. |
| P2 | Abrir WhatsApp registrava `sent` sem comprovar envio humano; alguns links omitiam o DDI 55. | `ConfirmationActionDialog`, `QueueItemCard`, página pública. | Corrigido em `ba11a95`; 32/32 testes focados, typecheck e build aprovados. |
| P2 | `HAS_E2E_AUTH` interpretava um `storageState.json` vazio como sessão autenticada. | E2E axe: `/app` expirou após 20 s sem credenciais. | Corrigido em `cb124e0`; repetição: 2 testes públicos PASS, 1 autenticado SKIP. |
| P3 | Snapshot Android 360 de login desatualizado após inclusão dos botões Google/Apple. | Esperado 360×952, recebido 360×1151. Inspeção das duas imagens mostrou os controles adicionais e maior altura; o teste de overflow horizontal passou antes do diff. | Baseline ainda não atualizado; exige revisão visual das demais resoluções. |
| P3 | `npm audit` encontrou quatro advisories moderados, todos na cadeia de desenvolvimento `drizzle-kit` → `@esbuild-kit` → `esbuild`. | `npm audit --json`: 0 high, 0 critical, 4 moderate. | Sem `audit fix --force`; atualização precisa preservar compatibilidade. |

Não foi adicionada funcionalidade de pagamento, checkout, PIX ou envio automático de WhatsApp.

## 4. Resultados por fase

| Fase | Evidência obtida | Pendência / classificação |
| --- | --- | --- |
| 3 — Auth, autorização, perfis | 138/138 testes locais focados de acesso/roles/RLS simulada passaram na etapa anterior; guards e RLS foram lidos. | Login, refresh, IDOR e isolamento multiempresa **NÃO TESTADOS em sessão real**: sem E2E_USER/E2E_PASS ou DB URL. `supabase/tests/rls-regression.sql` não foi executado. |
| 4 — Agendamento | 34/34 testes locais focados na etapa anterior; exclusões de sobreposição inspecionadas. Corrida local em duas conexões: um INSERT, outro `40P01`, contagem final 1. Horários 10–11 e 11–12 aceitos; buffer até 11:10 impediu 11–12 (`23P01`). | Corrida ocorreu em **Postgres local isolado** reconstruído do schema do projeto CLI + migrations Drizzle. `session_replication_role=replica` isolou a constraint, portanto os triggers e a RPC completa não foram validados nessa corrida. Concorrência no backend de runtime **NÃO TESTADA**. O spec `e2e/concurrency-integrity.spec.ts` está vazio. |
| 5 — Datas/timezone | Bug de dia/horário do portal corrigido em `830acb4`; testes de Belém/UTC, typecheck e build passaram. | Troca real de dispositivo/timezone e calendário completo no browser **NÃO TESTADOS**. |
| 6 — WhatsApp | Fluxo manual inspecionado; DDI, máscara, `+55`, inválido/ausente e encoding de acentos, quebra de linha e emoji cobertos por 32 testes focados. Registro `sent` agora depende da ação explícita do operador. | Popup bloqueado, app WhatsApp indisponível, toque duplo e comportamento desktop/smartphone real: **VALIDAÇÃO MANUAL NECESSÁRIA**. |
| 7 — Estados | Nove estados reais e matriz `allowedTransitions` em `src/domain/scheduling.ts`; cinco testes locais do domínio passaram. No schema do projeto CLI o trigger de transição não existe; ele apareceu após aplicar migrations Drizzle no banco local. | Mesma proteção no backend de runtime, conflitos entre duas sessões e refresh pós-mudança: **NÃO TESTADOS**. |
| 8–9 — Visual, navegadores, dispositivos | Android 360 em Chromium executou login; ausência de overflow horizontal passou. | Snapshot de login falhou por baseline antigo. Quatro projetos baseados em WebKit não iniciaram por `libavif16` ausente no host. Chrome/Edge/Firefox/Safari e aparelhos reais: **VALIDAÇÃO MANUAL NECESSÁRIA**. |
| 10 — UX/acessibilidade | Axe WCAG 2 A/AA em Android 360: login e acesso ao portal passaram sem violações sérias/críticas nas regras habilitadas. | Contraste foi desabilitado pelo próprio spec; teclado, foco, zoom, todas as telas/perfis e WCAG AA integral: **NÃO TESTADOS**. |
| 11 — Segurança | Lint do schema CLI: nenhum erro. Revisão estática de RLS, storage, tokens e superfícies de HTML; `npm audit`: 4 moderate, 0 high/critical. | RLS/IDOR real, abuso, upload e segurança do projeto de runtime **NÃO TESTADOS**. A política de UPDATE do portal no schema CLI é ampla e requer revalidação no alvo correto. |
| 12 — Performance/resiliência | Build de produção: 135 itens de precache, 2250,06 KiB; varredura estática encontrou guardas de erro/retry e cleanup de subscriptions em pontos centrais. | N+1, métricas de rede, latência/timeout, 400–500, memória e duração de loading **NÃO TESTADOS em runtime**. |
| 13 — Bateria automatizada | Vitest completo: **40 arquivos, 466/466 PASS** (baseline anterior: 38 arquivos, 448 testes). Typecheck PASS. Lint 0 erros/17 avisos. Build Node 22 PASS, mas com aviso de env ausente e fallback embutido. | Integração autenticada, E2E CRUD, RLS SQL e cobertura instrumental **NÃO TESTADOS**. |
| 14 — Caos controlado | Corrida local de INSERT e proteção por constraint descritas na fase 4. | Queda de rede, retry e sessão expirada contra backend isolado **NÃO TESTADOS**. |
| 15 — Regressão | Vitest completo, typecheck, lint e build repetidos após a correção do E2E. | Matriz perfil×tela×ação×permissão×resolução e E2E autenticado **NÃO TESTADOS**. |
| 16 — Produção | CLI e runtime comparados; build observado sem env; referências a localhost e domínio de publicação localizadas. | Configuração efetiva de deploy, redirects, CORS, logs e funções no projeto de runtime **NÃO TESTADOS**. |
| 17 — Backup/rollback | Git e migrations versionadas; procedimento descrito em `docs/05-backup-restore.md`. | Existência de backup/PITR, ponto de restauração, backup de Storage e restore ensaiado **NÃO VERIFICADOS**. |
| 18 — Gate | Critérios mínimos comparados com evidências acima. | **NÃO APTO PARA PRODUÇÃO** nesta auditoria: alvo de deploy ambíguo e testes críticos de auth/RLS, corrida no runtime, E2E por perfil e rollback sem evidência. Isso não afirma falha desses fluxos no runtime; afirma ausência da comprovação exigida pelo protocolo. |

## 5. Validação detalhada do alvo de banco

O `supabase db lint --linked` retornou “No schema errors found” e o histórico de `supabase/migrations` está alinhado até `20260924203000` **apenas no projeto `uqsk...`**. Comparação dos tipos locais (`src/integrations/supabase/types.ts`) com `supabase gen types --linked` identificou 83 tabelas locais versus 67 remotas e 76 funções locais versus 56 remotas. Entre os objetos ausentes no projeto CLI: `create_appointment_atomic`, `portal_cancel_appointment`, `client_self_service_rules` e `tenant_public_pages`.

O fallback do Vite aponta para **outro** projeto. Nele, HEAD para `appointments`, `client_self_service_rules`, `tenant_public_pages`, `professional_goals`, `review_requests`, `push_subscriptions` e `security_scans` retornou 200 com a chave pública embutida. As RPCs de leitura `get_public_tenant_page`, `get_public_tenant_timezone`, `get_public_units` e `get_public_services` retornaram 200 para um slug inexistente. Mutations/RPCs críticas desse projeto não foram invocadas para evitar alterar dados. O endpoint OpenAPI respondeu 401 para a chave pública, exigindo service role; não houve dump do projeto de runtime.

As 33 migrations de `drizzle/migrations` foram aplicadas em ordem **somente** em Postgres local sem dados de negócio, após importar o dump do schema `uqsk...`; a execução chegou ao fim depois de criar a publication local `supabase_realtime`. Essa prova de sintaxe/dependência em banco vazio não autoriza aplicar a sequência ao runtime: várias migrations mexem em planos/assinaturas, fora do escopo fixo desta versão, e nenhuma foi testada contra dados existentes do alvo correto.

## 6. Testes não executados e risco residual

Sem `VITE_SUPABASE_URL`/chave explícita e sem credenciais QA, os testes autenticados, RLS, IDOR e fluxos completos do portal não puderam rodar. O fallback do Vite torna o build tecnicamente bem-sucedido e imprime aviso de “variáveis obrigatórias ausentes”; esse build não demonstra que o deploy final usa o projeto pretendido. A ausência de `libavif16` impediu iniciar os projetos Playwright baseados em WebKit no host. O snapshot Android 360 precisa ser revisado, não apenas substituído automaticamente.

## 7. Rollback e recomendações para retomar

Os commits de frontend/E2E podem ser revertidos por `git revert` em uma nova alteração versionada. Não houve migration aplicada aos projetos remotos nesta continuação. O banco local da corrida é descartável. Antes de qualquer migration no alvo de runtime, confirmar o project ref de produção/QA, obter backup verificável, ensaiar restore em ambiente isolado e validar as migrations sobre uma cópia de dados compatível. Para concluir a homologação, fornecer contas QA por perfil, apontar explicitamente o backend alvo, executar a suíte SQL de RLS e o teste de concorrência contra ambiente QA, revisar os snapshots e testar browsers/dispositivos restantes.

=== ESTADO DA AUDITORIA ===

FASE CONCLUÍDA:
Nenhuma fase adicional homologada integralmente; Fases 3–18 auditadas parcialmente com gate final NÃO APTO PARA PRODUÇÃO.

FASES CONCLUÍDAS:
0, 1, 2 (com pendências registradas); correções pontuais das Fases 5, 6 e infraestrutura E2E validadas.

P0:
0 comprovados.

P1:
1 aberto — divergência do alvo Supabase CLI/runtime para validação e deploy.

P2:
0 abertos confirmados nesta continuação; 2 corrigidos (WhatsApp e detecção E2E).

P3:
2 abertos — baseline Android 360 antigo e quatro advisories moderados da cadeia de desenvolvimento.

P4:
0 novos confirmados.

CORREÇÕES REALIZADAS:
Timezone do portal (`830acb4`), número e registro manual do WhatsApp (`ba11a95`), detecção de sessão vazia no E2E (`cb124e0`).

ARQUIVOS ALTERADOS:
Ver commits citados; nesta etapa, `e2e/_helpers/auth.ts` e este relatório.

BANCO ALTERADO:
Não nos projetos remotos; somente Postgres local descartável para simulação.

MIGRATIONS:
Nenhuma nova/aplicada remotamente nesta continuação.

PERFIS AFETADOS:
Cliente do portal e equipe da Central de Confirmação; testes autenticados dos demais perfis pendentes.

TESTES EXECUTADOS:
Vitest 466/466; typecheck; lint 0 erros/17 avisos; build Node 22; axe público 2 PASS/1 SKIP; Playwright visual Android 360 com diff de snapshot; corrida e adjacência/buffer em Postgres local; npm audit; Supabase lint/list/tipos do projeto CLI; HEAD/RPCs públicas de leitura no projeto fallback.

TESTES FALHANDO:
Snapshot público Android 360 antigo; quatro projetos visuais sem dependência de host. Nenhum teste Vitest falhando.

TESTES NÃO EXECUTADOS:
Auth/roles/RLS/IDOR reais; concorrência no runtime; E2E completo; browser/dispositivo real; matriz visual integral; contraste; restore de backup.

PENDÊNCIAS:
Reconciliar projeto CLI e backend de runtime; obter ambiente QA/credenciais; verificar backup e restore; rodar E2E/RLS/concorrência; revisar snapshot e avisos npm.

RISCO ATUAL:
Alto para homologação por ausência de evidência nos critérios obrigatórios e alvo de deploy ambíguo.

PRÓXIMA FASE:
Retomar Fases 3–4 e 7–18 no backend QA correto após reconciliar o alvo; gate 18 permanece NÃO APTO PARA PRODUÇÃO.

=== FIM DO ESTADO ===
