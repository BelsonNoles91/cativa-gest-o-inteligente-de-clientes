# 12. Rastreabilidade do Prompt Original

Este documento mapeia os blocos principais do `prompt_original.txt` para os
artefatos do repositório. O objetivo é permitir auditoria rápida de aderência.

## Regras fixas e arquitetura

| Requisito | Evidência principal |
| --- | --- |
| Multi-tenant real + `tenant_id` + RLS | `supabase/migrations/20260421195836_469eb6fc-b7ec-4aab-85bf-5cb0f7b24f0d.sql`, `docs/04-database.md`, `docs/09-seguranca.md` |
| Supabase Auth, Postgres e Storage | `src/features/auth/AuthProvider.tsx`, `src/integrations/supabase`, `docs/03-env-vars.md` |
| Migrations versionadas | `supabase/migrations/` |
| Portabilidade além do Lovable | `docs/08-portabilidade.md`, `src/repositories`, `src/services`, `src/domain` |
| Importação/exportação CSV e JSON | `src/pages/app/DataImportExport.tsx`, `src/services/import-export/`, `docs/06-import-export.md` |
| Deploy externo / VPS | `docs/07-deploy.md` |
| Backup e restore | `docs/05-backup-restore.md` |
| Interface em pt-BR e estrutura técnica em inglês | `src/pages`, `src/components`, `src/repositories`, `src/domain` |
| WhatsApp apenas manual | `src/pages/app/ConfirmationCenter.tsx`, `src/features/confirmation/ConfirmationActionDialog.tsx`, `docs/09-seguranca.md` |
| Sem módulo fiscal | escopo do produto e ausência deliberada de qualquer módulo fiscal no código |

## Etapas do produto

| Etapa | Evidência principal |
| --- | --- |
| 1. Fundação visual e estrutural | `src/App.tsx`, `src/components`, `src/features/theme`, `README.md` |
| 2. Auth, onboarding, permissões e tenant | `src/features/auth`, `src/pages/auth/Onboarding.tsx`, migration `20260421195836_*.sql` |
| 3. CRM | `src/pages/app/Clients.tsx`, `src/repositories/clients.ts`, migration `20260421200744_*.sql` |
| 4. Catálogo | `src/pages/app/Services.tsx`, `src/pages/app/Packages.tsx`, `src/repositories/catalog.ts` |
| 5. Agenda | `src/pages/app/Agenda.tsx`, `src/pages/app/Waitlist.tsx`, `src/repositories/scheduling.ts` |
| 6. Central de confirmação | `src/pages/app/ConfirmationCenter.tsx`, `src/repositories/confirmation.ts`, migration `20260421223000_*.sql` |
| 7. Portal do cliente | `src/pages/portal`, `src/features/portal/PortalClientProvider.tsx`, migration `20260421235500_*.sql` |
| 8. Analytics e Índice Cativa | `src/pages/app/Analytics.tsx`, `src/domain/analytics.ts`, `docs/10-metricas.md` |
| 9. Billing SaaS e super admin | `src/pages/app/Billing.tsx`, `src/pages/app/SuperAdmin.tsx`, `src/features/billing` |
| 10. Import/export, seeds, docs e segurança | `src/pages/app/DataImportExport.tsx`, `docs/05-backup-restore.md`, `docs/06-import-export.md`, `docs/11-seeds-demo.md` |
| 11. Landing e planos públicos | `src/pages/public/Landing.tsx`, `src/pages/public/Pricing.tsx` |

## Status formal por bloco

