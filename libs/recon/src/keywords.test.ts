import { describe, it, expect } from 'vitest';
import { isInterestingEndpoint } from './keywords';

describe('isInterestingEndpoint', () => {
  it('flags admin/login/etc in url or title (case-insensitive)', () => {
    expect(isInterestingEndpoint('https://admin.example.com', null)).toBe(true);
    expect(isInterestingEndpoint('https://example.com/wp-login.php', null)).toBe(true);
    expect(isInterestingEndpoint('https://example.com', 'cPanel Login')).toBe(true);
    expect(isInterestingEndpoint('https://example.com/home', 'Welcome')).toBe(false);
  });
  it('respects a custom keyword list', () => {
    expect(isInterestingEndpoint('https://example.com/secret', null, ['secret'])).toBe(true);
    expect(isInterestingEndpoint('https://admin.example.com', null, ['secret'])).toBe(false);
  });
});
