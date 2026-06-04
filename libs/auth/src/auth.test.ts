import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, needsRehash } from './password';
import { generateApiToken, hashToken, verifyToken, TOKEN_PREFIX } from './token';
import { encryptSecret, decryptSecret } from './vault';

describe('password hashing', () => {
  it('hashes with argon2id and verifies correctly', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });

  it('still verifies legacy scrypt hashes and flags them for rehash', async () => {
    // A pre-migration scrypt hash of "legacy-pass" (scrypt$<salt>$<hash>).
    const { scryptSync, randomBytes } = await import('node:crypto');
    const salt = randomBytes(16);
    const legacy = `scrypt$${salt.toString('hex')}$${scryptSync('legacy-pass', salt, 64).toString('hex')}`;
    expect(await verifyPassword('legacy-pass', legacy)).toBe(true);
    expect(await verifyPassword('nope', legacy)).toBe(false);
    expect(needsRehash(legacy)).toBe(true);
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
