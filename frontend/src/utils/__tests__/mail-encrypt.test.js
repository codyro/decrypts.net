import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    generateKeyPair, encryptMail, decryptMail, isEncryptedRow, isEncryptedRaw,
    MAIL_ENCRYPTION_PREFIX,
} from '../mail-crypto';

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(console, 'warn').mockImplementation(() => { });
});

afterEach(() => {
    vi.restoreAllMocks();
});

const MIME = [
    'From: Sender <sender@example.com>',
    'Subject: Round trip',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'round trip body',
].join('\r\n');

describe('encryptMail', () => {
    it('round-trips with decryptMail (raw flag)', async () => {
        const keyPair = await generateKeyPair();
        const envelope = await encryptMail(keyPair.publicKey, MIME, { gzip: false });
        expect(envelope.startsWith(MAIL_ENCRYPTION_PREFIX)).toBe(true);
        expect(isEncryptedRaw(envelope)).toBe(true);
        expect(await decryptMail(keyPair.privateKey, envelope)).toBe(MIME);
    });

    it('round-trips with decryptMail (gzip flag)', async () => {
        const keyPair = await generateKeyPair();
        const envelope = await encryptMail(keyPair.publicKey, MIME, { gzip: true });
        expect(await decryptMail(keyPair.privateKey, envelope)).toBe(MIME);
    });

    it('produces a different envelope each time (random ephemeral key + iv)', async () => {
        const keyPair = await generateKeyPair();
        const a = await encryptMail(keyPair.publicKey, MIME, { gzip: false });
        const b = await encryptMail(keyPair.publicKey, MIME, { gzip: false });
        expect(a).not.toBe(b);
    });

    it('cannot be decrypted with an unrelated private key', async () => {
        const keyPair = await generateKeyPair();
        const other = await generateKeyPair();
        const envelope = await encryptMail(keyPair.publicKey, MIME, { gzip: false });
        await expect(decryptMail(other.privateKey, envelope)).rejects.toThrow();
    });
});

describe('isEncryptedRow', () => {
    const envelope = MAIL_ENCRYPTION_PREFIX + 'abc';

    it('explicit flag is authoritative on migrated rows', () => {
        expect(isEncryptedRow({ is_encrypted: 1, raw: 'anything' })).toBe(true);
        // sender-controlled plaintext starting with the prefix is NOT encrypted
        expect(isEncryptedRow({ is_encrypted: 0, raw: envelope })).toBe(false);
        expect(isEncryptedRow({ is_encrypted: 0, raw: MIME })).toBe(false);
        expect(isEncryptedRow({ is_encrypted: null, raw: envelope })).toBe(false);
    });

    it('falls back to the prefix check when the flag is absent', () => {
        expect(isEncryptedRow({ raw: envelope })).toBe(true);
        expect(isEncryptedRow({ raw: MIME })).toBe(false);
        expect(isEncryptedRow({})).toBe(false);
        expect(isEncryptedRow({ raw: null })).toBe(false);
        expect(isEncryptedRow(null)).toBe(false);
        expect(isEncryptedRow(undefined)).toBe(false);
    });
});
