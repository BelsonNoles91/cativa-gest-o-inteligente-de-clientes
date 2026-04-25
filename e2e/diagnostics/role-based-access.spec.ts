import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const SUPABASE_URL = env("VITE_SUPABASE_URL");
const PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");

const PROFILES: Array<{ label: string; email: string; password: string }> = [
  { label: "owner", email: env("E2E_USER"), password: env("E2E_PASS") },
  { label: "manager", email: env("E2E_MANAGER_USER"), password: env("E2E_MANAGER_PASS") },
  { label: "frontdesk", email: env("E2E_FRONTDESK_USER"), password: env("E2E_FRONTDESK_PASS") },
  { label: "professional", email: env("E2E_PROFESSIONAL_USER"), password: env("E2E_PROFESSIONAL_PASS") },
];

/** Rotas acessíveis por qualquer membro ativo (sem RoleGuard) */
const OPEN_ROUTES = [
  { path: "/app", name: "Dashboard" },
  { path: "/app/agenda", name: "Agenda" },
  { path: "/app/clientes", name: "Clientes" },
  { path: "/app/confirmacoes", name: "Confirmações" },
  { path: "/app/lista-de-espera", name: "Lista de Espera" },
];

/** Rotas restritas a owner/manager */
const MANAGER_ROUTES = [
  { path: "/app/servicos", name: "Serviços" },
  { path: "/app/pacotes", name: "Pacotes" },
  { path: "/app/analytics", name: "Analytics" },
  { path: "/app/meu-plano", name: "Meu Plano" },
  { path: "/app/assinatura", name: "Assinatura" },
  { path: "/app/dados", name: "Import/Export" },
  { path: "/app/configuracoes", name: "Configurações" },
];

/** Rotas restritas a super_admin */
const ADMIN_ROUTES = [
  { path: "/app/super-admin", name: "Super Admin" },
];

async function signIn(email: string, password: string) {
  const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Login falhou para ${email}: ${error?.message}`);
  return { session: data.session, user: data.user };
}

test.describe("Role-based access control", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const profile of PROFILES) {
    test.describe(`${profile.label}`, () => {
      
      test("acessa rotas abertas", async ({ page }) => {
        const { session, user } = await signIn(profile.email, profile.password);
        
        // Navega para /app com sessão injetada
        await page.goto("/app", { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.evaluate(({ key, sess, usr }) => {
          window.localStorage.clear();
          window.localStorage.setItem(key, JSON.stringify({
            access_token: sess.access_token,
            refresh_token: sess.refresh_token,
            expires_in: sess.expires_in,
            expires_at: sess.expires_at,
            token_type: sess.token_type,
            user: usr,
          }));
          window.location.reload();
        }, { key: `sb-${env("VITE_SUPABASE_PROJECT_ID")}-auth-token`, sess: session, usr: user });
        
        // Aguarda carregar após reload
        await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
        await page.waitForTimeout(3000);
        
        // Testa cada rota aberta
        for (const route of OPEN_ROUTES) {
          await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 15_000 });
          await page.waitForTimeout(1500);
          const url = page.url();
          expect(url, `${profile.label} deveria acessar ${route.name}`).toContain(route.path);
        }
      });

      test("acesso a rotas manager/owner", async ({ page }) => {
        const { session, user } = await signIn(profile.email, profile.password);
        
        await page.goto("/app", { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.evaluate(({ key, sess, usr }) => {
          window.localStorage.clear();
          window.localStorage.setItem(key, JSON.stringify({
            access_token: sess.access_token,
            refresh_token: sess.refresh_token,
            expires_in: sess.expires_in,
            expires_at: sess.expires_at,
            token_type: sess.token_type,
            user: usr,
          }));
          window.location.reload();
        }, { key: `sb-${env("VITE_SUPABASE_PROJECT_ID")}-auth-token`, sess: session, usr: user });
        
        await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
        await page.waitForTimeout(3000);

        const canAccess = profile.label === "owner" || profile.label === "manager";

        for (const route of MANAGER_ROUTES) {
          // Navega para a rota e aguarda possível redirect
          await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 15_000 });
          await page.waitForTimeout(2500);
          
          const url = page.url();
          
          if (canAccess) {
            // Owner/manager devem acessar (URL deve conter a rota, não /app)
            const wasRedirectedToApp = url === "http://127.0.0.1:8080/app" || url.endsWith("/app");
            expect(wasRedirectedToApp, `${profile.label} deveria acessar ${route.name} mas foi redirecionado`).toBe(false);
          } else {
            // Frontdesk/professional devem ser redirecionados para /app
            expect(url, `${profile.label} NÃO deveria acessar ${route.name}`).not.toContain(route.path);
            expect(url).toContain("/app");
          }
        }
      });

      test("acesso a rotas super_admin", async ({ page }) => {
        const { session, user } = await signIn(profile.email, profile.password);
        
        await page.goto("/app", { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.evaluate(({ key, sess, usr }) => {
          window.localStorage.clear();
          window.localStorage.setItem(key, JSON.stringify({
            access_token: sess.access_token,
            refresh_token: sess.refresh_token,
            expires_in: sess.expires_in,
            expires_at: sess.expires_at,
            token_type: sess.token_type,
            user: usr,
          }));
          window.location.reload();
        }, { key: `sb-${env("VITE_SUPABASE_PROJECT_ID")}-auth-token`, sess: session, usr: user });
        
        await page.waitForLoadState("domcontentloaded", { timeout: 20_000 });
        await page.waitForTimeout(3000);

        const canAccess = profile.label === "super_admin";

        for (const route of ADMIN_ROUTES) {
          await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 15_000 });
          await page.waitForTimeout(2500);
          
          const url = page.url();
          
          if (canAccess) {
            const wasRedirectedToApp = url === "http://127.0.0.1:8080/app" || url.endsWith("/app");
            expect(wasRedirectedToApp, `${profile.label} deveria acessar ${route.name} mas foi redirecionado`).toBe(false);
          } else {
            expect(url, `${profile.label} NÃO deveria acessar ${route.name}`).not.toContain(route.path);
            expect(url).toContain("/app");
          }
        }
      });
    });
  }
});
