import { chromium } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface RenderOptions {
  /** Footer text stamped bottom-left on every page after the cover (e.g. a classification). */
  footer?: string;
}

/**
 * Render an HTML string to a PDF Buffer via headless Chromium (Playwright), then stamp page numbers
 * (and an optional footer) on every page after the full-bleed cover. Chromium's `page.pdf()` ignores
 * `@page` margin-box counters, so page numbers are drawn here with pdf-lib instead.
 */
export async function renderPdf(html: string, opts: RenderOptions = {}): Promise<Buffer> {
  // ubuntu26.04 isn't a Playwright-recognised host; treat as ubuntu24.04 for the bundled browser.
  if (!process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = 'ubuntu24.04';
  const browser = await chromium.launch();
  let pdf: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    pdf = await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
  return stampPageNumbers(pdf, opts.footer);
}

/** Draw "page N / total" bottom-right + an optional footer bottom-left, on every page but the cover. */
async function stampPageNumbers(pdf: Buffer, footer?: string): Promise<Buffer> {
  try {
    const doc = await PDFDocument.load(pdf);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    const total = pages.length;
    const grey = rgb(0.42, 0.5, 0.55);
    const orange = rgb(0.886, 0.345, 0.047); // sev-high — matches the report's footer accent
    for (let i = 1; i < total; i++) {
      const p = pages[i]!;
      const { width } = p.getSize();
      const label = `${i + 1} / ${total}`;
      const size = 8;
      const w = font.widthOfTextAtSize(label, size);
      p.drawText(label, { x: width - 40 - w, y: 22, size, font, color: grey });
      if (footer) {
        p.drawText(footer.toUpperCase(), { x: 40, y: 22, size: 7, font, color: orange });
      }
    }
    return Buffer.from(await doc.save());
  } catch {
    // Stamping must never break report generation — fall back to the unstamped PDF.
    return pdf;
  }
}
