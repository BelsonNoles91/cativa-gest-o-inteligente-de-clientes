# Checklist Operacional Pré-Lançamento

Este documento consolida **todas as pendências humanas** marcadas como `Pendente (humano)` em [00-pendencias-por-fase.md](./00-pendencias-por-fase.md). Use-o como roteiro de validação manual antes de liberar o produto em produção.

> **Como usar:** marque cada item conforme for validando em ambiente real. Anote o operador, data e observações na coluna "Notas". Itens bloqueantes estão sinalizados com 🔴.

---

## 1. Pré-requisitos do Ambiente

Antes de iniciar a validação, garanta que:

- [ ] Todas as migrations foram aplicadas no banco produtivo (`supabase migration list` sem pendências).
- [ ] Variáveis de ambiente preenchidas (`docs/03-env-vars.md`).
- [ ] Bucket `client-media` (privado) e `tenant-logos` (público) existem no storage.
- [ ] Pelo menos **3 usuários reais** disponíveis para testar perfis distintos: `super_admin`, `owner`/`manager`, `staff`/`reception`, e `cliente final` (portal).
- [ ] Pelo menos **2 tenants** ativos com dados (use seeds em `docs/seeds/`).
- [ ] Caixa de e-mail real acessível por cada perfil de teste.
- [ ] **2 dispositivos físicos** (1 Android + 1 iOS) com WhatsApp instalado.

### Validado localmente em 30/06/2026 (baseline produção)

- [x] `npm ci` concluído com sucesso.
- [x] `vitest.config.ts` exclui specs Playwright em `src/tests/e2e/` e `src/__tests__/Auth.test.ts`.
- [x] Specs Playwright órfãos movidos para `e2e/` (`audit-security`, `go-live-readiness`, `onboarding-flow`, `ux-responsiveness`).
- [x] CI/CD: `.github/workflows/ci.yml` e `vercel.json` adicionados.
- [x] Hardening P0: error handling, debug overlays, PWA sem cache de API Supabase, billing copy atualizado.
- [x] `npm test`: **354/358** testes passando (4 falhas pré-existentes: `access-matrix` analytics×2, `safe-area-mobile` grid-cols-4, `SidebarNavItem` loading state).
- [x] `npm run build`: verde (PWA + bundle gerado em ~10s).
- [ ] `npm run lint`: 55 erros pré-existentes (`@typescript-eslint/no-explicit-any` e hooks deps) — não introduzidos por este hardening.

### Validado localmente em 23/04/2026

- [x] `npm test` passando com `321` testes.
- [x] `npm run build` concluindo com geração do bundle e PWA.
- [x] Browsers do Playwright instalados localmente.
- [x] Baseline visual pública de `/auth/login` gerada em `e2e/__screenshots__/`.
- [x] Testes críticos de shell mobile (`BottomNav` e `OfflineBanner`) sem warnings técnicos remanescentes na suíte local.
- [x] Smoke autenticada multi-rota validada para `/app`, `/app/agenda`, `/app/clientes` e `/app/confirmacoes`.
- [x] Trilha visual autenticada crítica validada no perfil `iphone-14-portrait`, incluindo baseline das rotas principais, cenários de navegação e detector de overlap do `BottomNav`.

### Validado localmente em 24/04/2026

- [x] `npm run test:storage:check` validado contra o Supabase real com usuário owner QA.
- [x] Bucket privado `client-media` validado com upload, URL assinada, download do conteúdo e remoção do objeto de teste.
- [x] `npm run test:crm:media` validado contra preview/build local + Supabase real.
- [x] Fluxo UI do CRM validado para criar cliente, anexar arquivo, ler por URL assinada, remover pela UI e limpar dados de teste.
- [x] Fluxo UI do CRM validado para anexar foto/imagem, ler por URL assinada, remover pela UI e limpar dados de teste.
- [x] `npm run test:portal:booking` validado contra preview/build local + Supabase real.
- [x] Portal validado com vínculo real `client_users`, serviço/disponibilidade reais e criação de appointment `source=client_portal`.
- [x] `npm run test:tenant:switch` validado contra preview/build local + Supabase real.
- [x] Recuperação de tenant inválido em cache e troca real de unidade pelo `TenantSwitcher` mobile validadas com cleanup sem sobras.
- [x] `npm run test:plan:limits` validado contra preview/build local + Supabase real.
- [x] Bloqueio de criação de unidade por limite/feature efetiva de plano validado com cleanup sem sobras.
- [x] `npm run test:import-export:clients` validado contra preview/build local + Supabase real.
- [x] Round-trip mínimo de clientes validado em `/app/dados`: importação CSV, persistência em `clients`, exportação CSV e cleanup sem sobras.
- [x] `npm run test:import-export:services` validado contra preview/build local + Supabase real.
- [x] Round-trip mínimo de serviços validado em `/app/dados`: importação CSV, persistência em `services`, preço base em `service_prices`, exportação CSV e cleanup sem sobras.
- [x] `npm run test:import-export:team` validado contra preview/build local + Supabase real.
- [x] Round-trip mínimo de equipe validado em `/app/dados`: importação CSV, persistência em `professionals`, comissão exportada via RPC segura e cleanup sem sobras.
- [ ] `npm run test:client:limit` criado, mas a execução atual pulou porque o tenant QA tem `max_active_clients=2000` e apenas `1` cliente ativo.
- [ ] `npm run test:team:invite` criado, mas a validação remota está bloqueada até aplicar a migration `20260424090000_fix_team_invitation_ambiguous_id.sql`; a RPC atual falha com `column reference "id" is ambiguous`.
- [ ] Cadastro de cliente final novo em `/portal/acesso` ainda exige caixa de e-mail real, pois o Auth retornou sessão pendente de confirmação.

