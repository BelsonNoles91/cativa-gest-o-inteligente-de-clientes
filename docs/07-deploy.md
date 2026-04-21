# 7. Deploy externo / VPS

A aplicação é uma **SPA estática** servida por qualquer CDN ou web server.
Não há server SSR.

## Build

```bash
npm run build
# saída em dist/
```

## Vercel / Netlify

1. Conecte o repositório.
2. Build command: `npm run build` · Output: `dist`
3. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_PROJECT_ID`.
4. Adicione redirect SPA: `/* → /index.html 200`.

## VPS + Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name app.seudominio.com;

  root /var/www/cativa/dist;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  # cache agressivo de assets versionados
  location ~* \.(js|css|woff2?|svg|png|jpg|webp)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
  }
}
```

## Backend Supabase

Use **Supabase Cloud** (mais simples) ou **self-hosted** via Docker:

```bash
git clone https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
docker compose up -d
```

Aplique as migrations de `supabase/migrations/` na ordem alfabética e
configure os buckets (`client-media` privado).

## Storage de uploads

O bucket `client-media` é **privado**. Em hospedagem própria, configure CORS
para o domínio do app e mantenha o bucket inacessível publicamente — leitura
sempre via signed URLs gerada no servidor/edge function.
