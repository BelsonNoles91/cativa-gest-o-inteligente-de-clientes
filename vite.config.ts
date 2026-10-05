import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  // ─────────────────────────────────────────────────────────────
  // Guard de variáveis obrigatórias no build de produção.
  // Sem um alvo explícito, o fallback poderia publicar o bundle apontando
  // silenciosamente para outro projeto Supabase.
  // Em dev / build:dev apenas avisa; o fallback é loopback, nunca um projeto remoto.
  // ─────────────────────────────────────────────────────────────
  // Valores fornecidos pelo ambiente de execução/CI devem prevalecer sobre
  // arquivos .env, como no comportamento padrão do Vite.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const configuredSupabaseUrl = env.VITE_SUPABASE_URL;
  const configuredSupabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

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
      "Sem elas, desenvolvimento usa somente o Supabase local padrão em",
      "http://127.0.0.1:54321, com uma chave placeholder sem privilégios.",
      "Builds de produção são interrompidos até o alvo correto ser explícito.",
      "",
      "Como resolver:",
      "  1. Verifique se o arquivo `.env` existe na raiz do projeto.",
      "  2. Confirme que a conexão do Lovable Cloud / Supabase está",
      "     ativa (ela é quem popula essas variáveis).",
      "  3. Em hospedagens externas (Vercel/Netlify), configure as",
      "     variáveis no painel do provedor antes do build.",
      "",
    ].join("\n");

    if (command === "build" && mode === "production") {
      throw new Error(
        `${message}\nBuild de produção abortado por segurança: configure o URL e a chave pública do projeto Supabase correto antes de publicar.`,
      );
    }

    console.warn(message);
  }

  return ({
  // Fallback local-only para desenvolvimento/build não produtivo.
  // Builds de produção sem configuração explícita já foram abortados acima.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
      configuredSupabaseUrl ?? "http://127.0.0.1:54321",
    ),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
      configuredSupabaseKey ?? "local-development-key-not-configured",
    ),
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
        // Handlers de notificação push (push / notificationclick)
        importScripts: ["/push-sw.js"],

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
