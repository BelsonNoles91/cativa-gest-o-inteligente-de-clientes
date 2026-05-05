import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';

const TARGET_ROUTES = [
  '/auth/login',
  '/auth/cadastro',
  '/portal/acesso',
  // Se precisar testar rotas logadas, precisaria injetar um token ou fazer login
];

test.describe('Contrast Analysis in Dark Mode', () => {
  let report = '# Relatório de Contraste (Modo Escuro)\n\nAnálise automatizada de contraste utilizando Playwright e axe-core.\n\n';

  for (const route of TARGET_ROUTES) {
    test(`Analysing route: ${route}`, async ({ page }) => {
      await page.goto(route);
      
      // Forçar modo escuro
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      
      // Aguardar renderização inicial
      await page.waitForLoadState('networkidle');

      // Executar análise do Axe, filtrando apenas regras de contraste
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2aa', 'wcag21aa'])
        .include('body')
        .analyze();

      const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');

      report += `## Rota: \`${route}\`\n\n`;

      if (contrastViolations.length === 0) {
        report += '✅ Nenhum problema de contraste encontrado nesta página.\n\n';
      } else {
        report += `❌ **${contrastViolations[0].nodes.length} problema(s)** de contraste encontrado(s):\n\n`;
        
        contrastViolations[0].nodes.forEach((node, index) => {
          report += `### Problema ${index + 1}\n`;
          report += `- **Elemento:** \`${node.html}\`\n`;
          report += `- **Seletor:** \`${node.target.join(', ')}\`\n`;
          report += `- **Resumo:** ${node.failureSummary}\n\n`;
        });
      }
      
      // Salvando o relatório de forma iterativa
      fs.writeFileSync('contrast_analysis.md', report, 'utf-8');
    });
  }
});
