import { test, expect } from '@playwright/test';

/** Settings surfaces: API tokens, integrations (webhook + AI + vault), report branding, users, audit. */
test.describe.serial('settings', () => {
  test('create an API token (shown once) and copy', async ({ page }) => {
    await page.goto('/settings/tokens');
    await page.getByTestId('token-label').fill('ci-automation');
    await page.getByTestId('create-token').click();
    await expect(page.getByTestId('new-token')).toContainText('vct_');
    await expect(page.getByTestId('token-list')).toContainText('ci-automation');
    await expect(page.getByRole('button', { name: 'Copy token' })).toBeVisible();
  });

  test('add, test and remove a webhook', async ({ page }) => {
    await page.goto('/settings/integrations');
    await page.getByLabel('Channel').selectOption('generic');
    await page.getByLabel('Label').fill('QA hook');
    await page.getByLabel('Webhook URL').fill('https://example.com/hook');
    await page.getByTestId('webhook-add').click();
    await expect(page.getByText('QA hook')).toBeVisible();
    await page.getByRole('button', { name: 'Test' }).first().click();
    await page.getByRole('button', { name: 'Remove' }).first().click();
    await expect(page.getByText('QA hook')).toHaveCount(0);
  });

  test('save AI provider settings', async ({ page }) => {
    await page.goto('/settings/integrations');
    await page.getByLabel('Provider').selectOption('openai');
    await page.getByLabel('Model').fill('gpt-4o-mini');
    await page.getByTestId('ai-save').click();
    await expect(page.getByLabel('Model')).toHaveValue('gpt-4o-mini');
  });

  test('set and clear a vault API key (masked)', async ({ page }) => {
    await page.goto('/settings/integrations');
    await page.getByTestId('vault-input-otx').fill('secret-otx-key');
    await page.getByTestId('vault-save-otx').click();
    await expect(page.getByText('set', { exact: true }).first()).toBeVisible();
    await page.getByTestId('vault-clear-otx').click();
    await expect(page.getByTestId('vault-input-otx')).toBeVisible();
  });

  test('report branding + signatory', async ({ page }) => {
    await page.goto('/settings/reports');
    await page.getByLabel('Company name').first().fill('Acme Security');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await page.getByLabel('Name', { exact: true }).fill('Jane Analyst');
    await page.getByLabel('Position', { exact: true }).fill('Lead Pentester');
    await page.getByRole('button', { name: 'Add signatory' }).click();
    await expect(page.getByText('Jane Analyst')).toBeVisible();
  });

  test('create a scan profile with advanced config', async ({ page }) => {
    await page.goto('/settings/profiles');
    await page.getByLabel('Name').fill('QA Deep UA');
    // Per-tool fieldsets now expose separate httpx/nuclei User-Agent fields.
    await page.locator('#httpxUserAgent').fill('vacti-qa/1.0');
    await page.getByLabel('Exclude subdomains').fill('dev.example.com');
    await page.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByText('QA Deep UA')).toBeVisible();
    await expect(page.getByText('UA set')).toBeVisible();
  });

  test('users page lists the admin with a role selector', async ({ page }) => {
    await page.goto('/settings/users');
    // The email also appears in the topbar user-menu, so scope to the users card.
    await expect(page.getByText('admin@vacti.local').first()).toBeVisible();
    await expect(page.getByText('System Admin').first()).toBeVisible();
    await expect(page.locator('select[name="role"]').first()).toBeVisible();
  });

  test('audit log shows recorded actions', async ({ page }) => {
    await page.goto('/settings/audit');
    // Earlier specs created projects/scans → at least one audit entry exists.
    await expect(page.getByText(/project\.create|scan\.start|vault\.key_set/).first()).toBeVisible();
  });
});
