import { describe, expect, it } from 'vitest';
import { isTrusted } from '../src/canary-url.js';

describe('canary for RFC 0017 step 5', () => {
    it('covers the deliberate sink, so the coverage floor still holds', () => {
        expect(isTrusted('https://rak200.com/x')).toBe(true);
        expect(isTrusted('https://example.com/x')).toBe(false);
    });
});