---

## 2. Banco Real & Multi-tenant

### 2.1 RLS por perfil 🔴
- [ ] Logar como `super_admin` → confirmar acesso a todos os tenants em `/app/super-admin`.
- [ ] Logar como `owner` do Tenant A → confirmar **isolamento total** (nenhum dado do Tenant B aparece em CRM, agenda, analytics).
- [ ] Logar como `manager` do Tenant A → confirmar acesso de leitura/escrita igual ao owner, exceto operações sensíveis (faturamento, equipe).
- [ ] Logar como `reception`/`staff` → confirmar bloqueio de áreas restritas (Configurações, Faturamento, SuperAdmin).
- [ ] Tentar fazer `SELECT` direto via SQL com sessão de outro tenant → confirmar 0 linhas retornadas.

### 2.2 CRM (Fase 1) 🔴
- [ ] Criar cliente novo em `/app/clientes` com todos os campos (incluindo aniversário, VIP, risco).
- [ ] Editar cliente existente, adicionar tags e notas internas.
- [ ] Subir 1 foto + 1 documento (PDF) para o cliente → confirmar visualização e download via URL assinada.
- [ ] Remover arquivo → confirmar exclusão real no bucket.
- [ ] Validar campos customizados (criar definição em settings, preencher no cadastro do cliente).
- [ ] Validar consentimentos: criar template, enviar para cliente, registrar assinatura.
- [ ] Testar chips de filtro: aniversariantes do mês, VIP, inativos, risco elevado, por profissional preferido.

### 2.3 Catálogo (Fase 2)
- [ ] Criar/editar/excluir categoria, serviço, pacote, membership e protocolo.
- [ ] Configurar **preços por unidade** e por profissional → confirmar reflexo na agenda e portal.
- [ ] Validar que serviços inativos não aparecem para clientes no portal.

### 2.4 Agenda (Fase 3) 🔴
- [ ] Criar agendamento manual em `/app/agenda`.
- [ ] Remarcar (drag & drop ou edição).
- [ ] Mudar status (confirmado → em atendimento → finalizado / no-show / cancelado).
- [ ] Criar encaixe manual com **overbooking ativado** → confirmar flag `is_overbooked`.
- [ ] Criar bloqueio pontual (`time_off_blocks`) → confirmar que slots ficam indisponíveis.
- [ ] Criar bloqueio recorrente → confirmar reflexo via RPC `get_available_slots`.

### 2.5 Lista de espera (Fase 3)
- [ ] Adicionar cliente à lista de espera.
- [ ] Converter item da fila em agendamento → confirmar persistência de `scheduled_appointment_id`.

### 2.6 Central de Confirmações (Fase 4)
- [ ] Confirmar que a fila é gerada automaticamente para agendamentos das próximas 48h.
- [ ] Marcar tentativa, registrar ligação, definir `follow_up_at`.
- [ ] Validar preferências de canal (WhatsApp/SMS/email) por cliente.
- [ ] Validar janela de contato (não enviar fora do horário definido).

### 2.7 Analytics (Fase 6)
- [ ] Comparar métricas de retenção, rebooking e ocupação com cálculo manual em planilha (3 dias amostrais).
- [ ] Validar Índice Cativa em pelo menos 2 tenants.
- [ ] Validar filtro por serviço com appointments multi-item.
- [ ] Confirmar agrupamentos por profissional/unidade/serviço, inclusive registros legados sem `appointment_items`.

