import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('login e dashboard são responsivos e sem violações críticas', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /acesse sua conta/i })).toBeVisible();
  let accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === 'critical')).toEqual(
    [],
  );

  await page.getByLabel(/e-mail/i).fill('admin@barbeariamodelo.com');
  await page.getByLabel(/senha/i).fill('Admin@123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/visão geral/i).first()).toBeVisible();
  accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === 'critical')).toEqual(
    [],
  );
});
