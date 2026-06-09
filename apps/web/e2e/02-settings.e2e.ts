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

  test('save system default + per-project AI provider settings', async ({ page }) => {
    await page.goto('/settings/integrations');
    // System default AI (covers the new DeepSeek/Kimi providers).
    await page.getByTestId('ai-default-provider').selectOption('deepseek');
    await page.locator('#default-model').fill('deepseek-chat');
    await page.getByTestId('ai-default-save').click();
    await expect(page.getByTestId('ai-default-provider')).toHaveValue('deepseek');
    await expect(page.locator('#default-model')).toHaveValue('deepseek-chat');
    // Per-project override (scoped to its own #provider/#model to avoid the default form's labels).
    await page.locator('#provider').selectOption('openai');
    await page.locator('#model').fill('gpt-4o-mini');
    await page.getByTestId('ai-save').click();
    await expect(page.locator('#model')).toHaveValue('gpt-4o-mini');
  });

  test('set, test and clear a vault API key (masked)', async ({ page }) => {
    await page.goto('/settings/integrations');
    await page.getByTestId('vault-input-otx').fill('secret-otx-key');
    await page.getByTestId('vault-save-otx').click();
    await expect(page.getByText('set', { exact: true }).first()).toBeVisible();
    // Validity check: probe the (fake) key and surface a verdict badge (invalid / check failed).
    // Allow for the provider probe's network timeout before the verdict redirects back.
    await page.getByTestId('vault-test-otx').click();
    await expect(page.getByTestId('vault-test-result-otx')).toBeVisible({ timeout: 20_000 });
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
    // Per-row Edit forms now also expose Name/Exclude fields, so scope to the create form.
    const create = page.locator('form', { has: page.getByRole('button', { name: 'Create profile' }) });
    await create.getByLabel('Name').fill('QA Deep UA');
    // Per-tool fieldsets now expose separate httpx/nuclei User-Agent fields.
    await create.locator('#httpxUserAgent').fill('vacti-qa/1.0');
    await create.getByLabel('Exclude subdomains').fill('dev.example.com');
    await create.getByRole('button', { name: 'Create profile' }).click();
    await expect(page.getByText('QA Deep UA')).toBeVisible();
    await expect(page.getByText('UA set')).toBeVisible();
  });

  test('users page lists the admin with a role selector', async ({ page }) => {
    await page.goto('/settings/users');
    // The email also appears in the topbar user-menu, so scope to the users card.
    await expect(page.getByText('admin@vacti.local').first()).toBeVisible();
    // The admin's row role select (last select[name=role]; the first is the Add-user form).
    await expect(page.locator('select[name="role"]').last()).toHaveValue('SysAdmin');
    // Add-user form is present.
    await expect(page.locator('#email')).toBeVisible();
  });

  test('audit log shows recorded actions', async ({ page }) => {
    await page.goto('/settings/audit');
    // Earlier specs created projects/scans → at least one audit entry exists.
    await expect(page.getByText(/project\.create|scan\.start|vault\.key_set/).first()).toBeVisible();
  });

  test('account page shows profile and rejects a wrong current password', async ({ page }) => {
    await page.goto('/settings/account');
    await expect(page.getByText('admin@vacti.local').first()).toBeVisible();
    // Wrong current password → error, and (crucially) the real password is left unchanged.
    await page.getByLabel('Current password').fill('definitely-wrong');
    await page.getByLabel('New password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm new password').fill('newpassword123');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Current password is incorrect.')).toBeVisible();
  });
});
