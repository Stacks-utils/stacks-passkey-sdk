import { describe, expect, it } from 'vitest';
import { createCorsOriginMatcher, isCorsOriginAllowed, resolveCorsOriginEntries } from './cors-origins.js';

describe('cors origins', () => {
  it('includes localhost and hosted demo by default', () => {
    const entries = resolveCorsOriginEntries({});
    expect(entries).toContain('http://localhost:3000');
    expect(entries).toContain('https://stacks-passkey-sdk-demo.vercel.app');
  });

  it('merges CORS_ORIGINS from env', () => {
    const entries = resolveCorsOriginEntries({
      CORS_ORIGINS: 'https://my-app.example.com,https://preview.example.com',
    });
    expect(entries).toContain('https://my-app.example.com');
    expect(entries).toContain('https://preview.example.com');
  });

  it('supports wildcard suffix entries', () => {
    const allowed = ['*.vercel.app'];
    expect(isCorsOriginAllowed('https://stacks-passkey-sdk-demo.vercel.app', allowed)).toBe(true);
    expect(isCorsOriginAllowed('https://evil.vercel.app.evil.com', allowed)).toBe(false);
    expect(isCorsOriginAllowed('http://localhost:3000', allowed)).toBe(false);
  });

  it('returns empty string for disallowed origins', () => {
    const match = createCorsOriginMatcher({});
    expect(match('https://stacks-passkey-sdk-demo.vercel.app')).toBe(
      'https://stacks-passkey-sdk-demo.vercel.app'
    );
    expect(match('https://unknown.example.com')).toBe('');
  });
});
