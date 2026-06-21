import { describe, it, expect } from 'vitest';
import { renderVaReport } from './va-report';
import { renderTiReport } from './ti-report';
import { renderPentestReport, type PentestReportFinding } from './pentest-report';
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
    endpoints: [{ url: 'http://example.com', statusCode: 200, title: 'Home', tech: ['nginx'] }],
    ports: [{ ip: '1.1.1.1', port: 443 }],
    subdomains: ['a.example.com'],
    vulns: [
      {
        name: 'XSS',
        severity: 3,
        status: 'open',
        matchedAt: 'http://example.com/?q=',
        isAiEnriched: true,
        aiRemediation: 'Encode output.',
      },
    ],
  });
  it('contains cover, approval, executive summary, vulnerabilities + AI detail', () => {
    expect(html).toContain('Vulnerability Assessment Report');
    expect(html).toContain('example.com');
    expect(html).toContain('Approval Sheet');
    expect(html).toContain('Table of Contents'); // bilingual TOC
    expect(html).toContain('Executive Summary');
    expect(html).toContain('Vulnerability Summary'); // aggregated summary table
    expect(html).toContain('Affected URLs'); // url chips per finding
    expect(html).toContain('XSS');
    expect(html).toContain('Encode output.'); // AI remediation rendered
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
  it('honors Indonesian + report type', () => {
    const recon = renderVaReport({
      lang: 'id',
      type: 'recon',
      settings: DEFAULT_VA_SETTINGS,
      signatories: [],
      target: { domain: 'x.id' },
      scan: { status: 'completed' },
      counts: { subdomains: 0, endpoints: 0, ports: 0 },
      endpoints: [],
      ports: [],
      subdomains: [],
      vulns: [],
    });
    expect(recon).toContain('Laporan Vulnerability Assessment');
    expect(recon).toContain('Daftar Isi'); // bilingual TOC present
    expect(recon).toContain('Inventaris Subdomain'); // subdomain inventory section present for recon type
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
    expect(html).toContain('Cyber Threat Intelligence Report');
    expect(html).toContain('72 / 100');
    expect(html).toContain('Indicators of Compromise');
    expect(html).toContain('a@acme.com');
    expect(html).toContain('CONFIDENTIAL');
  });
});

