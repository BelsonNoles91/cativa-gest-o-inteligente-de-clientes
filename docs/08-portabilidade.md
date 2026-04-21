# 8. Portabilidade e pontos de acoplamento

A arquitetura **não depende do Lovable**. Tudo o que parece "Lovable" é, na
prática, código padrão React + Supabase em um Vite project. Esta seção
documenta cada ponto de acoplamento ao Supabase para que uma migração
futura para outro backend seja viável sem refatoração total.

## O que é puramente portável

- **`domain/`** — TS puro, sem dependências externas.
- **`utils/`** — TS puro (CSV parser interno, slug, etc.).
- **`components/`, `pages/`, `features/`** — React + shadcn padrão.
- **`services/`** — depende apenas de `domain/` + `repositories/`.

## O que toca Supabase diretamente (e como trocar)

### `integrations/supabase/client.ts` — única instância do client

Fonte única do client. Para trocar de backend, troque este arquivo por
um adapter equivalente (REST/GraphQL/outro SDK) que exponha a mesma API
mínima usada pelos repositories.

> **Não edite este arquivo direto** — ele é gerado em projetos Lovable.
> Em forks self-hosted, sinta-se à vontade para substituí-lo.

### `repositories/` — toda I/O fica aqui

Cada `*.ts` em `repositories/` agrupa **todas** as queries de uma área
(clientes, catálogo, agenda, billing, analytics, ...). UI/services
chamam funções deste módulo.

Para migrar para outro backend:

1. Crie uma nova implementação que respeite as mesmas assinaturas.
2. Aponte os imports.
3. UI/services não mudam.

### `integrations/whatsapp/manual.ts`

Helpers `wa.me` — independente de qualquer integração. Continua igual em
qualquer host.

### Edge Functions (quando existirem)

Edge functions ficam em `supabase/functions/<nome>/index.ts`. Cada uma é
um Deno HTTP handler que pode ser migrado para qualquer runtime serverless
(Cloudflare Workers, Vercel Functions, Hono em VPS) com mudanças cosméticas
de imports.

## Storage

O único bucket usado é `client-media` (privado). Convenção de path:

```
<tenant_id>/<client_id>/<photo|file>/<uuid>.<ext>
```

Em outro provedor (S3, R2, Backblaze), basta ajustar o adapter de storage —
não há lógica do produto que dependa do nome do bucket.

## Auth

Usamos email/senha + (opcional) Google OAuth via Supabase Auth.
Em outro backend, reimplementar em `features/auth/AuthProvider.tsx`
mantendo a interface `{ user, session, loading, signIn, signUp, signOut }`.

## Realtime

Não usamos realtime no MVP. Se vier a ser usado, ficará isolado em
hooks `useXyzRealtime`, sem espalhar pelo código.

## Checklist de migração

- [ ] Reproduzir o schema (rodar todas as migrations em `supabase/migrations/`).
- [ ] Criar adapter equivalente em `integrations/supabase/client.ts`.
- [ ] Copiar storage (bucket `client-media`).
- [ ] Recriar usuários (ou exportar/importar `auth.users`).
- [ ] Testar smoke: login → onboarding → agenda → confirmação.