### 2.8 SuperAdmin & Billing (Fase 7)
- [ ] CRUD de planos, plan features, feature flags, templates por segmento.
- [ ] Aplicar desconto e override de assinatura → confirmar reflexo no `effective_subscription_limits`.
- [ ] Trocar plano em tempo de execução → confirmar bloqueios atualizados.
- [ ] Validar painel **Logs de Trial** em `/app/super-admin` (aba criada na última iteração).
- [ ] Forçar cenário de RLS denied (logar como staff e tentar ativar trial) → confirmar log de falha categorizada.

### 2.9 Import/Export (Fase 8)
- [x] Round-trip mínimo de clientes validado por E2E automatizado (`npm run test:import-export:clients`).
- [x] Round-trip mínimo de serviços validado por E2E automatizado (`npm run test:import-export:services`).
- [x] Round-trip mínimo de equipe validado por E2E automatizado (`npm run test:import-export:team`).
- [ ] Round-trip completo: exportar CSV → editar → reimportar para pacotes e agendamentos.
- [ ] Validar packs em `docs/seeds/` em tenant limpo (barbearia, estética facial, wellness).
- [ ] Importar agendamentos por nomes com **homônimos** e profissionais sem `display_name`.

---

## 3. Autenticação Multi-perfil 🔴

- [ ] Cadastro de novo usuário → receber e-mail de confirmação real.
- [ ] Confirmar e-mail → autologin funciona.
- [ ] Logout → não consegue mais acessar `/app/*`.
- [ ] Esqueci a senha → recebe e-mail real → reset funciona.
- [ ] Login com Google (se habilitado) → criação de profile automático.
- [ ] Convidar membro de equipe (`inviteMember`) → e-mail recebido → aceite cria `tenant_membership`.
- [ ] Tentar acessar `/app/super-admin` sem ser super_admin → bloqueio com mensagem clara.
- [ ] Trocar de tenant via `TenantSwitcher` → contexto e dados atualizam corretamente.
- [ ] Sessão expirada → redirect para login sem perda de rota original.

---

## 4. E-mails Reais

> Requer caixa de e-mail acessível e domínio configurado em **Cloud → Emails**.

- [ ] Confirmação de cadastro: chega em até 60s, com branding correto.
- [ ] Reset de senha: link válido por 1h, expira após uso.
- [ ] Convite de equipe: link inclui tenant correto.
- [ ] Magic link (se habilitado): autologin funciona.
- [ ] Verificar que o **From** mostra o domínio do cliente (não o padrão do Supabase).
- [ ] Verificar SPF/DKIM no header do e-mail recebido (Gmail → "Mostrar original").

---

## 5. Portal do Cliente (Fase 5) 🔴

- [ ] Cliente novo se cadastra em `/portal/acesso` → recebe e-mail de confirmação.
- [ ] Após confirmar e-mail, RPC `claim_portal_links_for_current_user()` vincula automaticamente o cliente ao(s) tenant(s) onde o e-mail já existia.
- [ ] Cenário multi-tenant: mesmo e-mail cadastrado em 2 tenants → portal mostra ambos.
- [ ] Cenário sem cadastro prévio: usuário cria conta mas e-mail não existe em nenhum tenant → mensagem clara orientando contato.
- [ ] Cliente confirma agendamento via portal → status atualiza em `/app/agenda`.
- [ ] Cliente reagenda via portal → respeita disponibilidade real (RPC `get_available_slots`).
- [ ] Cliente cancela → política de cancelamento aplicada.
- [ ] Cliente atualiza perfil → reflete em `/app/clientes`.
- [ ] Cliente assina termo de consentimento → registro em `consent_form_responses`.
- [ ] Cliente envia avaliação pós-atendimento → registro em `client_reviews`.

---

## 6. WhatsApp Manual (wa.me) — Dispositivo Físico

> Testar nos **2 dispositivos** (Android + iOS).

- [ ] Em `/app/confirmacoes`, abrir item da fila de um cliente **com WhatsApp**.
- [ ] Clicar em "Copiar mensagem" → texto copiado corretamente (validar com Ctrl+V em outro app).
- [ ] Clicar em "Abrir wa.me" → abre conversa correta no app WhatsApp instalado.
- [ ] Enviar mensagem real → registrar tentativa na fila.
- [ ] Cenário sem telefone: cliente sem `whatsapp_phone` nem `phone` → botão deve estar desabilitado com tooltip explicativo.
- [ ] Cenário com telefone inválido (ex: `00000`) → mensagem de erro amigável.

---

## 7. Mobile-first & PWA

### Matriz de dispositivos (validação manual)

