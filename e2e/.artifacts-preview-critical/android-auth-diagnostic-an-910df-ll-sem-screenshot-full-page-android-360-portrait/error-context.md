# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: android-auth-diagnostic.spec.ts >> android auth diagnostic >> /app diagnostica shell sem screenshot full-page
- Location: e2e\visual\android-auth-diagnostic.spec.ts:8:5

# Error details

```
Error: {
  "path": "/app",
  "url": "http://127.0.0.1:4173/app",
  "appMainCount": 0,
  "loginCount": 0,
  "onboardingHints": 0,
  "bodySnippet": ""
}

expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
-   "appMainCount": 1,
+   "appMainCount": 0,
    "loginCount": 0,
  }
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications (F8)":
    - list
  - region "Notifications alt+T"
  - img [ref=e4]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
  3  | 
  4  | test.describe("android auth diagnostic", () => {
  5  |   test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);
  6  | 
  7  |   for (const path of ["/app", "/app/clientes", "/app/confirmacoes"]) {
  8  |     test(`${path} diagnostica shell sem screenshot full-page`, async ({ page }) => {
  9  |       await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
  10 |       await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
  11 |       await page.waitForTimeout(4_000);
  12 | 
  13 |       const snapshot = {
  14 |         path,
  15 |         url: page.url(),
  16 |         appMainCount: await page.locator("[data-app-main]").count(),
  17 |         loginCount: await page.getByRole("textbox", { name: /^e-mail$/i }).count().catch(() => 0),
  18 |         onboardingHints: await page.getByText(/nome e segmento|criar conta gratuita|tudo pronto!/i).count().catch(() => 0),
  19 |         bodySnippet: (await page.locator("body").innerText().catch(() => "")).slice(0, 300),
  20 |       };
  21 | 
> 22 |       expect(snapshot, JSON.stringify(snapshot, null, 2)).toMatchObject({
     |                                                           ^ Error: {
  23 |         appMainCount: 1,
  24 |         loginCount: 0,
  25 |       });
  26 |     });
  27 |   }
  28 | });
  29 | 
```