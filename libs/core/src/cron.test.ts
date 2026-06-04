import { describe, it, expect } from 'vitest';
import { isValidCron, cronMatches, parseCron } from './cron';

describe('cron parser', () => {
  it('validates field counts and syntax', () => {
    expect(isValidCron('* * * * *')).toBe(true);
    expect(isValidCron('0 2 * * *')).toBe(true);
    expect(isValidCron('*/15 * * * 1-5')).toBe(true);
    expect(isValidCron('0 0 1 1 0')).toBe(true);
    expect(isValidCron('* * * *')).toBe(false); // too few
    expect(isValidCron('60 * * * *')).toBe(false); // minute out of range
    expect(isValidCron('* 24 * * *')).toBe(false); // hour out of range
    expect(isValidCron('a * * * *')).toBe(false);
    expect(isValidCron('*/0 * * * *')).toBe(false); // bad step
  });

  it('expands ranges and steps', () => {
    const sets = parseCron('*/15 * * * *')!;
    expect([...sets[0]!].sort((a, b) => a - b)).toEqual([0, 15, 30, 45]);
  });

  it('matches a date against an expression', () => {
    // 2026-06-04 is a Thursday (getDay()=4); 02:00 local.
    const at0200Thu = new Date(2026, 5, 4, 2, 0, 0);
    expect(cronMatches('0 2 * * *', at0200Thu)).toBe(true); // daily 02:00
    expect(cronMatches('0 3 * * *', at0200Thu)).toBe(false); // 03:00 only
    expect(cronMatches('0 2 * * 4', at0200Thu)).toBe(true); // Thursdays 02:00
    expect(cronMatches('0 2 * * 1', at0200Thu)).toBe(false); // Mondays only
    expect(cronMatches('*/15 * * * *', new Date(2026, 5, 4, 9, 30))).toBe(true);
    expect(cronMatches('*/15 * * * *', new Date(2026, 5, 4, 9, 31))).toBe(false);
  });
});
