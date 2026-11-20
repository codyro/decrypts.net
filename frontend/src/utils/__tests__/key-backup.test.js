import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    generateKeyPair, encryptMail, decryptMail, base64UrlToBytes, bytesToBase64Url,
} from '../mail-crypto';
import {
    wrapPrivateKey, unwrapPrivateKey, buildBackupLink, buildBackupFileContent,
    backupFileName, parseBackupFile, parseWrappedFragment, validatePassphrase,
    BACKUP_PBKDF2_ITERATIONS, BACKUP_PBKDF2_MIN_ITERATIONS, BACKUP_PBKDF2_MAX_ITERATIONS,
    BACKUP_MIN_PASSPHRASE_LENGTH,
    BackupPassphraseError, BackupFormatError,
} from '../key-backup';

let addressCounter = 0;
const uniqueAddress = () => `backup-test-${++addressCounter}@example.com`;
const PASSPHRASE = 'correct horse battery staple';
// Tests use the lowest allowed iteration count to stay fast; the default
// itself is asserted structurally below.
const FAST_ITERATIONS = BACKUP_PBKDF2_MIN_ITERATIONS;

const storageMap = new Map();
const localStorageStub = {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, value) => { storageMap.set(key, String(value)); },
    removeItem: (key) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
};

const freshModules = async () => {
    vi.resetModules();
    const backup = await import('../key-backup');
    const store = await import('../mail-key-store');
    const fragment = await import('../mail-fragment');
    return { backup, store, fragment };
};

beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal('localStorage', localStorageStub);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('key-backup wrap/unwrap', () => {
    it('round trips a private key', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        expect(await unwrapPrivateKey({ blob, address, passphrase: PASSPHRASE })).toBe(key.privateKey);
    });

    it('produces the deterministic blob structure (version, iterations, salt, iv, tag)', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({ privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE });
        const bytes = base64UrlToBytes(blob);
        const pkcs8 = base64UrlToBytes(key.privateKey);
        expect(bytes[0]).toBe(0x01);
        expect(new DataView(bytes.buffer, bytes.byteOffset).getUint32(1, false))
            .toBe(BACKUP_PBKDF2_ITERATIONS);
        expect(bytes.length).toBe(33 + pkcs8.length + 16); // header + PKCS8 + GCM tag
        // two wraps never reuse salt/iv
        const other = await wrapPrivateKey({ privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE });
        expect(other).not.toBe(blob);
    });

    it('rejects a wrong passphrase with BackupPassphraseError', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        await expect(unwrapPrivateKey({ blob, address, passphrase: 'wrong horse battery staple' }))
            .rejects.toThrow(BackupPassphraseError);
    });

    it('fails on tampered ciphertext or a re-labelled address (AAD)', async () => {
        const address = uniqueAddress();
        const other = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const bytes = base64UrlToBytes(blob);
        bytes[bytes.length - 1] ^= 0x01;
        await expect(unwrapPrivateKey({
            blob: bytesToBase64Url(bytes), address, passphrase: PASSPHRASE,
        })).rejects.toThrow(BackupPassphraseError);
        // the blob cannot be unwrapped under a different address
        await expect(unwrapPrivateKey({ blob, address: other, passphrase: PASSPHRASE }))
            .rejects.toThrow(BackupPassphraseError);
    });

    it('enforces the iteration floor and ceiling', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        await expect(wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE,
            iterations: BACKUP_PBKDF2_MIN_ITERATIONS - 1,
        })).rejects.toThrow(RangeError);
        await expect(wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE,
            iterations: BACKUP_PBKDF2_MAX_ITERATIONS + 1,
        })).rejects.toThrow(RangeError);
        // an out-of-range stored iteration count is a format error on import
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const bytes = base64UrlToBytes(blob);
        new DataView(bytes.buffer, bytes.byteOffset).setUint32(1, BACKUP_PBKDF2_MIN_ITERATIONS - 1, false);
        await expect(unwrapPrivateKey({
            blob: bytesToBase64Url(bytes), address, passphrase: PASSPHRASE,
        })).rejects.toThrow(BackupFormatError);
        new DataView(bytes.buffer, bytes.byteOffset).setUint32(1, BACKUP_PBKDF2_MAX_ITERATIONS + 1, false);
        await expect(unwrapPrivateKey({
            blob: bytesToBase64Url(bytes), address, passphrase: PASSPHRASE,
        })).rejects.toThrow(BackupFormatError);
    });

    it('rejects an unknown version and malformed blobs with BackupFormatError', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const bytes = base64UrlToBytes(blob);
        bytes[0] = 0x02;
        await expect(unwrapPrivateKey({
            blob: bytesToBase64Url(bytes), address, passphrase: PASSPHRASE,
        })).rejects.toThrow(BackupFormatError);
        await expect(unwrapPrivateKey({ blob: '!!!', address, passphrase: PASSPHRASE }))
            .rejects.toThrow(BackupFormatError);
        await expect(unwrapPrivateKey({ blob: 'AAAA', address, passphrase: PASSPHRASE }))
            .rejects.toThrow(BackupFormatError); // too short
    });

    it('never includes key material in error messages', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        try {
            await wrapPrivateKey({ privateKeyB64u: key.privateKey, address, passphrase: 'short' });
            expect.unreachable();
        } catch (error) {
            expect(error.message).not.toContain(key.privateKey);
        }
    });
});

