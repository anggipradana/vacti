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

  // Logout.
  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);
});
