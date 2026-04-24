# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-routes.spec.ts >> rotas autenticadas >> /app/clientes — sem cortes e baseline visual
- Location: e2e\visual\public-routes.spec.ts:76:5

# Error details

```
TimeoutError: locator.waitFor: Timeout 20000ms exceeded.
Call log:
  - waiting for locator('main[data-app-main], [data-app-main]').first() to be visible

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - main [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e8]: C
      - generic [ref=e10]: Cativa
    - generic [ref=e13]:
      - generic [ref=e14]:
        - generic [ref=e15]: Acesso à plataforma
        - heading "Bem-vindo de volta" [level=1] [ref=e17]
        - paragraph [ref=e18]: Entre com sua conta Cativa para gerenciar agenda, clientes e confirmações.
      - generic [ref=e19]:
        - generic [ref=e20]:
          - text: E-mail
          - generic [ref=e21]:
            - img
            - textbox "E-mail" [active] [ref=e22]:
              - /placeholder: voce@negocio.com
        - generic [ref=e23]:
          - text: Senha
          - generic [ref=e24]:
            - img
            - textbox "Senha" [ref=e25]:
              - /placeholder: ••••••••
            - button "Mostrar senha" [ref=e26] [cursor=pointer]:
              - img [ref=e27]
        - button "Entrar" [ref=e30] [cursor=pointer]:
          - generic [ref=e31]:
            - text: Entrar
            - img
        - link "Esqueci minha senha" [ref=e33]:
          - /url: /auth/recuperar
      - generic [ref=e34]:
        - generic [ref=e39]: Novo por aqui
        - link "Criar conta gratuita" [ref=e40]:
          - /url: /onboarding
        - paragraph [ref=e41]:
          - text: Ao continuar você concorda com os
          - link "Termos" [ref=e42]:
            - /url: /termos
          - text: e a
          - link "Política de Privacidade" [ref=e43]:
            - /url: /privacidade
          - text: .
```

# Test source

```ts
  1   | /**
  2   |  * Visual regression — rotas públicas (sem auth).
  3   |  *
  4   |  * Cobre:
  5   |  *  - /auth/login (uma das 5 rotas-baseline)
  6   |  *
  7   |  * As asserções de overflow horizontal e BottomNav rodam em todos os perfis
  8   |  * de dispositivo; o screenshot é o "selo" final.
  9   |  */
  10  | import { test, expect } from "@playwright/test";
  11  | import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
  12  | import {
  13  |   prepareForSnapshot,
  14  |   assertNoHorizontalOverflow,
  15  |   assertBottomNavVisible,
  16  |   assertMainHasBottomPadding,
  17  |   assertContentNotHiddenByBottomNav,
  18  |   assertBottomNavItemsRespectSafeArea,
  19  |   assertCriticalActionsAboveBottomNav,
  20  | } from "../_helpers/visual";
  21  | 
  22  | const AUTH_VISUAL_TIMEOUT = 60_000;
  23  | 
  24  | async function waitForAuthenticatedShell(page: import("@playwright/test").Page) {
  25  |   await page
  26  |     .locator('main[data-app-main], [data-app-main]')
  27  |     .first()
> 28  |     .waitFor({ state: "visible", timeout: 20_000 });
      |      ^ TimeoutError: locator.waitFor: Timeout 20000ms exceeded.
  29  | }
  30  | 
  31  | async function openAuthenticatedVisualRoute(
  32  |   page: import("@playwright/test").Page,
  33  |   path: string,
  34  | ) {
  35  |   await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
  36  |   await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  37  | 
  38  |   try {
  39  |     await waitForAuthenticatedShell(page);
  40  |     return;
  41  |   } catch {
  42  |     await page.goto("/app", { waitUntil: "commit", timeout: 15_000 });
  43  |     await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  44  |     await waitForAuthenticatedShell(page);
  45  | 
  46  |     if (path !== "/app") {
  47  |       await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
  48  |       await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  49  |       await waitForAuthenticatedShell(page);
  50  |     }
  51  |   }
  52  | }
  53  | 
  54  | test.describe("rotas públicas", () => {
  55  |   test.use({ storageState: { cookies: [], origins: [] } });
  56  | 
  57  |   test("/auth/login — sem overflow e baseline visual", async ({ page }) => {
  58  |     await page.goto("/auth/login");
  59  |     await prepareForSnapshot(page);
  60  |     await assertNoHorizontalOverflow(page);
  61  |     // BottomNav não existe em login — o helper retorna sem assert se desktop;
  62  |     // em mobile o login não tem BottomNav, então pulamos a asserção aqui.
  63  |     await expect(page).toHaveScreenshot("login.png", { fullPage: true });
  64  |   });
  65  | });
  66  | 
  67  | test.describe("rotas autenticadas", () => {
  68  |   test.describe.configure({ timeout: AUTH_VISUAL_TIMEOUT });
  69  |   test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);
  70  |   for (const { path, name } of [
  71  |     { path: "/app", name: "dashboard" },
  72  |     { path: "/app/agenda", name: "agenda" },
  73  |     { path: "/app/clientes", name: "clientes" },
  74  |     { path: "/app/confirmacoes", name: "confirmacoes" },
  75  |   ]) {
  76  |     test(`${path} — sem cortes e baseline visual`, async ({ page }) => {
  77  |       await openAuthenticatedVisualRoute(page, path);
  78  |       await prepareForSnapshot(page);
  79  | 
  80  |       // Asserções estruturais antes do diff de pixels.
  81  |       await assertNoHorizontalOverflow(page);
  82  |       await assertBottomNavVisible(page);
  83  |       // Garante que o main reserva padding-bottom >= altura do BottomNav...
  84  |       await assertMainHasBottomPadding(page);
  85  |       // ...e que, ao rolar até o fim, nada de fato fica oculto atrás da nav.
  86  |       await assertContentNotHiddenByBottomNav(page);
  87  |       // Itens do nav respeitam safe-area (notch landscape, home indicator).
  88  |       await assertBottomNavItemsRespectSafeArea(page);
  89  |       // Ações críticas marcadas com data-critical-action ficam acima do nav.
  90  |       await assertCriticalActionsAboveBottomNav(page);
  91  | 
  92  |       await expect(page).toHaveScreenshot(`${name}.png`, {
  93  |         fullPage: true,
  94  |         // Mascara áreas voláteis: relógio do header, saudações com hora, KPIs
  95  |         // que mudam por minuto (criados nos últimos 5 min etc).
  96  |         mask: [
  97  |           page.locator("[data-volatile]"),
  98  |           page.locator("time"),
  99  |         ],
  100 |       });
  101 |     });
  102 |   }
  103 | });
  104 | 
```