const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:8080/auth/login');
  
  await page.fill('input[type="email"]', 'profissional@cativa.test');
  await page.fill('input[type="password"]', 'Cativa@Test2026');
  await page.click('button:has-text("Entrar no Sistema")');

  await page.waitForNavigation();
  await page.waitForTimeout(2000);
  
  console.log('Current URL:', page.url());
  const h1 = await page.evaluate(() => document.querySelector('h1')?.innerText);
  console.log('H1:', h1);
  
  await browser.close();
})();
