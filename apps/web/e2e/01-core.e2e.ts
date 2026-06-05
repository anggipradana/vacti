import { test, expect } from '@playwright/test';

/**
 * Core journey: project → target (predefined sub) → scan → live detail → cancel → report link →
 * dashboard onboarding clears. Auth comes from the shared admin storage state (auth.setup.ts).
 */
test.describe.serial('core journey', () => {
  test('dashboard shows onboarding when empty', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Get started' })).toBeVisible();
  });

  test('create a project', async ({ page }) => {
    await page.goto('/projects');
    await page.getByTestId('project-name').fill('Acme Corp');
    await page.getByTestId('project-slug').fill('acme');
    await page.getByTestId('create-project').click();
    await expect(page.getByTestId('project-list')).toContainText('acme');
  });

  test('create a target with predefined sub + custom header, then notes', async ({ page }) => {
    await page.goto('/targets');
    await page.getByTestId('target-domain').fill('127.0.0.1');
    await page.getByTestId('target-subs').fill('127.0.0.1:8099');
    await page.getByLabel('Custom request headers').fill('X-QA: vacti');
    await page.getByTestId('create-target').click();
    await expect(page.getByTestId('target-list')).toContainText('127.0.0.1');
    // List shows the custom-headers badge.
    await expect(page.getByTestId('target-list').getByText('custom headers')).toBeVisible();
    // Target detail shows the masked custom header key + recon notes.
    await page.getByTestId('target-list').getByRole('link', { name: '127.0.0.1' }).first().click();
    await expect(page).toHaveURL(/\/targets\/[0-9a-f-]{36}/);
    await expect(page.getByText('X-QA', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Recon notes/ })).toBeVisible();
    await page.getByPlaceholder('Add a note or TODO…').fill('check the VPN host');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('check the VPN host')).toBeVisible();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByText('done', { exact: true })).toBeVisible();
  });

  test('start a scan and reach the detail page', async ({ page }) => {
    await page.goto('/scans');
    await page.getByTestId('new-scan-trigger').click();
    await page.getByTestId('start-scan').click();
    await expect(page).toHaveURL(/\/scans\/[0-9a-f-]{36}/);
    await expect(page.getByTestId('scan-status')).toBeVisible();
    // A running/queued scan shows a Cancel button; cancel for determinism.
    const cancel = page.getByRole('button', { name: 'Cancel scan' });
    if (await cancel.isVisible().catch(() => false)) await cancel.click();
  });

  test('scans list renders', async ({ page }) => {
    await page.goto('/scans');
    await expect(page.getByTestId('scan-list')).toBeVisible();
  });
});
