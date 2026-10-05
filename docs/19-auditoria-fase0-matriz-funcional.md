# Auditoria — Fase 0: Congelamento funcional e mapa real do projeto

Data: 2026-09-24. Nenhum código de produto ou banco alterado nesta fase.

## 1. Stack descoberta
| Item | Valor |
|---|---|
| Framework / linguagem | React 18 + Vite 5 + TypeScript 5 (SPA) |
| Rotas | React Router (`src/App.tsx`), telas carregadas sob demanda + `PreloadAppModules` |
| UI | Tailwind v3 + shadcn/ui, tokens HSL em `src/index.css`, claro/escuro |
| Dados no cliente | TanStack Query + `TenantRealtimeSync` (realtime por tenant) |
| Banco | Postgres (Lovable Cloud), RLS em todas as tabelas, 89 funções SECURITY DEFINER |
| Autenticação | E-mail/senha (equipe), Google e Apple (equipe e clientes), convites por token |
| Armazenamento | Storage: logos do estabelecimento (público), arquivos/fotos de clientes (privado) |
| Funções server-side | `appointment-summary` (IA), `push-dispatch` (Web Push), `retention-advisor`, `retention-insights`, `security-finding-advisor`, `admin-provision-test-users` |
| Integrações | Lovable AI (resumos), Web Push self-hosted (VAPID), Sentry, PWA/service worker |
| WhatsApp | **Semiautomático**: `integrations/whatsapp/manual.ts` gera link `wa.me` + texto; usuário envia e registra o resultado. Sem API. |
| Pagamentos | **Inexistentes.** Há planos/limites/trials e gestão administrativa de assinaturas, sem cobrança, checkout ou gateway |
| Ambiente | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`; guarda de boot em `main.tsx` |

## 2. Páginas existentes
**Públicas:** `/` (landing), `/planos`, `/pricing`, `/privacidade`, `/termos`, `/status`, `/e/:slug` (página e agendamento do estabelecimento).
**Auth:** `/auth/login`, `/auth/recuperar`, `/auth/reset-password`, `/auth/aceite-convite`, `/portal/acesso`, `/onboarding`.
**Portal do cliente (`/portal`):** início, agenda, agendar, historico, pacotes, perfil, anamnese.
**Painel (`/app`):** painel, agenda, clientes, confirmacoes, lista-de-espera, minha-agenda, perfil, retorno, painel-gestor/clientes, avaliacoes, comissoes, painel-gestor, metas, servicos, pacotes, analytics, meu-plano, assinatura, dados, configuracoes, super-admin. Página 404.

## 3. Perfis (descobertos no código e no banco)
Enum `app_role`: super_admin, owner, manager, frontdesk, professional, client. Papéis de equipe em `tenant_memberships` (tabela separada), super admin por flag global verificada em `is_super_admin()`; clientes via `client_users`. **Não existe tabela `user_roles`**; a função equivalente é feita por `tenant_memberships` + funções `is_tenant_member / has_tenant_role / has_any_tenant_role`.

| Perfil | Telas / menu | Dados acessíveis | Ações permitidas | Proibidas |
|---|---|---|---|---|
| super_admin | Administração (Sistema Cativa / Contas e acessos) + entrada auditada em qualquer tenant | Toda a plataforma | Planos, recursos, flags, incidentes, segurança, auditoria, assinaturas, membros | Nada restrito além de auditoria obrigatória |
| owner | Todo o menu do tenant, incl. plano, assinatura, dados, configurações | Todo o tenant | CRUD de equipe, serviços, agenda, clientes, import/export, configurações | Outros tenants; admin global |
| manager | Igual ao owner no menu | Todo o tenant | Igual ao owner (exceto remover último owner) | Outros tenants; admin global |
| frontdesk | Painel, Agenda, Confirmar, Clientes, Espera, Retorno, Clientes (gestão), Avaliações | Agenda, clientes, fila de confirmação | Agendar, remarcar, cancelar, confirmar (WhatsApp manual), lista de espera | Comissões, metas, serviços, relatórios, plano, configurações |
| professional | Painel, Agenda, Minha agenda, Perfil | Próprios agendamentos (ou todos se `professional_sees_all`) | Ver agenda, pedir folgas/ajustes, atualizar próprio perfil | Clientes em massa, financeiro/comissões dos outros, configurações |
| client | Portal pessoal | Somente seus dados e históricos | Agendar/cancelar/remarcar conforme regras de autoatendimento, apenas em estabelecimentos com histórico ou vínculo via link público | Dados de outros clientes; agendar em estabelecimento sem vínculo |

## 4. Núcleo funcional existente
Clientes (CRM, tags, notas, fotos, arquivos, termos, anamnese) · Profissionais (disponibilidade, folgas, pedidos de agenda) · Serviços (categorias, preços por unidade/profissional) · Agenda (dia/semana, filtros, recursos/salas) · Disponibilidade (`get_available_slots`, horário da unidade) · Agendamentos (criação atômica, exclusão por profissional e por recurso) · Cancelamentos e políticas · Reagendamentos · Bloqueios (time_off, recorrentes, fechamentos) · Confirmação (fila priorizada + WhatsApp manual) · Notificações (Web Push) · Lista de espera · Retorno/reativação com cupons · Avaliações · Pacotes/protocolos/memberships · Metas, ranking e comissões · Dashboards (painel, gestor, relatórios, Índice Cativa) · Portal do cliente e do profissional · Página pública `/e/:slug` · Importar/exportar CSV/JSON · Configurações · Planos/limites/feature flags · Administração global.

## 5. Peças compartilhadas
- Layouts: `AppLayout`, `PortalLayout`, `AuthLayout`, `AppSidebar`, `BottomNav`, `AppHeader`.
- Contexts/providers: `AuthProvider`, `TenantProvider`, `TenantBillingProvider`, `ThemeProvider`, `TenantRealtimeSync`, `PreloadAppModules`.
- Guards: `ProtectedRoute`, `RequireOnboarding`, `RoleGuard`, `FeatureGate`.
- Domain: `roles.ts`, `permissions.ts`, `scheduling.ts` (`canTransition`, status), `billing.ts`, `confirmation.ts`, `self-service.ts`, `client.ts`.
- Repositories: um por módulo (scheduling, clients, catalog, billing, confirmation, portal…).
- Autorização no banco: `is_super_admin`, `is_tenant_member`, `has_tenant_role`, `has_any_tenant_role`, `is_portal_client_of`, `client_owns_appointment`, `portal_can_book`.
- Datas/disponibilidade: `get_available_slots`, `check_appointment_conflicts`, `create_appointment_atomic`, `create_public_appointment`, fuso do tenant.

## 6. Banco (82 tabelas, todas com `tenant_id` exceto catálogo global)
Todas as PKs são `id uuid`. Relações principais:
- `tenants` → `units`, `tenant_memberships`, `tenant_settings`, `tenant_public_pages`, `tenant_subscriptions` (→ `plans`, `subscription_events`).
- `clients` (→ tenants, units, professionals, services) ← `client_users`, `client_notes/files/photos/tags/timeline`, `channel_preferences`.
- `appointments` (→ clients, professionals, resources, units, cancellation_policies) ← `appointment_items` (→ services, saldos de pacote/membership), `appointment_status_history`, `appointment_logs`, `confirmation_queue`, `contact_attempts`, `call_logs`, `client_reviews`, `reactivation_coupons`.
- Constraints relevantes: `appointments_pro_no_overlap` e `appointments_resource_no_overlap` (EXCLUDE) impedem conflito.
- Autorizados: staff do tenant por papel; cliente só as próprias linhas; anônimo somente `plans` públicos, `system_status` e logos.
- Estado atual: 0 estabelecimentos, 0 clientes, 0 agendamentos, 4 planos, 1 usuário (super admin), após a limpeza pré-produção.

## 7. Matriz funcional oficial
| Módulo | owner | manager | frontdesk | professional | client | super_admin |
|---|---|---|---|---|---|---|
| Agenda / agendar | ✔ | ✔ | ✔ | próprios | portal/link | via tenant |
| Clientes (CRM) | ✔ | ✔ | ✔ | — | próprio perfil | via tenant |
| Confirmação WhatsApp manual | ✔ | ✔ | ✔ | — | — | via tenant |
| Lista de espera / retorno | ✔ | ✔ | ✔ | — | — | via tenant |
| Serviços, pacotes, metas, comissões, relatórios | ✔ | ✔ | — | — | — | via tenant |
| Minha agenda / pedidos de folga | ✔ | ✔ | — | ✔ | — | — |
| Plano, assinatura, dados, configurações | ✔ | ✔ | — | — | — | ✔ |
| Portal do cliente | — | — | — | — | ✔ | — |
| Administração global | — | — | — | — | — | ✔ |

## 8. Observações registradas (sem correção nesta fase)
| Prioridade | Item |
|---|---|
| Info | O protocolo cita "não existem assinaturas", mas o produto tem planos, trials e gestão administrativa de assinaturas **sem cobrança**. Preservado. |
| P3 | Corrigido em 2026-10-04: assinatura e fallback público ainda mostravam "Apoio gratuito para sempre" e planos antigos após a linha Começo/Solo/Equipe/Rede. Agora exibem os quatro planos atuais e distinguem Começo grátis por 30 dias dos trials premium de 14 dias. |
| P3 | Menu tem dois itens "Clientes" (operação e gestão), pode confundir. |
| P4 | `README.md` desatualizado ("Lovable Cloud previsto", "Etapa 1", "TypeSafe Jev"). |
| P4 | Memória/documentação cita `user_roles`; o banco usa `tenant_memberships` (função equivalente, segura). |
| P4 | Linter do banco: 98 avisos sobre funções SECURITY DEFINER executáveis, a revisar na Fase 11. |
