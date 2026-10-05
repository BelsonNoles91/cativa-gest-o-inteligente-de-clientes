import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const testSupabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://cativa-test.supabase.co";
const testSupabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "cativa-test-anon-key";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(testSupabaseUrl),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(testSupabaseKey),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(testSupabaseKey),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["src/tests/e2e/**", "src/__tests__/Auth.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "json", "html"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
      include: [
        "src/**/*.{ts,tsx}",
        "supabase/functions/_shared/jev.ts",
        "supabase/functions/retention-advisor/logic.ts",
      ],
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
      thresholds: {
        "src/domain/analytics.ts": { statements: 95, branches: 90, functions: 95, lines: 95 },
        "src/domain/billing.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/domain/confirmation.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "src/domain/scheduling.ts": { statements: 95, branches: 90, functions: 95, lines: 95 },
        "src/lib/client-validation.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "supabase/functions/_shared/jev.ts": { statements: 90, branches: 90, functions: 70, lines: 90 },
        "supabase/functions/retention-advisor/logic.ts": { statements: 90, branches: 85, functions: 95, lines: 90 },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
