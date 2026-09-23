import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  // ─────────────────────────────────────────────────────────────
  // Guard de variáveis obrigatórias no build de produção.
  // Evita publicar um bundle quebrado ("supabaseUrl is required.")
  // quando o .env não foi injetado no ambiente de build.
  // Em dev / build:dev apenas avisa — não bloqueia.
  // ─────────────────────────────────────────────────────────────
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") };
  // Credenciais públicas do cliente. O fallback mantém o bundle funcional
  // quando o ambiente de publicação não injeta as variáveis gerenciadas.
  // Nunca incluir aqui service role, senha do banco ou qualquer segredo.
  const managedPublicUrl = "https://pegvtrvqdvzxysndddts.supabase.co";
  const managedPublishableKey =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZ3Z0cnZxZHZ6eHlzbmRkZHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3OTY5MjksImV4cCI6MjA5MjM3MjkyOX0.oZH96G_G5GRHbuX4Gj-Kswb8VmMHC83oZuFqlBqQaSY";
  const configuredSupabaseUrl = env.VITE_SUPABASE_URL;
  const configuredSupabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const supabaseUrl = configuredSupabaseUrl || managedPublicUrl;
  const supabaseKey = configuredSupabaseKey || managedPublishableKey;

  const missing: string[] = [];
  if (!configuredSupabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!configuredSupabaseKey)
    missing.push("VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY)");

  if (missing.length > 0) {
    const message = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║  ❌  Variáveis de ambiente obrigatórias ausentes             ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
      "As seguintes variáveis não estão definidas no ambiente de build:",
      ...missing.map((v) => `  • ${v}`),
      "",
      "Sem elas o cliente Supabase inicializa como `undefined` e a",
      "aplicação publicada falha com \"supabaseUrl is required.\".",
      "",
      "Como resolver:",
      "  1. Verifique se o arquivo `.env` existe na raiz do projeto.",
      "  2. Confirme que a conexão do Lovable Cloud / Supabase está",
      "     ativa (ela é quem popula essas variáveis).",
      "  3. Em hospedagens externas (Vercel/Netlify), configure as",
      "     variáveis no painel do provedor antes do build.",
      "",
    ].join("\n");

    // Só bloqueia em build de PRODUÇÃO. `build:dev` (mode=development)
    // e `vite dev` apenas avisam, para não travar preview/sandbox
    // enquanto o .env ainda não foi injetado.
    // Nunca bloqueia o build: o runtime já exibe BackendConfigMissingScreen
    // com instruções acionáveis caso as variáveis realmente estejam ausentes
    // no bundle publicado. Bloquear aqui impede republish quando o .env
    // gerenciado pelo Lovable Cloud ainda não foi injetado no ambiente de build.
    console.warn(message);
  }

  return ({
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // ─────────────────────────────────────────────────────────────
    // PWA / Service Worker (offline-first básico)
    //
    // ⚠️ devOptions.enabled = false: o SW NUNCA registra em dev /
    // preview do Lovable (rodamos dentro de iframe — SW quebraria o
    // hot-reload e cachearia builds antigos). O guard adicional em
    // src/main.tsx desativa qualquer SW remanescente quando estamos
    // em iframe / domínios *.lovableproject.com / id-preview--*.
    //
    // Estratégia de cache:
    // - precache: HTML/JS/CSS/fontes/imagens do build
    // - runtime "CacheFirst" para fontes/imagens externas
    // - Auth/REST/Storage Supabase NÃO são cacheados (dados sensíveis por tenant)
    // - navigateFallback → /index.html (SPA); a tela offline fica a
    //   cargo do OfflineBanner em runtime
    // ─────────────────────────────────────────────────────────────
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registramos manualmente em src/main.tsx
      strategies: "generateSW",
      // Reaproveita o manifest.webmanifest físico em /public ao invés de gerar outro
      manifest: false,
      includeAssets: [
        "manifest.webmanifest",
        "icon-192.png",
        "icon-512.png",
        "robots.txt",
        "placeholder.svg",
      ],
      devOptions: {
        enabled: false,
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Permite servir index.html para qualquer rota SPA (offline)
        // SPA: TODA navegação deve ser servida pelo index.html.
        // Usar /offline.html aqui fazia o SW responder a tela "Sem conexão"
        // em qualquer recarregamento/rota, mesmo com internet funcionando.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/~oauth/,
          /^\/api\//,
          /\/auth\/v1\//,
          /\/rest\/v1\//,
          /\/realtime\/v1\//,
          /\/storage\/v1\//,
        ],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        runtimeCaching: [
          // Imagens
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts (caso usados)
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Aumenta o limiar antes de o Rollup avisar — chunks de vendor pesados
    // (radix + supabase + recharts) são intencionais e já estão isolados.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "router";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack")) return "query";
          // Charts só carrega em /app/analytics
          if (id.includes("recharts") || id.includes("d3-")) return "charts";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("cmdk")) return "command";
          // Libs raramente usadas — split dedicado para não inflar o vendor
          if (id.includes("embla-carousel")) return "carousel";
          if (id.includes("input-otp")) return "otp";
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "datepicker";
          if (id.includes("react-hook-form") || id.includes("@hookform")) return "forms";
          if (id.includes("zod")) return "zod";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
  },
  });
});
