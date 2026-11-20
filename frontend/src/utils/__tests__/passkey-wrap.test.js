import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateKeyPair, base64UrlToBytes } from '../mail-crypto';
import {
    wrapKeyWithPasskey, unwrapKeyWithPasskey, isPasskeyPrfPossible,
    PasskeyPrfUnsupportedError, PasskeyUnwrapError, PasskeyCancelledError,
    PASSKEY_BACKUP_VERSION, PASSKEY_BACKUP_MIN_BLOB_BYTES, PASSKEY_BACKUP_MAX_BLOB_BYTES,
} from '../passkey-wrap';
// The worker-side validator must accept everything this module produces.
import { validateKeyBackupBlob } from '../../../../worker/src/utils/key_backup';

const RP_ID = 'mailbox.example.com';
const CREDENTIAL_A = 'AQIDBAUGBwgJCgsMDQ4PEA'; // deterministic fake credential id (b64url)
const CREDENTIAL_B = 'EhMUFRYXGBkaGxwdHh8Q';

let addressCounter = 0;
const uniqueAddress = () => `passkey-test-${++addressCounter}@example.com`;

/**
 * Deterministic PRF mock: the "authenticator" answers the eval by hashing
 * credentialId || evalInput, so different credentials produce different PRF
 * outputs for the same salt (like a real authenticator does) and tests can
 * simulate wrong-credential unwraps. `behavior` can replace the prf results
 * (e.g. simulate a non-PRF authenticator) or make get() reject.
 */
const installMockCredentials = ({ behavior } = {}) => {
    const get = vi.fn(async (options) => {
        if (behavior?.reject) throw behavior.reject;
        const publicKey = options?.publicKey || {};
        const credentialId = new Uint8Array(publicKey.allowCredentials?.[0]?.id || []);
        const evalInput = new Uint8Array(publicKey.extensions?.prf?.eval?.first || []);
        const material = new Uint8Array(credentialId.length + evalInput.length);
        material.set(credentialId, 0);
        material.set(evalInput, credentialId.length);
        const digest = await crypto.subtle.digest('SHA-256', material);
        const results = behavior?.results === undefined
            ? { first: digest }
            : behavior.results;
        return {
            type: 'public-key',
            getClientExtensionResults: () => ({ prf: { results } }),
        };
    });
    vi.stubGlobal('navigator', { credentials: { get } });
    return get;
};

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('isPasskeyPrfPossible', () => {
    it('is false without WebAuthn globals', async () => {
        expect(await isPasskeyPrfPossible()).toBe(false);
    });

    it('reads the extension:prf client capability when available', async () => {
        vi.stubGlobal('navigator', { credentials: {} });
        vi.stubGlobal('window', {
            PublicKeyCredential: { getClientCapabilities: async () => ({ 'extension:prf': true }) },
        });
        expect(await isPasskeyPrfPossible()).toBe(true);
        vi.stubGlobal('window', {
            PublicKeyCredential: { getClientCapabilities: async () => ({ 'extension:prf': false }) },
        });
        expect(await isPasskeyPrfPossible()).toBe(false);
    });

    it('falls back to optimistic true without getClientCapabilities', async () => {
        vi.stubGlobal('navigator', { credentials: {} });
        vi.stubGlobal('window', { PublicKeyCredential: {} });
        expect(await isPasskeyPrfPossible()).toBe(true);
    });
});