describe('key-backup passphrase policy', () => {
    it('accepts a passphrase of at least 10 chars', () => {
        expect(validatePassphrase('x'.repeat(BACKUP_MIN_PASSPHRASE_LENGTH))).toHaveLength(10);
    });

    it('rejects empty, non-string and too-short passphrases', () => {
        for (const bad of ['', '123456789', null, undefined, 42]) {
            expect(() => validatePassphrase(bad)).toThrow(BackupPassphraseError);
        }
    });

    it('rejects passphrases above 1024 chars', () => {
        expect(() => validatePassphrase('x'.repeat(1025))).toThrow(BackupPassphraseError);
        expect(() => validatePassphrase('x'.repeat(1024))).not.toThrow();
    });
});

describe('key-backup link and file formats', () => {
    it('builds and parses a #kp= backup link', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const link = buildBackupLink(address, blob, 'https://mail.example');
        expect(link).toBe(`https://mail.example/#kp=${blob}&a=${encodeURIComponent(address)}`);
        expect(parseWrappedFragment(link)).toEqual({ blob, address });
    });

    it('parseWrappedFragment handles bare hashes and rejects #k= / garbage', async () => {
        expect(parseWrappedFragment('#kp=blob123&a=x%40y.z')).toEqual({ blob: 'blob123', address: 'x@y.z' });
        expect(parseWrappedFragment('#k=abc&a=x')).toBeNull();
        expect(parseWrappedFragment('#kp=only-blob')).toBeNull();
        expect(parseWrappedFragment('#kp=only-blob&a=')).toBeNull();
        expect(parseWrappedFragment('no-fragment')).toBeNull();
        expect(parseWrappedFragment('')).toBeNull();
    });

    it('buildBackupLink falls back to window.location.origin without baseUrl', async () => {
        vi.stubGlobal('window', { location: { origin: 'https://origin.example' } });
        expect(buildBackupLink('a@b.c', 'blob')).toBe('https://origin.example/#kp=blob&a=a%40b.c');
        vi.unstubAllGlobals();
    });

    it('builds and strictly parses a backup file', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const text = buildBackupFileContent(address, blob, { createdAt: '2026-01-02T03:04:05.000Z' });
        const parsed = JSON.parse(text);
        expect(parsed.format).toBe('cf-temp-email-key-backup');
        expect(parsed.version).toBe(1);
        expect(parsed.address).toBe(address);
        expect(parsed.createdAt).toBe('2026-01-02T03:04:05.000Z');
        expect(parsed.kdf).toBe('PBKDF2-SHA256');
        expect(parsed.blob).toBe(blob);
        expect(parseBackupFile(text)).toEqual({ address, blob });
        // createdAt defaults to a timestamp
        const defaulted = JSON.parse(buildBackupFileContent(address, blob));
        expect(Number.isNaN(Date.parse(defaulted.createdAt))).toBe(false);
    });

    it('parseBackupFile rejects malformed files with BackupFormatError', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const good = buildBackupFileContent(address, blob);
        const mutate = (fn) => {
            const parsed = JSON.parse(good);
            fn(parsed);
            return JSON.stringify(parsed);
        };
        for (const bad of [
            'not json',
            '[1,2]',
            '{}',
            mutate((p) => { p.format = 'other'; }),
            mutate((p) => { p.version = 2; }),
            mutate((p) => { p.kdf = 'scrypt'; }),
            mutate((p) => { p.blob = ''; }),
            mutate((p) => { p.address = ''; }),
        ]) {
            expect(() => parseBackupFile(bad)).toThrow(BackupFormatError);
        }
    });

    it('backupFileName suggests a sanitized .json name', () => {
        expect(backupFileName('a@b.c')).toBe('cf-temp-email-key-backup-a@b.c.json');
        expect(backupFileName('a/b\\c:d')).toBe('cf-temp-email-key-backup-a_b_c_d.json');
    });
});

