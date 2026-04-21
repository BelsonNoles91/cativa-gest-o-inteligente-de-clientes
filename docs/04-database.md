# 4. Banco de dados, migrations e RLS

## Migrations

Todas as alterações estruturais ficam em `supabase/migrations/` —
**versionadas, incrementais, jamais editadas após aplicadas**. Não existe
migration de "reset" — cada nova etapa é aditiva.

Para aplicar manualmente em outro Supabase:

```bash
supabase link --project-ref <ref>
supabase db push
```

Ou rode os arquivos `.sql` em ordem alfabética via psql.

## Tabelas principais

- `tenants`, `units`, `tenant_memberships` — multi-tenant + papéis
- `profiles`, `user_roles` — usuários do sistema
- `clients`, `client_users`, `client_*` — CRM e portal
- `services`, `service_categories`, `service_prices` — catálogo
- `packages`, `memberships`, balances/subscriptions — venda recorrente
- `professionals`, `professional_availability`, `unit_business_hours`,
  `time_off_blocks`, `recurring_blocks`, `resources` — agenda
- `appointments`, `appointment_items`, `appointment_status_history`,
  `appointment_logs` — operação da agenda
- `confirmation_queue`, `confirmation_rules`, `contact_attempts`,
  `call_logs`, `message_templates`, `channel_preferences` — central de
  confirmação
- `consent_form_templates`, `consent_form_responses` — termos
- `cancellation_policies` — políticas
- `plans`, `plan_features`, `tenant_subscriptions`,
  `subscription_events`, `feature_flags`, `usage_snapshots`,
  `segment_templates` — billing SaaS
- `audit_logs` — auditoria

## Row Level Security (RLS)

**Toda tabela com tenant_id tem RLS ativa.** As políticas se apoiam em três
funções `SECURITY DEFINER`:

- `is_tenant_member(uid, tenant_id)` — staff lê dados do próprio tenant.
- `has_tenant_role(uid, tenant_id, role)` — checagem de papel específico.
- `has_any_tenant_role(uid, tenant_id, roles[])` — múltiplos papéis aceitos.
- `is_super_admin(uid)` — bypass apenas para super admin.
- `is_portal_client_of(uid, client_id)` — vínculo cliente↔usuário do portal.
- `client_owns_appointment(uid, appointment_id)` — derivada de cima.

Padrão de política:

- **SELECT**: `is_tenant_member(...)` OR (no portal) `is_portal_client_of(...)`
- **INSERT/UPDATE/DELETE**: `has_any_tenant_role(...)` para staff;
  no portal apenas em rotas explícitas (ex.: criar review do próprio agendamento).

## Funções de domínio no banco

- `get_available_slots(...)` — motor de slots para agenda.
- `calculate_queue_priority(...)` — prioridade na central de confirmação.
- `effective_subscription_limits(...)` — limites efetivos do plano (com override).
- `log_appointment_status_change()` — trigger que popula `appointment_status_history`.
