# Pendências executáveis pelo Lovable

> Estado revisado em 24/04/2026 após fechamento técnico de ambiente, billing,
> agenda e analytics.

## Concluído nesta rodada

- `npm test` e `npm run build` voltaram a fechar no workspace atual.
- O fluxo de convite real de equipe está implementado, com aceite por token,
  auditoria e enforcement real de `max_professionals`; em 24/04/2026, a
  validação E2E detectou uma falha remota na RPC `create_team_invitation`, já
  corrigida em migration local pendente de aplicação no Supabase.
- O consumo de storage exibido no app passou a usar a função
  `tenant_storage_bytes_used(...)`, alinhado ao hard-limit do banco.
- Uploads do CRM agora fazem bloqueio preventivo quando o storage projetado
  excede o plano.
- A agenda ganhou visualização explícita por recurso/sala.
- Analytics foi reorganizado em contextos `Executivo`, `Operacional` e
  `Retenção`.

## Pendências que ainda fazem sentido para execução

### Bloco A — Validação integrada em banco real

**Prioridade:** P1  
**Natureza:** execução assistida / validação operacional
**Completude atual:** 99%

**Objetivo**
Confirmar que os fluxos já implementados funcionam ponta a ponta com sessão
real, RLS real e buckets reais.

**Estado atual**
- Preflight de ambiente E2E implementado.
- Trilha pública do Playwright estabilizada e validada.
- Trilha autenticada agora falha rápido quando credenciais não existem.
- Trilha autenticada também valida login real antes do Playwright.
- Credencial `owner` de QA validada com sucesso no Supabase.
- Matriz de contas QA por papel validada com sucesso no Supabase:
  `owner`, `manager`, `frontdesk`, `professional`.
- Corrigido bug do spec visual autenticado que descartava a sessão ao aplicar
  `storageState` vazio ao arquivo inteiro.
- Trilha de smoke autenticada separada criada para reduzir custo da suíte
  visual completa.
- `globalSetup` endurecido com espera ativa do app e tentativa de auth direta
  via Supabase antes do fallback por UI.
- Smoke autenticada multi-rota validada com sucesso em preview/build local
  para `/app`, `/app/agenda`, `/app/clientes` e `/app/confirmacoes`.
- O comando `test:auth:smoke` agora cobre essa trilha multi-rota.
- A trilha visual autenticada crítica no perfil principal
  (`iphone-14-portrait`) também foi validada com sucesso para baseline das
  quatro rotas principais, cenários transicionais e overlap do `BottomNav`.
- A expansão multi-dispositivo no `iphone-se` avançou: `/app/confirmacoes`
  passou na trilha preview crítica com o helper de `BottomNav` ajustado para
  priorizar `locator.boundingBox()`.
- Em `/app/clientes`, o overflow horizontal foi reduzido com ajustes de
  contração e padding na coluna esquerda.
- A tela branca de `/app/clientes` no preview autenticado foi diagnosticada e
  corrigida: o erro era `ReferenceError: cn is not defined` no CRM.
- Após essa correção, `/app/clientes` e `/app/confirmacoes` passaram na
  trilha preview crítica também em `iphone-se` e `iphone-14-landscape`.
- O mesmo recorte também foi validado em `ipad-portrait`, com baseline criada
  para as duas rotas.
- A suíte `public-routes.spec.ts` das quatro rotas autenticadas também foi
  validada integralmente em `ipad-portrait`, `iphone-se` e
  `iphone-14-landscape` na trilha preview-crítica.
- Resta fechar a baseline visual autenticada completa e as validações que
  dependem de portal real, bucket real e conferência humana de RLS/dispositivo.
- Em 24/04/2026, a execução elevada confirmou que o perfil Android consegue
  validar a rota pública de login no proxy Chromium 360px da trilha
  preview-crítica.
- Mesmo com esse desbloqueio parcial, a trilha autenticada e o diagnóstico
  mínimo do perfil Android seguiram excedendo 10 minutos sem retorno útil.
- Em 24/04/2026, foi criado e validado `npm run test:storage:check`.
- O check confirmou o bucket real `client-media` com sessão owner QA, tenant
  `Studio Teste QA`, cliente existente, upload, emissão de URL assinada,
  download do conteúdo e remoção do objeto de teste.
- Em 24/04/2026, foi criado e validado `npm run test:crm:media`.
- O E2E confirmou pela UI do CRM: criação de cliente, abertura da aba
  `Arquivos & Fotos`, upload de arquivo, persistência em `client_files`,
  leitura por URL assinada, remoção pela UI e cleanup no banco/storage.
- Na mesma data, o E2E foi expandido e passou também para foto/imagem:
  upload pela UI, persistência em `client_photos`, leitura por URL assinada,
  remoção pela UI e cleanup no banco/storage.
- Em 24/04/2026, foi criado e validado `npm run test:portal:booking`.
- O E2E confirmou o portal com vínculo real `client_users`, cliente real,
  serviço/preço, horário de unidade, disponibilidade profissional, slot via
  RPC `get_available_slots`, criação de appointment `source=client_portal`
  e cleanup no banco.
- Em 24/04/2026, foi criado `npm run test:team:invite`.
- A execução do convite assistido passou por preflight e build, mas falhou na
  criação remota do convite por erro real de banco:
  `column reference "id" is ambiguous` em `create_team_invitation`.
- Foi adicionada a migration
  `20260424090000_fix_team_invitation_ambiguous_id.sql`, que qualifica as
  referências a `team_invitations.id` em `create_team_invitation` e
  `admin_provision_team_invitation`.
