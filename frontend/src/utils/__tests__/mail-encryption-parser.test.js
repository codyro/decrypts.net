import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setLoggedInAddressResolver, processItem } from '../email-parser';
import {
    generateKeyPair, bytesToBase64Url, base64UrlToBytes, MAIL_ENCRYPTION_PREFIX,
} from '../mail-crypto';
import { addPrivateKey, removePrivateKeys, getKeyRecords } from '../mail-key-store';

vi.mock('mail-parser-wasm', () => ({
    parse_message: () => { throw new Error('Exercise the PostalMime fallback'); },
}));

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => { });
    vi.spyOn(console, 'error').mockImplementation(() => { });
    vi.spyOn(console, 'warn').mockImplementation(() => { });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:attachment');
});

afterEach(async () => {
    vi.restoreAllMocks();
    await removePrivateKeys(ADDRESS);
    await removePrivateKeys(OTHER_ADDRESS);
});

const ADDRESS = 'enc@example.com';
const OTHER_ADDRESS = 'other@example.com';

const MIME = [
    'From: Sender <sender@example.com>',
    'Subject: =?UTF-8?B?5rWL6K+V?=',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'secret body',
].join('\r\n');

/** Minimal test-side encrypt matching worker/src/utils/mail_crypto.ts (flag byte 0). */
const encryptMail = async (publicKeyB64u, raw) => {
    const recipientKey = await crypto.subtle.importKey(
        'raw', base64UrlToBytes(publicKeyB64u), { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    const ephemeral = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    );
    const ephemeralPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: recipientKey }, ephemeral.privateKey, 256
    );
    const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);
    const aesKeyBits = await crypto.subtle.deriveBits(
        {
            name: 'HKDF', salt: ephemeralPublicKeyRaw,
            info: new TextEncoder().encode('cf-temp-email/mail-encryption/v1'), hash: 'SHA-256',
        },
        hkdfKey, 256
    );
    const aesKey = await crypto.subtle.importKey('raw', aesKeyBits, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new Uint8Array(1 + new TextEncoder().encode(raw).length);
    plaintext[0] = 0;
    plaintext.set(new TextEncoder().encode(raw), 1);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('cfte1') }, aesKey, plaintext
    ));
    const envelope = new Uint8Array(65 + 12 + ciphertext.length);
    envelope.set(ephemeralPublicKeyRaw, 0);
    envelope.set(iv, 65);
    envelope.set(ciphertext, 77);
    return MAIL_ENCRYPTION_PREFIX + bytesToBase64Url(envelope);
};

describe('processItem with encrypted mail', () => {
    it('round-trips: decrypts with the stored key and parses normally', async () => {
        const keyPair = await generateKeyPair();
        await addPrivateKey(ADDRESS, keyPair.privateKey);
        const envelope = await encryptMail(keyPair.publicKey, MIME);
        const item = await processItem({ raw: envelope, address: ADDRESS, source: 'bounce@transport.example' });
        expect(item.encrypted).toBe(true);
        expect(item.locked).toBeUndefined();
        expect(item.raw.startsWith(MAIL_ENCRYPTION_PREFIX)).toBe(false);
        expect(item.subject).toBe('测试');
        expect(item.message).toContain('secret body');
        expect(item.source).toBe('Sender <sender@example.com>');
        expect(item.attachments).toEqual([]);
    });

    it('locks with missing_key when no private key is stored', async () => {
        const keyPair = await generateKeyPair();
        const envelope = await encryptMail(keyPair.publicKey, MIME);
        const item = await processItem({ raw: envelope, address: ADDRESS, source: 'bounce@transport.example' });
        expect(item.encrypted).toBe(true);
        expect(item.locked).toBe(true);
        expect(item.lockReason).toBe('missing_key');
        // encrypted raw must never leak into display fields
        expect(item.message).toBe('');
        expect(item.text).toBe('');
        expect(item.subject).not.toContain(MAIL_ENCRYPTION_PREFIX);
        expect(item.raw.startsWith(MAIL_ENCRYPTION_PREFIX)).toBe(true);
        expect(item.attachments).toEqual([]);
    });

    it('locks with decrypt_failed when the stored key does not match', async () => {
        const keyPair = await generateKeyPair();
        const wrongKey = await generateKeyPair();
        await addPrivateKey(ADDRESS, wrongKey.privateKey);
        const envelope = await encryptMail(keyPair.publicKey, MIME);
        const item = await processItem({ raw: envelope, address: ADDRESS, source: 'bounce@transport.example' });
        expect(item.locked).toBe(true);
        expect(item.lockReason).toBe('decrypt_failed');
        expect(item.message).toBe('');
    });

    it('falls back to a key stored under the logged-in address', async () => {
        const { setLoggedInAddressResolver } = await import('../email-parser');
        const keyPair = await generateKeyPair();
        await addPrivateKey(OTHER_ADDRESS, keyPair.privateKey);
        setLoggedInAddressResolver(async () => OTHER_ADDRESS);
        try {
            const envelope = await encryptMail(keyPair.publicKey, MIME);
            const item = await processItem({ raw: envelope, source: 'bounce@transport.example' });
            expect(item.locked).toBeUndefined();
            expect(item.subject).toBe('测试');
        } finally {
            setLoggedInAddressResolver(null);
        }
    });

    it('still decrypts mail encrypted under a rotated (older) key', async () => {
        const oldKey = await generateKeyPair();
        const newKey = await generateKeyPair();
        const envelope = await encryptMail(oldKey.publicKey, MIME);
        // rotate: new key first, old key kept
        await addPrivateKey(ADDRESS, oldKey.privateKey);
        await addPrivateKey(ADDRESS, newKey.privateKey);
        expect(getKeyRecords(ADDRESS).map((r) => r.publicKey))
            .toEqual([newKey.publicKey, oldKey.publicKey]);
        const item = await processItem({ raw: envelope, address: ADDRESS, source: 'bounce@transport.example' });
        expect(item.locked).toBeUndefined();
        expect(item.subject).toBe('测试');
        expect(item.message).toContain('secret body');
    });

    it('leaves plaintext mail completely untouched', async () => {
        const item = await processItem({ raw: MIME, address: ADDRESS, source: 'bounce@transport.example' });
        expect(item.encrypted).toBeUndefined();
        expect(item.locked).toBeUndefined();
        expect(item.subject).toBe('测试');
        expect(item.message).toContain('secret body');
    });
});
