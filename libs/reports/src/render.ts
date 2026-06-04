import { chromium } from '@playwright/test';

/** Render an HTML string to a PDF Buffer via headless Chromium (Playwright). */
export async function renderPdf(html: string): Promise<Buffer> {
  // ubuntu26.04 isn't a Playwright-recognised host; treat as ubuntu24.04 for the bundled browser.
  if (!process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = 'ubuntu24.04';
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}
