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
  // Em `vite dev` também validamos, mas com aviso — não bloqueia HMR.
  // ─────────────────────────────────────────────────────────────
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!supabaseKey)
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

    if (command === "build") {
      // Bloqueia o build de produção com mensagem clara.
      throw new Error(message);
    } else {
      // Em dev, só avisa — permite trabalhar em telas públicas.
      console.warn(message);
    }
  }

  return ({
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
    // - navigateFallback → /offline.html quando uma rota nova é
    //   solicitada sem rede e sem cache
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
        navigateFallback: "/offline.html",
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
      "@": path.resolve(__dirname, "./src"),
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
}));
