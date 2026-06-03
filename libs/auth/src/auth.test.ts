import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';
import { generateApiToken, hashToken, verifyToken, TOKEN_PREFIX } from './token';
import { encryptSecret, decryptSecret } from './vault';

describe('password hashing', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('api tokens', () => {
  it('generates a prefixed token whose hash verifies', () => {
    const { plaintext, hash } = generateApiToken();
    expect(plaintext.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(hash).toBe(hashToken(plaintext));
    expect(verifyToken(plaintext, hash)).toBe(true);
    expect(verifyToken('vct_wrong', hash)).toBe(false);
  });
});

describe('vault (AES-256-GCM)', () => {
  const key = Buffer.alloc(32, 3).toString('base64');
  it('round-trips a secret', () => {
    const ct = encryptSecret('super-secret-otx-key', key);
    expect(ct).not.toContain('super-secret');
    expect(decryptSecret(ct, key)).toBe('super-secret-otx-key');
  });
  it('fails to decrypt with the wrong key', () => {
    const ct = encryptSecret('x', key);
    expect(() => decryptSecret(ct, Buffer.alloc(32, 9).toString('base64'))).toThrow();
  });
});
