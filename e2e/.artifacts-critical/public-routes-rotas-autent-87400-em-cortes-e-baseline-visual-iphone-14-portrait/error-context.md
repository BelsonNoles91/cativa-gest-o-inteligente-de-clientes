# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-routes.spec.ts >> rotas autenticadas >> /app — sem cortes e baseline visual
- Location: e2e\visual\public-routes.spec.ts:46:5

# Error details

```
TimeoutError: locator.waitFor: Timeout 45000ms exceeded.
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
  1  | /**
  2  |  * Visual regression — rotas públicas (sem auth).
  3  |  *
  4  |  * Cobre:
  5  |  *  - /auth/login (uma das 5 rotas-baseline)
  6  |  *
  7  |  * As asserções de overflow horizontal e BottomNav rodam em todos os perfis
  8  |  * de dispositivo; o screenshot é o "selo" final.
  9  |  */
  10 | import { test, expect } from "@playwright/test";
  11 | import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
  12 | import {
  13 |   prepareForSnapshot,
  14 |   assertNoHorizontalOverflow,
  15 |   assertBottomNavVisible,
  16 |   assertMainHasBottomPadding,
  17 |   assertContentNotHiddenByBottomNav,
  18 |   assertBottomNavItemsRespectSafeArea,
  19 |   assertCriticalActionsAboveBottomNav,
  20 | } from "../_helpers/visual";
  21 | 
  22 | const AUTH_VISUAL_TIMEOUT = 60_000;
  23 | 
  24 | test.describe("rotas públicas", () => {
  25 |   test.use({ storageState: { cookies: [], origins: [] } });
  26 | 
  27 |   test("/auth/login — sem overflow e baseline visual", async ({ page }) => {
  28 |     await page.goto("/auth/login");
  29 |     await prepareForSnapshot(page);
  30 |     await assertNoHorizontalOverflow(page);
  31 |     // BottomNav não existe em login — o helper retorna sem assert se desktop;
  32 |     // em mobile o login não tem BottomNav, então pulamos a asserção aqui.
  33 |     await expect(page).toHaveScreenshot("login.png", { fullPage: true });
  34 |   });
  35 | });
  36 | 
  37 | test.describe("rotas autenticadas", () => {
  38 |   test.describe.configure({ timeout: AUTH_VISUAL_TIMEOUT });
  39 |   test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);
  40 |   for (const { path, name } of [
  41 |     { path: "/app", name: "dashboard" },
  42 |     { path: "/app/agenda", name: "agenda" },
  43 |     { path: "/app/clientes", name: "clientes" },
  44 |     { path: "/app/confirmacoes", name: "confirmacoes" },
  45 |   ]) {
  46 |     test(`${path} — sem cortes e baseline visual`, async ({ page }) => {
  47 |       await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
  48 |       await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  49 |       // Aguarda saída do skeleton/loader principal antes do snapshot.
  50 |       await page
  51 |         .locator('main[data-app-main], [data-app-main]')
  52 |         .first()
> 53 |         .waitFor({ state: "visible", timeout: 45_000 });
     |          ^ TimeoutError: locator.waitFor: Timeout 45000ms exceeded.
  54 |       await prepareForSnapshot(page);
  55 | 
  56 |       // Asserções estruturais antes do diff de pixels.
  57 |       await assertNoHorizontalOverflow(page);
  58 |       await assertBottomNavVisible(page);
  59 |       // Garante que o main reserva padding-bottom >= altura do BottomNav...
  60 |       await assertMainHasBottomPadding(page);
  61 |       // ...e que, ao rolar até o fim, nada de fato fica oculto atrás da nav.
  62 |       await assertContentNotHiddenByBottomNav(page);
  63 |       // Itens do nav respeitam safe-area (notch landscape, home indicator).
  64 |       await assertBottomNavItemsRespectSafeArea(page);
  65 |       // Ações críticas marcadas com data-critical-action ficam acima do nav.
  66 |       await assertCriticalActionsAboveBottomNav(page);
  67 | 
  68 |       await expect(page).toHaveScreenshot(`${name}.png`, {
  69 |         fullPage: true,
  70 |         // Mascara áreas voláteis: relógio do header, saudações com hora, KPIs
  71 |         // que mudam por minuto (criados nos últimos 5 min etc).
  72 |         mask: [
  73 |           page.locator("[data-volatile]"),
  74 |           page.locator("time"),
  75 |         ],
  76 |       });
  77 |     });
  78 |   }
  79 | });
  80 | 
```