import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('tenant_memberships')) {
      try {
        const json = await res.json();
        console.log('tenant_memberships RESPONSE:', JSON.stringify(json));
      } catch (e) {
        console.log('tenant_memberships Error:', e.message);
      }
    }
  });

  await page.goto('http://127.0.0.1:8080/auth/login');
  
  await page.fill('input[type="email"]', 'profissional@cativa.test');
  await page.fill('input[type="password"]', 'Cativa@Test2026');
  await page.click('button:has-text("Entrar no Sistema")');

  try {
    await page.waitForURL('**/app**', { timeout: 4000 });
  } catch (e) {
    try {
      await page.waitForURL('**/onboarding**', { timeout: 4000 });
    } catch(e2) {}
  }
  
  await page.waitForTimeout(2000);
  console.log('Current URL:', page.url());
  
  await browser.close();
})();