describe('passkey wrap/unwrap', () => {
    it('round trips a private key and produces a worker-valid blob', async () => {
        installMockCredentials();
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const { blob, credentialId } = await wrapKeyWithPasskey({
            privateKeyB64u: key.privateKey,
            address,
            keyId: key.publicKey,
            credentialId: CREDENTIAL_A,
            rpId: RP_ID,
        });
        expect(credentialId).toBe(CREDENTIAL_A);

        // Blob shape: version byte, 32B salt, 12B iv, ciphertext||tag; total
        // within the worker's [62, 4096] bounds and accepted by its validator.
        const bytes = base64UrlToBytes(blob);
        expect(bytes[0]).toBe(PASSKEY_BACKUP_VERSION);
        expect(bytes[0]).toBe(0x02);
        expect(bytes.length).toBeGreaterThanOrEqual(PASSKEY_BACKUP_MIN_BLOB_BYTES);
        expect(bytes.length).toBeLessThanOrEqual(PASSKEY_BACKUP_MAX_BLOB_BYTES);
        expect(validateKeyBackupBlob(blob)).toBe(true);
        // The wire format is unpadded base64url.
        expect(blob).not.toMatch(/[+/=]/);

        const unwrapped = await unwrapKeyWithPasskey({
            blob, address, keyId: key.publicKey, credentialId: CREDENTIAL_A, rpId: RP_ID,
        });
        expect(unwrapped).toBe(key.privateKey);
    });

    it('sends the PRF assertion with the blob salt, uv required and the credential allowlist', async () => {
        const get = installMockCredentials();
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const { blob } = await wrapKeyWithPasskey({
            privateKeyB64u: key.privateKey, address, keyId: key.publicKey,
            credentialId: CREDENTIAL_A, rpId: RP_ID,
        });
        expect(get).toHaveBeenCalledTimes(1);
        const options = get.mock.calls[0][0].publicKey;
        expect(options.rpId).toBe(RP_ID);
        expect(options.userVerification).toBe('required');
        expect(options.challenge).toBeInstanceOf(Uint8Array);
        expect(options.challenge.length).toBe(32);
        expect(new Uint8Array(options.allowCredentials[0].id)).toEqual(base64UrlToBytes(CREDENTIAL_A));
        // The eval input is the 32-byte blob salt (bytes 1..33 of the blob).
        const bytes = base64UrlToBytes(blob);
        expect(new Uint8Array(options.extensions.prf.eval.first)).toEqual(bytes.slice(1, 33));
    });

    it('fails to unwrap with a different passkey (wrong PRF output)', async () => {
        installMockCredentials();
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const { blob } = await wrapKeyWithPasskey({
            privateKeyB64u: key.privateKey, address, keyId: key.publicKey,
            credentialId: CREDENTIAL_A, rpId: RP_ID,
        });
        await expect(unwrapKeyWithPasskey({
            blob, address, keyId: key.publicKey, credentialId: CREDENTIAL_B, rpId: RP_ID,
        })).rejects.toBeInstanceOf(PasskeyUnwrapError);
    });

    it('fails to unwrap when the blob is re-labelled to another address or key', async () => {
        installMockCredentials();
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const { blob } = await wrapKeyWithPasskey({
            privateKeyB64u: key.privateKey, address, keyId: key.publicKey,
            credentialId: CREDENTIAL_A, rpId: RP_ID,
        });
        await expect(unwrapKeyWithPasskey({
            blob, address: uniqueAddress(), keyId: key.publicKey,
            credentialId: CREDENTIAL_A, rpId: RP_ID,
        })).rejects.toBeInstanceOf(PasskeyUnwrapError);
        const otherKey = await generateKeyPair();
        await expect(unwrapKeyWithPasskey({
            blob, address, keyId: otherKey.publicKey,
            credentialId: CREDENTIAL_A, rpId: RP_ID,
        })).rejects.toBeInstanceOf(PasskeyUnwrapError);
    });

    it('reports a missing prf result as PasskeyPrfUnsupportedError', async () => {
        installMockCredentials({ behavior: { results: null } });
        const address = uniqueAddress();
        const key = await generateKeyPair();
        await expect(wrapKeyWithPasskey({
            privateKeyB64u: key.privateKey, address, keyId: key.publicKey,
            credentialId: CREDENTIAL_A, rpId: RP_ID,
        })).rejects.toBeInstanceOf(PasskeyPrfUnsupportedError);
    });

    it('reports a dismissed prompt as PasskeyCancelledError', async () => {
        installMockCredentials({ behavior: { reject: Object.assign(new Error('denied'), { name: 'NotAllowedError' }) } });
        const address = uniqueAddress();
        const key = await generateKeyPair();
        await expect(wrapKeyWithPasskey({
            privateKeyB64u: key.privateKey, address, keyId: key.publicKey,
            credentialId: CREDENTIAL_A, rpId: RP_ID,
        })).rejects.toBeInstanceOf(PasskeyCancelledError);
    });

    it('rejects malformed blobs and wrong versions', async () => {
        installMockCredentials();
        const address = uniqueAddress();
        const key = await generateKeyPair();
        await expect(unwrapKeyWithPasskey({
            blob: '!!!', address, keyId: key.publicKey, credentialId: CREDENTIAL_A, rpId: RP_ID,
        })).rejects.toThrow('Invalid passkey backup encoding');
        // Version 0x01 (passphrase backup format) is not a passkey blob.
        const passphraseBlob = base64UrlToBytes(
            'AUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUEAA'
                + 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        );
        passphraseBlob[0] = 0x01;
        const { bytesToBase64Url } = await import('../mail-crypto');
        await expect(unwrapKeyWithPasskey({
            blob: bytesToBase64Url(passphraseBlob),
            address, keyId: key.publicKey, credentialId: CREDENTIAL_A, rpId: RP_ID,
        })).rejects.toThrow('Unsupported passkey backup version');
    });

    it('requires address, keyId and credentialId', async () => {
        installMockCredentials();
        const key = await generateKeyPair();
        await expect(wrapKeyWithPasskey({
            privateKeyB64u: key.privateKey, keyId: key.publicKey, credentialId: CREDENTIAL_A,
        })).rejects.toThrow('address is required');
    });
});
