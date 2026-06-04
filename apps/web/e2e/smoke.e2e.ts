import { test, expect } from '@playwright/test';

test('foundation smoke: create admin → project → API token → logout', async ({ page }) => {
  // First run → create the admin.
  await page.goto('/login');
  await page.getByTestId('email').fill('admin@vacti.local');
  await page.getByTestId('password').fill('supersecret');
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('welcome')).toContainText('admin@vacti.local');

  // Create a project.
  await page.goto('/projects');
  await page.getByTestId('project-name').fill('Acme Corp');
  await page.getByTestId('project-slug').fill('acme');
  await page.getByTestId('create-project').click();
  await expect(page.getByTestId('project-list')).toContainText('acme');

  // Create an API token (shown once).
  await page.goto('/settings/tokens');
  await page.getByTestId('token-label').fill('ci-automation');
  await page.getByTestId('create-token').click();
  await expect(page.getByTestId('new-token')).toContainText('vct_');
  await expect(page.getByTestId('token-list')).toContainText('ci-automation');

  // Add a target (localhost — authorized; predefined sub skips subfinder).
  await page.goto('/targets');
  await page.getByTestId('target-domain').fill('127.0.0.1');
  await page.getByTestId('target-subs').fill('127.0.0.1:8099');
  await page.getByTestId('create-target').click();
  await expect(page.getByTestId('target-list')).toContainText('127.0.0.1');

  // Start a scan from the UI → lands on the scan detail page with a status.
  await page.goto('/scans');
  await page.getByTestId('start-scan').click();
  await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}/);
  await expect(page.getByTestId('scan-status')).toBeVisible();

  // Logout.
  await page.goto('/dashboard');
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);
});
