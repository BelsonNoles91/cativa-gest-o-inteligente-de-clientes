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
  await page.waitForURL('**/app*');
  
  // Tira print do dashboard do Owner
  await page.screenshot({ path: '.artifacts-critical/owner_dashboard.png' });
  console.log('Screenshot Owner Dashboard salvo.');

  // Configurações
  await page.goto('http://127.0.0.1:8080/app/configuracoes/servicos');
  await page.waitForTimeout(2000); // espera carregar
  await page.screenshot({ path: '.artifacts-critical/owner_servicos.png' });
  console.log('Screenshot Owner Serviços salvo.');

  // Logout
  await page.goto('http://127.0.0.1:8080/auth/login'); // ou click no botão de logout

  console.log('2. Entrando como Recepção...');
  await page.fill('input#email', 'recepcao@cativa.test');
  await page.fill('input#password', 'Cativa@Test2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app*');

  // Vai em Clientes
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
  await page.goto('http://127.0.0.1:8080/auth/login');

  console.log('3. Entrando como Profissional...');
  await page.fill('input#email', 'profissional@cativa.test');
  await page.fill('input#password', 'Cativa@Test2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app*');

  // Agenda do profissional
  await page.goto('http://127.0.0.1:8080/app/agenda');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.artifacts-critical/profissional_agenda.png' });
  console.log('Screenshot Profissional Agenda salvo.');
  
  // Tenta acessar configurações (deve ser bloqueado/escondido)
  await page.goto('http://127.0.0.1:8080/app/configuracoes');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '.artifacts-critical/profissional_bloqueio.png' });
  console.log('Screenshot Profissional Bloqueio salvo.');

  await browser.close();
  console.log('Pronto!');
})();
