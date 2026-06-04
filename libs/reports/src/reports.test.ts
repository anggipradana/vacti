import { describe, it, expect } from 'vitest';
import { renderVaReport } from './va-report';
import { renderTiReport } from './ti-report';
import { DEFAULT_VA_SETTINGS, DEFAULT_TI_SETTINGS } from './types';

describe('VA report html', () => {
  const html = renderVaReport({
    lang: 'en',
    type: 'full',
    settings: DEFAULT_VA_SETTINGS,
    signatories: [{ role: 'prepared', name: 'A', position: 'Analyst' }],
    target: { domain: 'example.com' },
    scan: { status: 'completed', startedAt: new Date(), finishedAt: new Date() },
    counts: { subdomains: 2, endpoints: 5, ports: 3 },
    severityCounts: [1, 2, 0, 1, 4],
    endpoints: [{ url: 'http://example.com', statusCode: 200, title: 'Home' }],
    vulns: [{ name: 'XSS', severity: 3, status: 'open', matchedAt: 'http://example.com/?q=' }],
  });
  it('contains cover, approval, summary, vulnerabilities', () => {
    expect(html).toContain('Vulnerability Assessment Report');
    expect(html).toContain('example.com');
    expect(html).toContain('Approval Sheet');
    expect(html).toContain('Summary of Findings');
    expect(html).toContain('XSS');
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
  it('honors Indonesian + report type', () => {
    const recon = renderVaReport({
      ...{
        lang: 'id' as const,
        type: 'recon' as const,
        settings: DEFAULT_VA_SETTINGS,
        signatories: [],
        target: { domain: 'x.id' },
        scan: { status: 'completed' },
        counts: { subdomains: 0, endpoints: 0, ports: 0 },
        severityCounts: [0, 0, 0, 0, 0] as [number, number, number, number, number],
        endpoints: [],
        vulns: [],
      },
    });
    expect(recon).toContain('Laporan Vulnerability Assessment');
    expect(recon).not.toContain('<h2>Vulnerabilities</h2>');
  });
});

describe('TI report html', () => {
  const html = renderTiReport({
    lang: 'en',
    settings: DEFAULT_TI_SETTINGS,
    signatories: [],
    project: { name: 'Acme' },
    risk: { score: 72, color: 'red' },
    totals: { pulses: 3, malware: 1, leaks: 5 },
    otx: [{ indicator: 'acme.com', pulses: 3, malwareCount: 1, reputation: 40 }],
    leaks: [{ identifier: 'a@acme.com', source: 'BreachX', status: 'new' }],
    indicators: [{ type: 'domain', value: 'evil.com' }],
  });
  it('contains risk, IoC, breach sections', () => {
    expect(html).toContain('Threat Intelligence Report');
    expect(html).toContain('72 / 100');
    expect(html).toContain('Indicators of Compromise');
    expect(html).toContain('a@acme.com');
    expect(html).toContain('CONFIDENTIAL');
  });
});
