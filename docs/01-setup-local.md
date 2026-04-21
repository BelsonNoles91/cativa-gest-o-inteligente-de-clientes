# 1. Setup local

Pré-requisitos:

- **Node.js 20+** (recomendamos via `nvm`)
- **npm** ou **bun** (qualquer um funciona; use o que preferir)
- Acesso a um projeto Supabase — pode ser:
  - Supabase Cloud
  - Supabase self-hosted (Docker)
  - Lovable Cloud (gerenciado, sem ação manual)

## Passos

```bash
# 1. Clone
git clone <url-do-seu-fork>
cd cativa

# 2. Variáveis
cp .env.example .env
# edite .env com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY

# 3. Instale e suba
npm install
npm run dev
```

App disponível em `http://localhost:8080` (porta padrão do Vite neste projeto).

## Scripts

```bash
npm run dev       # ambiente de desenvolvimento
npm run build     # bundle de produção (estático)
npm run preview   # serve o bundle gerado para validar
npm run test      # vitest
```

## Verificações pós-setup

- Faça login com um usuário válido e crie um tenant via onboarding.
- Cheque a aba **Configurações → Importar/Exportar** — baixe um modelo CSV.
- Em **Super Admin** (apenas usuários com `is_super_admin = true`), valide
  planos e feature flags.
