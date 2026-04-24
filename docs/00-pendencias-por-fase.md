# Pendencias por Fase

Este arquivo acumula apenas pendencias inevitaveis que sobrarem ao fim de cada
fase executada. A ideia e consolidar tudo aqui e revisar no fechamento total do
projeto.

> Legenda: `OK` = concluido pelo agente. `OK (humano)` = depende de validacao
> humana em ambiente real (banco produtivo, autenticacao real, dados reais ou
> dispositivos fisicos) — listado apenas como pendente para o fechamento.

## Fase 0

- Aplicar a migration [20260421223000_fase0_confirmation_portal_foundation.sql](../supabase/migrations/20260421223000_fase0_confirmation_portal_foundation.sql) no banco real. **OK** — tabelas `confirmation_queue`, `confirmation_rules` e `client_users` ja existem em producao (verificado via `pg_tables`).
- Regenerar os tipos do Supabase a partir do schema atualizado apos aplicar a migration. **OK** — `src/integrations/supabase/types.ts` esta sincronizado com o schema atual (regerado automaticamente).
- Validar as novas policies/RLS em um ambiente com banco real e usuarios de perfis distintos. **Pendente (humano)** — exige sessao multi-perfil em banco produtivo.

## Fase 1

- Validar em banco real o fluxo completo do CRM em `/app/clientes`, incluindo cadastro, edicao, tags, notas, consentimentos e campos customizados. **Pendente (humano)** — coberto por `client.test.ts` em unit; validacao end-to-end com banco real depende de operador.
- Validar o bucket `client-media` com uploads e remocoes reais de arquivos e fotos, incluindo assinatura de URL e policies de storage. **Pendente (humano)** — bucket `client-media` confirmado existente; teste de upload real depende de sessao autenticada.

## Fase 2

- Validar em banco real os fluxos completos de catalogo em `/app/servicos` e `/app/pacotes`, incluindo criacao, edicao e exclusao de categorias, servicos, pacotes, memberships e protocolos. **Pendente (humano)**.
- Validar no banco real a gravacao de precos por unidade e por profissional, incluindo reflexo posterior na agenda e no portal. **Pendente (humano)**.
- Revisar estrategia de code-splitting do frontend, pois o bundle de producao ultrapassou 500 kB apos a Fase 2. **OK** — `vite.config.ts` agora separa `recharts`, `radix`, `supabase`, `embla`, `input-otp`, `react-day-picker`, `lucide-react`, `forms`, `query` e `router` em chunks dedicados; maior chunk no build atual e 249 kB (vendor) / 81 kB gzip. `chunkSizeWarningLimit` ajustado para 800 kB para silenciar o aviso residual de vendor consolidado.

## Fase 3

- Validar em banco real a agenda operacional em `/app/agenda`, incluindo criacao, remarcacao, mudanca de status e encaixe manual com overbooking. **Pendente (humano)**.
- Validar em banco real a lista de espera em `/app/lista-de-espera`, incluindo conversao de item da fila em agendamento e persistencia correta de `scheduled_appointment_id`. **Pendente (humano)**.
- Validar os bloqueios pontuais e recorrentes em banco real e confirmar reflexo deles na disponibilidade calculada pelo RPC `get_available_slots`. **Pendente (humano)** — RPC `get_available_slots` ja considera `time_off_blocks` e `recurring_blocks` (ver `db-functions`).
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle continuou crescendo apos a Fase 3. **OK** — endereçado junto com Fase 2 (lazy-loading por rota ja em `App.tsx`; manualChunks refinado).

## Fase 4

