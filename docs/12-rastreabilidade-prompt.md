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

## Fechamentos finais da Fase 9

| Fechamento | Evidência principal |
| --- | --- |
| Dashboard deixou de ser mock e passou a refletir dados reais | `src/pages/app/Dashboard.tsx` |
| Busca global funcional com `⌘K` | `src/components/shell/GlobalSearch.tsx` |
| Rotas principais com lazy loading / code-splitting | `src/App.tsx` |
| Navegação por contexto em busca global (`search`/`date`) | `src/pages/app/Clients.tsx`, `src/pages/app/Services.tsx`, `src/pages/app/Agenda.tsx` |

## Validação sugerida

1. Login e troca de tenant/unidade.
2. Cadastro de cliente e uso do CRM.
3. Cadastro de serviço e pacote.
4. Criação de agendamento e confirmação manual.
5. Acesso do cliente ao portal.
6. Leitura de analytics, billing e super admin.
7. Exportação e reimportação de dados.
