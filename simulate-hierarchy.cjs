const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  console.log('1. Entrando como Owner A...');
  await page.goto('http://127.0.0.1:8080/auth/login');
  await page.fill('input#email', 'owner.a@cativa.test');
  await page.fill('input#password', 'Cativa@Test2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app*', { timeout: 10000 }).catch(() => console.log("Timeout owner app"));
  
  await page.screenshot({ path: '.artifacts-critical/owner_dashboard.png' });
  console.log('Screenshot Owner Dashboard salvo.');

  // Configurações (Serviços)
  await page.goto('http://127.0.0.1:8080/app/configuracoes');
  await page.waitForTimeout(2000); 
  await page.screenshot({ path: '.artifacts-critical/owner_config.png' });
  console.log('Screenshot Owner Serviços salvo.');

  // Logout (limpa cookies)
  await context.clearCookies();

  console.log('2. Entrando como Recepção...');
  await page.goto('http://127.0.0.1:8080/auth/login');
  await page.fill('input#email', 'recepcao@cativa.test');
  await page.fill('input#password', 'Cativa@Test2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app*', { timeout: 10000 }).catch(() => console.log("Timeout recepcao app"));

  // Clientes
  await page.goto('http://127.0.0.1:8080/app/clientes');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.artifacts-critical/recepcao_clientes.png' });
  console.log('Screenshot Recepção Clientes salvo.');

  // Agenda
  await page.goto('http://127.0.0.1:8080/app/agenda');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.artifacts-critical/recepcao_agenda.png' });
  console.log('Screenshot Recepção Agenda salvo.');

  // Logout
  await context.clearCookies();

  console.log('3. Entrando como Profissional...');
  await page.goto('http://127.0.0.1:8080/auth/login');
  await page.fill('input#email', 'profissional@cativa.test');
  await page.fill('input#password', 'Cativa@Test2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app*', { timeout: 10000 }).catch(() => console.log("Timeout prof app"));

  // Agenda
  await page.goto('http://127.0.0.1:8080/app/agenda');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.artifacts-critical/profissional_agenda.png' });
  console.log('Screenshot Profissional Agenda salvo.');
  
  // Tenta acessar configurações (Bloqueado)
  await page.goto('http://127.0.0.1:8080/app/configuracoes');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.artifacts-critical/profissional_bloqueio.png' });
  console.log('Screenshot Profissional Bloqueio salvo.');

  await browser.close();
  console.log('Pronto!');
})();