- O aceite assistido deve ser reexecutado após aplicar essa migration no
  Supabase remoto.
- Em 24/04/2026, foi criado e validado `npm run test:tenant:switch`.
- O E2E confirmou recuperação de tenant inválido em cache, criação de unidade
  temporária em banco real, troca de unidade pelo `TenantSwitcher` mobile,
  retorno para a unidade original e cleanup sem sobras.
- Em 24/04/2026, foi criado e validado `npm run test:plan:limits`.
- O E2E confirmou o bloqueio de criação de nova unidade quando o
  plano/feature efetivo não permite expansão, usando assinatura e limites reais
  do tenant QA e cleanup sem sobras.
- Em 24/04/2026, foi criado `npm run test:client:limit`.
- A execução ficou como `skipped` porque o tenant QA possui
  `max_active_clients=2000` e apenas `1` cliente ativo; o teste está pronto
  para validar o bloqueio quando o tenant estiver próximo do limite, sem criar
  volume artificial alto de dados.
- Em 24/04/2026, foi criado e validado
  `npm run test:import-export:clients`.
- O E2E confirmou round-trip mínimo de clientes em `/app/dados`: importação
  CSV real, persistência em `clients`, exportação CSV, presença do cliente
  importado no arquivo baixado e cleanup sem sobras.
- Em 24/04/2026, foi criado e validado
  `npm run test:import-export:services`.
- O E2E confirmou round-trip mínimo de serviços em `/app/dados`: importação
  CSV real, persistência em `services`, persistência de preço base em
  `service_prices`, exportação CSV, presença do serviço importado no arquivo
  baixado e cleanup sem sobras.
- Em 24/04/2026, foi criado e validado
  `npm run test:import-export:team`.
- O E2E confirmou round-trip mínimo de equipe em `/app/dados`: importação CSV
  real, persistência em `professionals`, validação de comissão via RPC segura
  `list_professionals_with_commission`, exportação CSV com comissão e cleanup
  sem sobras.
- A criação de nova conta de cliente final pelo portal foi sondada, mas o Auth
  exige confirmação por e-mail (`hasSession=false`), então esse recorte segue
  como validação humana com caixa de e-mail real.
- A consolidação dessa trilha crítica em um único comando serial ainda sofre
  instabilidade residual de `globalSetup`/rede no ambiente local.
- A expansão dessa trilha para outros perfis de dispositivo ainda está
  bloqueada por comportamento inconsistente de sessão quando se tenta remover o
  `globalSetup` e confiar apenas no `storageState` bootstrapado.

**Tarefas**
1. Validar onboarding completo com conta nova e troca real entre dois tenants
   ativos; a recuperação de tenant inválido em cache e a troca real de unidade
   já foram cobertas por `npm run test:tenant:switch`.
2. Aplicar a migration
   `20260424090000_fix_team_invitation_ambiguous_id.sql` no Supabase remoto e
   reexecutar `npm run test:team:invite` para validar convite e aceite real de
   membro em fluxo E2E assistido.
3. Validar cadastro/confirmação de e-mail real do cliente final em
   `/portal/acesso`.
4. Expandir validação de limites de plano para cenários extremos de storage,
   profissionais e clientes ativos; o bloqueio de unidade já foi validado por
   `npm run test:plan:limits` e o diagnóstico de clientes ativos já existe,
   mas requer tenant QA com limite menor/próximo do consumo real.
5. Expandir import/export para round-trip de pacotes e agendamentos;
   os recortes de clientes, serviços e equipe já foram validados por
   `npm run test:import-export:clients` e
   `npm run test:import-export:services` e
   `npm run test:import-export:team`.
6. Rodar baseline visual autenticada completa e revisar diffs finais.
7. Expandir a trilha crítica validada do `iphone-14-portrait` para os demais
   perfis móveis/tablet.
8. Destravar o runner autenticado de `android-360-portrait`, que já validou a
   rota pública de login fora do sandbox, mas ainda não devolve resultado útil
   na trilha autenticada mesmo com timeout ampliado.

**Critério de aceite**
- Fluxos críticos executam sem erro de permissão.
- Policies, claims e buckets se comportam como esperado.

### Bloco B — Validação visual e regressão assistida

**Prioridade:** P2  
**Natureza:** QA
**Completude atual:** 85%

**Objetivo**
Garantir que os refinamentos de agenda, analytics e billing permaneçam estáveis
visualmente em desktop e mobile.

**Tarefas**
1. Rodar suite visual autenticada do Playwright em ambiente configurado.
2. Revisar tela de agenda por recurso com sessão real.
3. Revisar tabs de analytics por contexto com dados reais.
4. Revisar tela de billing com consumo real de storage em tenant conectado.

**Critério de aceite**
- Baseline visual aprovada.
- Sem regressão perceptível nas telas críticas.

## O que não é mais pendência executável

- Convite real de equipe no código; a validação remota ainda depende da
  aplicação da migration de correção da RPC.
- Enforcement de `max_professionals`.
- Medição real de storage no app.
- Hard-limit de storage no banco.
- Saneamento de `build/test` no workspace atual.
- Fechamento de rastreabilidade documental vs prompt.

## Observação

O backlog restante agora é majoritariamente de validação integrada com ambiente
real. O núcleo funcional pedido no prompt está implementado; o que falta é
credencial, sessão real, bucket real e validação humana assistida.