describe('Pentest report html', () => {
  const finding: PentestReportFinding = {
    title: 'Horizontal IDOR on /api/orders',
    severity: 'high',
    cvssVector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N',
    skill: 'idor-testing',
    description: { en: 'Cross-user order access.', id: 'Akses order lintas pengguna.' },
    businessImpact: { en: 'PII exposure.', id: 'Paparan PII.' },
    reproSteps: { en: 'Replay as peer.', id: 'Replay sebagai peer.' },
    remediation: { en: 'Enforce object-level authz.', id: 'Terapkan otorisasi objek.' },
    affected: { url: 'https://app.test/api/orders', parameter: 'id', method: 'GET' },
    evidence: [
      {
        kind: 'request_response',
        sha256: 'a'.repeat(64),
        frameRole: 'attacker',
        account: 'bob',
        capturedAt: '2026-06-16T00:00:00.000Z',
        text: 'GET /api/orders?id=2 HTTP/1.1',
      },
    ],
  };
  const data = {
    lang: 'en' as const,
    type: 'full' as const,
    settings: DEFAULT_VA_SETTINGS,
    signatories: [{ role: 'prepared' as const, name: 'A', position: 'Pentester' }],
    engagement: {
      name: 'Acme web',
      kind: 'web',
      scopeIn: ['10.0.0.0/24'],
      scopeOut: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    },
    findings: [finding],
    generatedAt: '2026-06-16T00:00:00.000Z',
  };

  it('renders a single-language (EN) report: cover, sections, CVSS 4.0 vector, finding layout', () => {
    const html = renderPentestReport(data);
    expect(html).toContain('Penetration Test Report');
    expect(html).toContain('CVSS:4.0/AV:N'); // CVSS vector string rendered
    expect(html).toContain('Horizontal IDOR on /api/orders'); // finding title
    expect(html).toContain('Cross-user order access.'); // EN description
    expect(html).not.toContain('Akses order lintas pengguna.'); // ID text must NOT leak into the EN report
    expect(html).not.toContain('Ringkasan Eksekutif'); // labels are EN-only now
    expect(html).toContain('Confidentiality Notice');
    expect(html).toContain('Document Control');
    expect(html).toContain('Table of Contents');
    expect(html).toContain('Severity Rating');
    expect(html).toContain('Technical Glossary');
    expect(html).toContain('Assessment Results');
    expect(html).toContain('Consolidated Recommendations');
    expect(html).toMatch(/[A-Z]+-01/); // a finding ID like VAC-01
    expect(html).not.toMatch(/[—–]/); // no em/en dashes (house style)
  });

  it('renders the Indonesian report with ID-only content', () => {
    const html = renderPentestReport({ ...data, lang: 'id' });
    expect(html).toContain('Akses order lintas pengguna.'); // ID description
    expect(html).not.toContain('Cross-user order access.'); // EN text must NOT leak into the ID report
    expect(html).toContain('Ringkasan Eksekutif'); // ID labels
  });

  it('summary type omits the evidence section but keeps the finding', () => {
    const html = renderPentestReport({ ...data, type: 'summary' });
    expect(html).not.toContain('Evidence (Screenshots)');
    expect(html).toContain('Horizontal IDOR on /api/orders');
  });

  it('retest variant swaps cover/summary/recommendations and renders the remediation-validation block', () => {
    const html = renderPentestReport({
      ...data,
      retest: true,
      findings: [
        { ...finding, status: 'Closed', retestStatusRaw: 'fixed', retestNotes: 'Object-level authz enforced.' },
      ],
    });
    expect(html).toContain('RETEST VERIFICATION REPORT'); // retest cover eyebrow
    expect(html).toContain('Retest Summary'); // exec summary replaced
    expect(html).toContain('Remediation Status'); // retest summary table
    expect(html).toContain('Remediation Validation'); // per-finding band
    expect(html).toContain('Object-level authz enforced.'); // retest notes
    expect(html).not.toContain('Executive Summary'); // initial exec summary not present
    expect(html).not.toMatch(/[—–]/); // no em/en dashes
  });

  it('keeps the full report byte-identical when retest is absent', () => {
    const a = renderPentestReport(data);
    const b = renderPentestReport({ ...data, retest: false });
    expect(a).toBe(b);
    expect(a).not.toContain('RETEST VERIFICATION REPORT');
    expect(a).not.toContain('Retest Summary');
  });

  it('prefers AI prose + consolidated recommendations when provided', () => {
    const html = renderPentestReport({
      ...data,
      aiProse: {
        overviewEn: 'AI executive overview narrative.',
        riskPostureEn: 'AI overall risk posture narrative.',
        mgmtRecEn: 'AI management recommendation narrative.',
        methodologyIntroEn: 'AI methodology intro narrative.',
        standardsUsed: [{ name: 'NIST SP 800-115', descEn: 'AI standard relevance.' }],
        phases: [{ titleEn: 'AI Phase Recon', titleId: 'AI Fase Recon', descEn: 'AI phase description.' }],
        toolsUsed: [{ en: 'AICustomScanner', id: 'AICustomScanner' }],
      },
      aiRecs: {
        phases: [
          {
            labelEn: 'AI Immediate',
            labelId: 'AI Segera',
            color: '#123456',
            itemsEn: ['AI rec item one'],
            itemsId: [],
          },
        ],
      },
    });
    expect(html).toContain('AI executive overview narrative.');
    expect(html).toContain('AI overall risk posture narrative.');
    expect(html).toContain('AI management recommendation narrative.');
    expect(html).toContain('AI methodology intro narrative.');
    expect(html).toContain('NIST SP 800-115');
    expect(html).toContain('AI standard relevance.');
    expect(html).toContain('AI Phase Recon');
    expect(html).toContain('AICustomScanner');
    expect(html).toContain('AI Immediate'); // AI consolidated-rec band label
    expect(html).toContain('AI rec item one');
    expect(html).toContain('background:#123456'); // validated hex band color
    expect(html).not.toMatch(/[—–]/);
  });

  it('keeps the full report byte-identical when aiProse/aiRecs are absent', () => {
    const a = renderPentestReport(data);
    const b = renderPentestReport({ ...data, aiProse: null, aiRecs: null });
    expect(a).toBe(b);
  });
});
