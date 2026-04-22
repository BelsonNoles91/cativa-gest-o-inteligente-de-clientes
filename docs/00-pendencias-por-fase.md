# Pendencias por Fase

Este arquivo acumula apenas pendencias inevitaveis que sobrarem ao fim de cada
fase executada. A ideia e consolidar tudo aqui e revisar no fechamento total do
projeto.

## Fase 0

- Aplicar a migration [20260421223000_fase0_confirmation_portal_foundation.sql](../supabase/migrations/20260421223000_fase0_confirmation_portal_foundation.sql) no banco real.
- Regenerar os tipos do Supabase a partir do schema atualizado apos aplicar a migration.
- Validar as novas policies/RLS em um ambiente com banco real e usuarios de perfis distintos.

## Fase 1

- Validar em banco real o fluxo completo do CRM em `/app/clientes`, incluindo cadastro, edicao, tags, notas, consentimentos e campos customizados.
- Validar o bucket `client-media` com uploads e remocoes reais de arquivos e fotos, incluindo assinatura de URL e policies de storage.

## Fase 2

- Validar em banco real os fluxos completos de catalogo em `/app/servicos` e `/app/pacotes`, incluindo criacao, edicao e exclusao de categorias, servicos, pacotes, memberships e protocolos.
- Validar no banco real a gravacao de precos por unidade e por profissional, incluindo reflexo posterior na agenda e no portal.
- Revisar estrategia de code-splitting do frontend, pois o bundle de producao ultrapassou 500 kB apos a Fase 2.

## Fase 3

- Validar em banco real a agenda operacional em `/app/agenda`, incluindo criacao, remarcacao, mudanca de status e encaixe manual com overbooking.
- Validar em banco real a lista de espera em `/app/lista-de-espera`, incluindo conversao de item da fila em agendamento e persistencia correta de `scheduled_appointment_id`.
- Validar os bloqueios pontuais e recorrentes em banco real e confirmar reflexo deles na disponibilidade calculada pelo RPC `get_available_slots`.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle continuou crescendo apos a Fase 3.

## Fase 4

- Aplicar em banco real a migration da Fase 0 e validar a Central de Confirmacao com dados reais, pois as tabelas desta fase dependem diretamente dela.
- Validar em banco real os fluxos operacionais de `/app/confirmacoes`, incluindo geracao de fila, alteracao de status, registro de tentativa, registro de ligacao e persistencia de `follow_up_at`.
- Validar em navegador real a experiencia manual de copiar mensagem e abrir `wa.me`, incluindo comportamento com cliente sem telefone/WhatsApp.
- Validar as preferencias de canal e janela de contato em ambiente real, com conferencias de RLS por perfis distintos do tenant.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle seguiu acima de 500 kB ao final da Fase 4.

## Fase 5

- Aplicar em banco real a migration [20260421235500_fase5_portal_access_claims.sql](../supabase/migrations/20260421235500_fase5_portal_access_claims.sql), pois o auto-vinculo do portal depende das funcoes `claim_portal_links_for_current_user()` e `touch_portal_last_seen()`.
- Validar em auth real o fluxo completo de `/portal/acesso`, incluindo cadastro, confirmacao de e-mail e posterior liberacao automatica do portal quando o e-mail ja existir no cadastro do cliente.
- Validar em banco real o auto-vinculo multi-tenant do portal, inclusive cenarios com o mesmo e-mail em mais de um tenant e ausencia de cadastro previo.
- Validar em banco real as operacoes do portal com RLS real: confirmar, reagendar, cancelar, atualizar perfil, assinar termo e enviar avaliacao.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle permaneceu acima de 500 kB ao final da Fase 5.

## Fase 6

- Validar em banco real o dashboard `/app/analytics` com dados operacionais verdadeiros, confirmando consistencia das metricas de retencao, rebooking, ocupacao, valor futuro e Indice Cativa.
- Validar especificamente o filtro por servico em ambiente real, inclusive cenarios com appointments multi-item, para confirmar se a escolha do primeiro `appointment_item` como servico principal atende ao produto.
- Revisar performance do modulo de analytics em tenants com volume maior, pois o repositório ainda faz hidratacao e parte dos calculos fora do banco; se necessário, mover agregacoes pesadas para SQL/RPC.
- Validar os rótulos e agrupamentos por profissional/unidade/servico em dados reais, inclusive quando houver registros legados sem `appointment_items`.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle cresceu ainda mais ao final da Fase 6.

## Fase 7

- Validar em banco real todo o CRUD novo do super admin: planos, plan features, feature flags, templates por segmento, descontos e overrides de assinatura.
- Validar em ambiente real o merge de entitlements por tenant, especialmente a prioridade entre `plan_features` e `feature_flags` no hook de billing.
- Validar em banco real os bloqueios de limite aplicados em clientes e unidades, inclusive cenarios de override de assinatura e troca de plano em tempo de execucao.
- Decidir e validar a politica final para recursos ainda sem enforcement completo nesta fase, principalmente `max_professionals` e `max_storage_mb`, que dependem de fluxos/medicoes adicionais.
- Validar a estrategia final para feature gating do portal do cliente, pois nesta fase o gating forte foi aplicado no app autenticado e na navegacao principal.
- Revisar estrategia de code-splitting do frontend novamente, pois o bundle voltou a crescer ao final da Fase 7.

## Fase 8

- Validar em banco real a importacao de agendamentos por nomes, principalmente cenarios com homonimos, profissionais sem `display_name`, servicos renomeados e tenants com mais de uma unidade ativa.
- Validar em banco real o round-trip completo `exportar -> editar CSV -> reimportar` para clientes, servicos, equipe, pacotes e agendamentos.
- Validar manualmente os packs em [docs/seeds](./seeds) em um tenant limpo, para confirmar que a ordem documentada de importacao cobre CRM, agenda, confirmacao e analytics sem ajustes extras.
- Decidir se memberships e protocolos tambem devem ganhar importador dedicado em CSV, pois nesta fase eles passaram a ter exportacao, mas a importacao guiada segue focada em clientes, servicos, equipe, pacotes e agendamentos.
- Validar em ambiente real que a exportacao continua suficiente para migracao logica de tenant mesmo sem incluir arquivos do bucket `client-media` e usuarios de `auth.users`.

## Fase 9

- Executar smoke final em ambiente real com todas as migrations aplicadas, cobrindo login, onboarding, CRM, agenda, confirmacoes, portal, analytics, billing e import/export.
- Validar manualmente a busca global `⌘K` em desktop e mobile, especialmente o comportamento de navegacao por `search` e `date`.
- Confirmar em producao real que o novo dashboard reflete corretamente agenda do dia, ocupacao e fila de confirmacoes do tenant.
- Atualizar `caniuse-lite` / Browserslist no ambiente de build (`npx update-browserslist-db@latest`) para remover o warning residual do pipeline.
