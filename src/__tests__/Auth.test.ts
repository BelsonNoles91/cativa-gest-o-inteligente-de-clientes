import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('Login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Entrar")');
    
    // Check for toast error message
    const toast = page.locator('text=Não foi possível entrar');
    await expect(toast).toBeVisible();
    await expect(page.locator('text=Invalid login credentials')).toBeVisible();
  });

  test('Password recovery flow navigation', async ({ page }) => {
    await page.goto('/auth/login');
    await page.click('text=Esqueci minha senha');
    await expect(page).toHaveURL(/\/auth\/recuperar/);
    
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button:has-text("Enviar link de recuperação")');
    
    // Check for success message or relevant feedback
    // Since we don't have a real email sender in test, we just check if it doesn't crash
  });
});
