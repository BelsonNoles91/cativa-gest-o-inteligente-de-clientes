# 9. Segurança e privacidade

## Princípios

- **Tenant isolation por RLS** — não confiamos no cliente para filtrar
  dados de outro tenant.
- **Server-side authorization** — papéis verificados via funções
  `SECURITY DEFINER` no banco. Nunca acreditamos em claims do client.
- **Acesso mínimo necessário** — políticas escritas para o papel mais
  restrito que ainda atenda à operação.
- **Auditoria** — `audit_logs` captura ações sensíveis (e há
  `appointment_status_history` para a agenda).

## RLS — checklist por tabela

Todas as tabelas com `tenant_id` têm RLS ativa. Padrão:

```
SELECT  → is_tenant_member(uid, tenant_id) OR is_super_admin(uid)
ALL     → has_any_tenant_role(uid, tenant_id, ARRAY[...]) OR is_super_admin(uid)
```

Tabelas do **portal do cliente** ganham políticas adicionais com
`is_portal_client_of(uid, client_id)` para leitura/edição dos próprios
dados.

## Papéis (roles)

`super_admin > owner > manager > frontdesk > professional > client`

- `super_admin` é flag em `profiles.is_super_admin`. Funções DB usam
  `is_super_admin(uid)`.
- Demais papéis ficam em `tenant_memberships` (não em `profiles` ou
  `users`) — evita escalação de privilégio.

## Secrets

- Apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no client.
- `SERVICE_ROLE`, `LOVABLE_API_KEY`, `SUPABASE_DB_URL` ficam **apenas em
  edge functions / scripts server-side**.

## Exportação de dados

Cada negócio pode exportar seus próprios dados a qualquer momento (CSV/JSON)
em **Configurações → Importar & Exportar**. Não há lock-in de dados.

## Anonimização / desativação

- Cliente pode ser **desativado** (`status = 'inactive'`) — mantém histórico
  para integridade analítica, mas remove de listas operacionais ativas.
- A exclusão definitiva (`DELETE`) é restrita a `owner/manager` e remove
  registros relacionados via `ON DELETE CASCADE` quando aplicável.
- Para LGPD/GDPR-style data erasure, o procedimento recomendado é:
  1. Exportar dados do cliente (JSON).
  2. Anonimizar campos diretos (`full_name`, `email`, `phone`, `whatsapp_phone`,
     `birth_date`, `notes`).
  3. Manter `id` e métricas agregadas para integridade dos dashboards.

## Logs e PII

- `audit_logs.metadata` é JSONB — evite armazenar PII desnecessária ali.
- `appointment_logs` armazena apenas IDs e mudanças de estado.