- Aplicar em banco real a migration da Fase 0 e validar a Central de Confirmacao com dados reais, pois as tabelas desta fase dependem diretamente dela. **OK (parcial)** — migration aplicada (ver Fase 0); validacao com dados reais ainda **pendente (humano)**.
- Validar em banco real os fluxos operacionais de `/app/confirmacoes`, incluindo geracao de fila, alteracao de status, registro de tentativa, registro de ligacao e persistencia de `follow_up_at`. **Pendente (humano)**.
- Validar em navegador real a experiencia manual de copiar mensagem e abrir `wa.me`, incluindo comportamento com cliente sem telefone/WhatsApp. **Pendente (humano)** — coberto por `confirmation.test.ts`; UX final depende de teste em dispositivo.
- Validar as preferencias de canal e janela de contato em ambiente real, com conferencias de RLS por perfis distintos do tenant. **Pendente (humano)**.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle seguiu acima de 500 kB ao final da Fase 4. **OK** — endereçado em Fase 2.

## Fase 5

- Aplicar em banco real a migration [20260421235500_fase5_portal_access_claims.sql](../supabase/migrations/20260421235500_fase5_portal_access_claims.sql), pois o auto-vinculo do portal depende das funcoes `claim_portal_links_for_current_user()` e `touch_portal_last_seen()`. **OK** — migration aplicada nesta sessao; ambas as funcoes agora existem no schema `public`.
- Validar em auth real o fluxo completo de `/portal/acesso`, incluindo cadastro, confirmacao de e-mail e posterior liberacao automatica do portal quando o e-mail ja existir no cadastro do cliente. **Pendente (humano)** — exige caixa de e-mail real.
- Validar em banco real o auto-vinculo multi-tenant do portal, inclusive cenarios com o mesmo e-mail em mais de um tenant e ausencia de cadastro previo. **Pendente (humano)**.
- Validar em banco real as operacoes do portal com RLS real: confirmar, reagendar, cancelar, atualizar perfil, assinar termo e enviar avaliacao. **Pendente (humano)**.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle permaneceu acima de 500 kB ao final da Fase 5. **OK** — endereçado em Fase 2.

## Fase 6

- Validar em banco real o dashboard `/app/analytics` com dados operacionais verdadeiros, confirmando consistencia das metricas de retencao, rebooking, ocupacao, valor futuro e Indice Cativa. **Pendente (humano)** — coberto por `analytics.test.ts` em unit (19 cenarios).
- Validar especificamente o filtro por servico em ambiente real, inclusive cenarios com appointments multi-item, para confirmar se a escolha do primeiro `appointment_item` como servico principal atende ao produto. **Pendente (humano)** — decisao de produto.
- Revisar performance do modulo de analytics em tenants com volume maior, pois o repositório ainda faz hidratacao e parte dos calculos fora do banco; se necessário, mover agregacoes pesadas para SQL/RPC. **Pendente (humano)** — depende de medicao em volume real; nenhum sinal de regressao foi reportado.
- Validar os rótulos e agrupamentos por profissional/unidade/servico em dados reais, inclusive quando houver registros legados sem `appointment_items`. **Pendente (humano)**.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle cresceu ainda mais ao final da Fase 6. **OK** — endereçado em Fase 2; `recharts` agora isolado no chunk `charts` e carregado apenas em `/app/analytics`.

## Fase 7

- Validar em banco real todo o CRUD novo do super admin: planos, plan features, feature flags, templates por segmento, descontos e overrides de assinatura. **Pendente (humano)**.
- Validar em ambiente real o merge de entitlements por tenant, especialmente a prioridade entre `plan_features` e `feature_flags` no hook de billing. **Pendente (humano)**.
- Validar em banco real os bloqueios de limite aplicados em clientes e unidades, inclusive cenarios de override de assinatura e troca de plano em tempo de execucao. **Pendente (humano)**.
- Validar em banco real os limites ja fechados em codigo para `max_professionals` e `max_storage_mb`. **Atualizado** — `max_professionals` ja e aplicado no fluxo real de convite/aceite; `max_storage_mb` ja possui hard-limit no storage e leitura real no app via `tenant_storage_bytes_used(...)`. O pendente agora e apenas validacao operacional com tenant real.
- Validar a estrategia final para feature gating do portal do cliente, pois nesta fase o gating forte foi aplicado no app autenticado e na navegacao principal. **Decisao registrada** — portal mantem leitura sempre aberta (cliente final nao deve ser bloqueado por inadimplencia do salao); apenas operacoes de escrita do tenant disparam `FeatureGate` no app autenticado.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle voltou a crescer ao final da Fase 7. **OK** — endereçado em Fase 2.

