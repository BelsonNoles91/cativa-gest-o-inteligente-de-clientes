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

## QA local / Playwright

Estas variáveis não fazem parte do runtime de produção. Servem apenas para a
validação E2E autenticada local ou em CI:

| Variável | Descrição |
|---|---|
| `E2E_USER` | E-mail do usuário seed usado pelo Playwright para login real. |
| `E2E_PASS` | Senha do usuário seed. |
| `E2E_BASE_URL` | (Opcional) URL base do ambiente a ser validado. Se ausente, usa `http://localhost:8080`. |

Recomendação:

1. Salvar essas variáveis em `.env.local`.
2. Manter o usuário seed com pelo menos um `tenant_membership` ativo.
3. Usar `npm run test:visual:public` quando quiser validar apenas rotas públicas
   sem precisar de credenciais.
4. Usar `npm run test:visual:check` antes da fase autenticada para confirmar
   rapidamente se o ambiente local está pronto.
5. Usar `npm run test:visual:roles` quando houver múltiplos usuários QA por
   papel (`owner`, `manager`, `frontdesk`, `professional`).
