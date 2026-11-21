import { describe, expect, it } from 'vitest';

import { isPasskeyPseudoEmail, isWebAuthnSupported } from '../passkey-account';

describe('isPasskeyPseudoEmail', () => {
    it('matches the server-generated pk- prefix pseudo-emails', () => {
        expect(isPasskeyPseudoEmail('pk-a1b2c3d4e5f6@passkey.invalid')).toBe(true);
    });

    it('matches any address ending in the reserved .invalid TLD', () => {
        expect(isPasskeyPseudoEmail('anything@example.invalid')).toBe(true);
    });

    it('is case-insensitive and ignores surrounding whitespace', () => {
        expect(isPasskeyPseudoEmail('PK-A1B2C3@PASSKEY.INVALID')).toBe(true);
        expect(isPasskeyPseudoEmail('  pk-a1b2c3@passkey.invalid  ')).toBe(true);
    });

    it('does not match real addresses or lookalikes', () => {
        expect(isPasskeyPseudoEmail('user@example.com')).toBe(false);
        expect(isPasskeyPseudoEmail('user@invalidated.example.com')).toBe(false);
        expect(isPasskeyPseudoEmail('user@invalid')).toBe(false);
        expect(isPasskeyPseudoEmail('pk-abc@passkey.invalidated')).toBe(false);
        expect(isPasskeyPseudoEmail('')).toBe(false);
    });

    it('returns false for non-string values', () => {
        expect(isPasskeyPseudoEmail(undefined)).toBe(false);
        expect(isPasskeyPseudoEmail(null)).toBe(false);
        expect(isPasskeyPseudoEmail(123)).toBe(false);
    });
});

describe('isWebAuthnSupported', () => {
    it('is a boolean in the jsdom test environment', () => {
        expect(typeof isWebAuthnSupported()).toBe('boolean');
    });
});
