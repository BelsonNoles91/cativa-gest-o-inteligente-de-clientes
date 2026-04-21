# 3. Variáveis de ambiente

Veja o arquivo `.env.example` na raiz para o modelo completo.

## Front-end (públicas)

Apenas chaves **publicáveis** ficam no client. São prefixadas por `VITE_`:

| Variável | Descrição |
|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave anon/publishable (segura no browser). |
| `VITE_SUPABASE_PROJECT_ID` | (Opcional) Ref do projeto. |

## Back-end / Edge Functions

NUNCA expor no front. Mantidas como **secrets** no provedor:

| Secret | Para quê |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Operações administrativas (server-side only). |
| `SUPABASE_DB_URL` | Conexão direta ao Postgres para scripts/migrations. |
| `LOVABLE_API_KEY` | (Se usar) gateway de IA da Lovable. |

## Em Lovable Cloud

O `.env` é **gerenciado automaticamente**. Você não precisa editar.

## Em hospedagem própria (Vercel/Netlify/VPS)

1. Crie um projeto Supabase (cloud ou self-hosted).
2. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas envs do
   provedor de hospedagem.
3. Para edge functions, configure os secrets equivalentes diretamente no
   Supabase do seu projeto.