| Viewport | Rotas a validar manualmente |
|----------|---------------------------|
| iPhone SE 375×667 | Agenda dialog, CRM create, Portal nav |
| Android 360×800 | Analytics filters, Confirmações tabs |
| iPhone 14 landscape | Safe-area lateral no BottomNav |

### Checklist zero scroll horizontal

- [ ] Abrir cada dialog principal sem arrastar lateralmente (Agenda, Clientes, Confirmações, Waitlist)
- [ ] Rotacionar para landscape sem conteúdo cortado
- [ ] Teclado virtual não esconde CTA primário (forms auth/portal)

### PWA e shell

- [ ] Acessar app pelo Chrome mobile (Android) → instalar PWA via banner.
- [ ] Acessar pelo Safari mobile (iOS) → adicionar à tela de início.
- [ ] Abrir offline → confirmar `offline.html` e banner de offline aparecem.
- [ ] Validar BottomNav: nenhum ícone coberto por badge ou elemento flutuante (E2E `bottom-nav-overlap.spec.ts` cobre, mas validar visualmente em iPhone SE e Galaxy S8).
- [ ] Menu "Mais": abre drawer corretamente, mostra skeletons durante loading, estado vazio quando aplicável.
- [ ] Tela de Assinatura: skeletons aparecem antes do conteúdo, sem layout shift.

### Suíte automatizada mobile (CI)

- [ ] `npm test` — Vitest inclui `pages-visual.test.ts`, `safe-area-mobile.test.ts` e `responsive-layout-patterns.test.ts`
- [ ] `npm run test:visual:public` — rotas públicas + marketing (`marketing-routes.spec.ts`)
- [ ] `npm run test:visual:auth:critical` — rotas autenticadas em iphone-14, iphone-se e android-360
- [ ] `npm run test:mobile:pre-release` — gate completo pré-publicação (Vitest + build + Playwright mobile)
- [ ] Baselines visuais em `e2e/__screenshots__/`: gerar com `npm run test:visual:update` quando credenciais E2E estiverem disponíveis; sem credenciais, specs autenticados são pulados (`AUTH_SKIP_REASON`)

---

## 8. Performance & Observabilidade

- [ ] Lighthouse mobile ≥ 85 em Performance, Accessibility, Best Practices, SEO.
- [ ] Carregar tenant com **>500 clientes** e **>1000 agendamentos** → tempos de resposta aceitáveis em CRM e Analytics.
- [ ] Validar que `audit_logs` está sendo populado em ações críticas (criar cliente, mudar status de agendamento, ativar trial).
- [ ] Validar que erros do frontend chegam ao console (sem mascarar).

---

## 9. Decisões de Produto Pendentes

> Não são bugs — exigem validação com operadores reais e registro formal.

- [ ] **Filtro por serviço em analytics**: confirmar com operador se "primeiro `appointment_item`" como serviço principal atende, ou se precisa de lógica diferente (mais caro, mais longo, etc.).
- [ ] **Importadores de memberships/protocolos**: revalidar decisão de manter apenas exportação. Se >3 tenants pedirem, criar importador.
- [ ] **Limites de `max_professionals` e `max_storage_mb`**: validar em ambiente real os bloqueios já implementados em código e no banco.
- [ ] **Feature gating do portal**: confirmar manter portal sempre aberto para leitura do cliente final, mesmo com tenant inadimplente.

---

## 10. Smoke Final 🔴

Executar em ambiente produtivo, em **uma única sessão**, na ordem:

1. [ ] Login como owner novo tenant.
2. [ ] Onboarding completo (criar tenant, unidade, primeiro serviço).
3. [ ] Cadastrar 3 clientes via CRM.
4. [ ] Criar 3 agendamentos para os próximos 2 dias.
5. [ ] Ativar trial via tela de Assinatura.
6. [ ] Conferir Central de Confirmações populada.
7. [ ] Logar em outro navegador/dispositivo como **cliente final**, vincular portal, confirmar agendamento.
8. [ ] Voltar como owner, ver status atualizado e métricas em Analytics.
9. [ ] Exportar CSV de clientes e agendamentos.
10. [ ] Testar busca global `⌘K` em desktop e mobile (search e date).

---

## Encerramento

Quando todos os itens 🔴 estiverem marcados:

- [ ] Atualizar `docs/00-pendencias-por-fase.md` movendo itens validados para um bloco "✅ Validado em produção em DD/MM/YYYY".
- [ ] Publicar release notes.
- [ ] Comunicar operadores via canal oficial.

**Operador responsável:** ____________________
**Data de conclusão:** ____________________
**Versão validada (commit hash):** ____________________