| Bloco do prompt | Status | Observação |
| --- | --- | --- |
| Regras fixas e arquitetura | Implementado | Multi-tenant, RLS, portabilidade, Supabase, WhatsApp manual e ausência de módulo fiscal estão refletidos no código e nas migrations. |
| 1. Fundação visual e estrutural | Implementado | Shell, rotas, layout e base visual estão consolidados. |
| 2. Auth, onboarding, permissões e tenant | Implementado com adaptação | Fluxo entregue; diferença principal é a modelagem de papéis via `app_role` + permissões, não uma tabela `roles` literal. |
| 3. CRM | Implementado | CRM amplo com ficha, timeline, anexos, fotos, consentimentos e custom fields. |
| 4. Catálogo | Implementado | Serviços, preços, pacotes, memberships e protocolos cobertos. |
| 5. Agenda | Implementado | Agenda, waitlist, bloqueios, disponibilidade e visão por recurso/sala presentes. |
| 6. Central de confirmação | Implementado | Aderente ao modelo manual de confirmação definido no prompt. |
| 7. Portal do cliente | Implementado | Fluxos centrais de acesso, agenda, reagendamento, cancelamento e perfil já existem. |
| 8. Analytics e Índice Cativa | Implementado com adaptação | Entregue e reorganizado por contexto; ainda sem uma camada mais profunda de coorte/funil dedicada. |
| 9. Billing SaaS e super admin | Implementado com adaptação | A lógica existe, mas a modelagem não replica literalmente estruturas como `trial_rules` e `usage_limits`. |
| 10. Import/export, seeds, docs e segurança | Implementado com validação externa pendente | Cobertura forte em código/docs; falta fechar validação integrada com ambiente real. |
| 11. Landing e planos públicos | Implementado | Frente pública madura e aderente ao escopo. |

## Fechamentos finais da Fase 9

| Fechamento | Evidência principal |
| --- | --- |
| Dashboard deixou de ser mock e passou a refletir dados reais | `src/pages/app/Dashboard.tsx` |
| Busca global funcional com `⌘K` | `src/components/shell/GlobalSearch.tsx` |
| Rotas principais com lazy loading / code-splitting | `src/App.tsx` |
| Navegação por contexto em busca global (`search`/`date`) | `src/pages/app/Clients.tsx`, `src/pages/app/Services.tsx`, `src/pages/app/Agenda.tsx` |

## Atualizações verificadas em 23/04/2026

| Fechamento | Evidência principal |
| --- | --- |
| Workspace volta a fechar `test` e `build` | `package-lock.json`, validação local com `npm test` e `npm run build` |
| Convite real de equipe com aceite por token e enforcement de `max_professionals` | `src/services/team/inviteMember.ts`, `src/pages/auth/AcceptInvite.tsx`, migration `20260422224034_*.sql` |
| Storage com leitura real no app e hard-limit no banco | `src/repositories/billing.ts`, `src/pages/app/Billing.tsx`, migration `20260422224034_*.sql` |
| CRM bloqueia upload acima do plano antes do envio | `src/pages/app/Clients.tsx` |
| Agenda com visão explícita por recurso/sala | `src/pages/app/Agenda.tsx` |
| Analytics separado por contexto executivo, operacional e retenção | `src/pages/app/Analytics.tsx` |
| Diálogos e sheets críticos com descrição acessível | `src/components/shell/BottomNav.tsx`, `src/features/settings/UnitsSettings.tsx`, `src/pages/app/Clients.tsx`, `src/pages/app/SuperAdmin.tsx` |
| Suite local sem warnings remanescentes de `MemoryRouter` nos testes críticos | `src/test/a11y-bottom-nav-offline-banner.test.tsx`, `src/test/safe-area-bottom-nav-computed.test.tsx` |

## Validação sugerida

1. Login e troca de tenant/unidade.
2. Cadastro de cliente e uso do CRM.
3. Cadastro de serviço e pacote.
4. Criação de agendamento e confirmação manual.
5. Acesso do cliente ao portal.
6. Leitura de analytics, billing e super admin.
7. Exportação e reimportação de dados.

## Validação executada nesta máquina

| Tipo | Resultado | Observação |
| --- | --- | --- |
| `npm test` | OK | 321 testes passaram. |
| `npm run build` | OK | Build e geração PWA concluídos. |
| Testes críticos de navegação/acessibilidade | OK | `BottomNav` e `OfflineBanner` passam sem warnings técnicos remanescentes da suíte local. |
| Playwright público (`/auth/login`) | OK | Baseline pública gerada e execução local estabilizada na configuração do Playwright. |
| Playwright autenticado (`/app/*`) | Bloqueado por ambiente | `E2E_USER` e `E2E_PASS` não estão configurados no workspace atual. |