describe('wrapped-backup import via mail-fragment', () => {
    it('importWrappedBackup stores a non-extractable key AND the blob, and decrypts real mail', async () => {
        const address = uniqueAddress();
        const { store, fragment } = await freshModules();
        await store.initKeyStore();
        const key = await generateKeyPair();
        const blob = await wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });

        const record = await fragment.importWrappedBackup({ blob, address, passphrase: PASSPHRASE });

        expect(record.publicKey).toBe(key.publicKey);
        expect(record.privateKey instanceof CryptoKey).toBe(true);
        expect(record.privateKey.extractable).toBe(false);
        expect(record.wrappedBackup).toBe(blob);
        expect(store.getWrappedBackup(address)).toBe(blob);
        expect(store.hasWrappedBackup(address)).toBe(true);
        const envelope = await encryptMail(key.publicKey, 'wrapped import body', { gzip: false });
        expect(await decryptMail(store.getPrivateKeys(address)[0], envelope)).toBe('wrapped import body');
    });

    it('importWrappedBackup propagates BackupPassphraseError without storing anything', async () => {
        const address = uniqueAddress();
        const { store, fragment, backup } = await freshModules();
        await store.initKeyStore();
        const key = await generateKeyPair();
        const blob = await backup.wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        // Error classes come from the freshly imported module (vi.resetModules
        // gives each test its own class identity).
        await expect(fragment.importWrappedBackup({ blob, address, passphrase: 'wrong horse battery staple' }))
            .rejects.toThrow(backup.BackupPassphraseError);
        expect(store.getPrivateKeys(address)).toEqual([]);
    });

    it('importKeyOrLink with a #kp= link asks for the passphrase without importing', async () => {
        const address = uniqueAddress();
        const { store, fragment, backup } = await freshModules();
        await store.initKeyStore();
        const key = await generateKeyPair();
        const blob = await backup.wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const link = `https://m.example/#kp=${blob}&a=${encodeURIComponent(address)}`;
        const result = await fragment.importKeyOrLink(link);
        expect(result.ok).toBe(false);
        expect(result.needsPassphrase).toBe(true);
        expect(result.address).toBe(address);
        expect(result.wrapped).toEqual({ blob, address });
        expect(store.getPrivateKeys(address)).toEqual([]);
    });

    it('ingestDecryptionFragmentFromLocation queues #kp= without importing, and strips it', async () => {
        const address = uniqueAddress();
        const { store, fragment, backup } = await freshModules();
        await store.initKeyStore();
        const key = await generateKeyPair();
        const blob = await backup.wrapPrivateKey({
            privateKeyB64u: key.privateKey, address, passphrase: PASSPHRASE, iterations: FAST_ITERATIONS,
        });
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { hash: `#kp=${blob}&a=${encodeURIComponent(address)}`, pathname: '/en/', search: '?jwt=token' },
            history: { replaceState },
        });

        const stored = await fragment.ingestDecryptionFragmentFromLocation();

        expect(stored).toBeNull();
        expect(store.getPrivateKeys(address)).toEqual([]);
        expect(fragment.pendingWrappedImports.value).toEqual([{ address, blob }]);
        expect(replaceState).toHaveBeenCalledWith(null, '', '/en/?jwt=token');
    });

    it('ingestDecryptionFragmentFromLocation still imports #k= and offers the raw key transiently', async () => {
        const address = uniqueAddress();
        const { store, fragment } = await freshModules();
        await store.initKeyStore();
        const key = await generateKeyPair();
        const seen = [];
        fragment.setRawImportOfferHandler(({ address: addr, rawKey, record }) => {
            seen.push({ addr, rawKey, publicKey: record.publicKey });
        });
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { hash: `#k=${key.privateKey}&a=${encodeURIComponent(address)}`, pathname: '/en/', search: '' },
            history: { replaceState },
        });

        const stored = await fragment.ingestDecryptionFragmentFromLocation();

        expect(stored).toBe(address);
        expect(seen).toEqual([{ addr: address, rawKey: key.privateKey, publicKey: key.publicKey }]);
        expect(store.getPrivateKeys(address)).toHaveLength(1);
        fragment.setRawImportOfferHandler(null);
    });

    it('a #k= import without an offer handler drops the raw key and still imports', async () => {
        const address = uniqueAddress();
        const { store, fragment } = await freshModules();
        await store.initKeyStore();
        const key = await generateKeyPair();
        vi.stubGlobal('window', {
            location: { hash: `#k=${key.privateKey}&a=${encodeURIComponent(address)}`, pathname: '/en/', search: '' },
            history: { replaceState: vi.fn() },
        });
        const stored = await fragment.ingestDecryptionFragmentFromLocation();
        expect(stored).toBe(address);
        expect(store.getPrivateKeys(address)).toHaveLength(1);
    });
});

describe('stripDecryptionFragment with wrapped fragments', () => {
    it('strips #kp= fragments from hashes and full paths', async () => {
        const { fragment } = await freshModules();
        const hash = `#kp=${'A'.repeat(64)}&a=${encodeURIComponent('strip@example.com')}`;
        expect(fragment.stripDecryptionFragment(hash)).toBe('');
        expect(fragment.stripDecryptionFragment(`/en/?jwt=token${hash}`)).toBe('/en/?jwt=token');
    });

    it('still strips #k= fragments and leaves other hashes untouched', async () => {
        const { fragment } = await freshModules();
        const key = await generateKeyPair();
        const hash = `#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent('s@example.com')}`;
        expect(fragment.stripDecryptionFragment(hash)).toBe('');
        expect(fragment.stripDecryptionFragment('#section')).toBe('#section');
        expect(fragment.stripDecryptionFragment('#kp=only-blob')).toBe('#kp=only-blob');
    });
});
