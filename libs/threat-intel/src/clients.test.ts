import { describe, it, expect, vi } from 'vitest';
import { fetchOtxIndicator } from './otx';
import { fetchLeaks, md5 } from './leakcheck';

const jsonRes = (data: unknown, ok = true): Response => ({ ok, json: async () => data }) as unknown as Response;

describe('OTX client', () => {
  it('returns null without an API key (graceful degrade)', async () => {
    expect(await fetchOtxIndicator('example.com', {})).toBeNull();
  });

  it('aggregates general/malware/passive/url sections', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('/general')) return jsonRes({ pulse_info: { count: 3 }, reputation: 40 });
      if (url.includes('/malware')) return jsonRes({ count: 2 });
      if (url.includes('/passive_dns')) return jsonRes({ passive_dns: [{ address: '1.1.1.1' }] });
      if (url.includes('/url_list')) return jsonRes({ url_list: [{ url: 'http://x' }] });
      return jsonRes({});
    });
    const r = await fetchOtxIndicator('example.com', { apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).not.toBeNull();
    expect(r!.pulses).toBe(3);
    expect(r!.malwareCount).toBe(2);
    expect(r!.reputation).toBe(40);
    expect(r!.passiveDns).toHaveLength(1);
    expect(r!.urls).toHaveLength(1);
  });

  it('never throws on network error', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network');
    });
    const r = await fetchOtxIndicator('example.com', { apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toEqual({
      indicator: 'example.com',
      pulses: 0,
      malwareCount: 0,
      reputation: 0,
      passiveDns: [],
      urls: [],
    });
  });
});

describe('LeakCheck client', () => {
  it('returns [] without an API key', async () => {
    expect(await fetchLeaks('example.com', {})).toEqual([]);
  });

  it('maps results with stable md5 ids', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ result: [{ source: { name: 'BreachX' }, email: 'a@example.com' }] }));
    const r = await fetchLeaks('example.com', { apiKey: 'k', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toHaveLength(1);
    expect(r[0]!.source).toBe('BreachX');
    expect(r[0]!.identifier).toBe('a@example.com');
    expect(r[0]!.hashMd5).toBe(md5('BreachX:a@example.com'));
  });
});