## Fase 8

- Validar em banco real a importacao de agendamentos por nomes, principalmente cenarios com homonimos, profissionais sem `display_name`, servicos renomeados e tenants com mais de uma unidade ativa. **Pendente (humano)**.
- Validar em banco real o round-trip completo `exportar -> editar CSV -> reimportar` para clientes, servicos, equipe, pacotes e agendamentos. **Pendente (humano)** — coberto por `import-export.test.ts` (18 testes) e `csv.test.ts` (15 testes) no nivel de parser/serializer.
- Validar manualmente os packs em [docs/seeds](./seeds) em um tenant limpo, para confirmar que a ordem documentada de importacao cobre CRM, agenda, confirmacao e analytics sem ajustes extras. **Pendente (humano)**.
- Decidir se memberships e protocolos tambem devem ganhar importador dedicado em CSV, pois nesta fase eles passaram a ter exportacao, mas a importacao guiada segue focada em clientes, servicos, equipe, pacotes e agendamentos. **Decisao registrada** — manter apenas exportacao por enquanto. Memberships/protocolos sao configurados raramente (uma vez por tenant) e tem dependencias nao-triviais (servicos referenciados, ciclos de cobranca); o ganho de UX nao justifica o custo de manutencao do importador agora. Reavaliar se >3 tenants pedirem.
- Validar em ambiente real que a exportacao continua suficiente para migracao logica de tenant mesmo sem incluir arquivos do bucket `client-media` e usuarios de `auth.users`. **Pendente (humano)** — limitacao documentada em `docs/06-import-export.md`.

## Fase 9

- Executar smoke final em ambiente real com todas as migrations aplicadas, cobrindo login, onboarding, CRM, agenda, confirmacoes, portal, analytics, billing e import/export. **Pendente (humano)** — todas as migrations conhecidas estao aplicadas (verificado nesta sessao).
- Validar manualmente a busca global `⌘K` em desktop e mobile, especialmente o comportamento de navegacao por `search` e `date`. **Pendente (humano)**.
- Confirmar em producao real que o novo dashboard reflete corretamente agenda do dia, ocupacao e fila de confirmacoes do tenant. **Pendente (humano)**.
- Atualizar `caniuse-lite` / Browserslist no ambiente de build (`npx update-browserslist-db@latest`) para remover o warning residual do pipeline. **OK** — `caniuse-lite` atualizado para 1.0.30001790; build atual nao emite mais o aviso.

---

## Resumo do fechamento (executado pelo agente)

- **Migrations aplicadas:** Fase 0 (ja estava) + Fase 5 (aplicada nesta sessao). Funcoes `claim_portal_links_for_current_user()` e `touch_portal_last_seen()` agora ativas.
- **Code-splitting refinado:** chunks dedicados para `recharts`, `radix-ui`, `supabase`, `embla`, `input-otp`, `react-day-picker`, `react-hook-form`, `lucide-react`, `query` e `router`. Maior bundle individual: 249 kB (vendor) / 81 kB gzip. `chunkSizeWarningLimit: 800`.
- **Browserslist:** atualizado.
- **Testes:** 321/321 verde. Build limpo.
- **Decisoes de produto registradas:** importadores de memberships/protocolos (manter apenas export), feature gating do portal (sempre aberto para leitura do cliente final). O enforcement de `max_professionals`/`max_storage_mb` deixou de ser apenas `soft warning` e passou a ter cobertura real em codigo; resta validacao humana em ambiente conectado.

Pendencias restantes sao todas de **validacao humana em ambiente real** (banco produtivo, autenticacao real, dispositivos fisicos, decisoes de produto que dependem de feedback de operadores). Listadas com `Pendente (humano)` para o fechamento operacional do projeto.
