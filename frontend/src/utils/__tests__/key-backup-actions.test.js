import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPair } from '../mail-crypto';

const PASSPHRASE = 'correct horse battery staple';

const storageMap = new Map();
const localStorageStub = {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, value) => { storageMap.set(key, String(value)); },
    removeItem: (key) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
};

const freshModules = async () => {
    vi.resetModules();
    const actions = await import('../key-backup-actions');
    const store = await import('../mail-key-store');
    const backup = await import('../key-backup');
    return { actions, store, backup };
};

beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal('localStorage', localStorageStub);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('key-backup-actions createBackupFromPastedKey', () => {
    it('wraps a pasted raw key that matches a stored record', async () => {
        const { actions, store, backup } = await freshModules();
        const address = 'actions-a@example.com';
        const key = await generateKeyPair();
        await store.initKeyStore();
        const record = await store.addPrivateKey(address, key.privateKey);
        expect(record).not.toBeNull();

        const updated = await actions.createBackupFromPastedKey({
            text: key.privateKey, address, passphrase: PASSPHRASE,
        });
        expect(updated.publicKey).toBe(record.publicKey);
        expect(typeof updated.wrappedBackup).toBe('string');
        // The stored record now exposes the blob; re-wrapping works with
        // the lowest-iteration unwrap round trip (passphrase is the same).
        expect(store.hasWrappedBackup(address)).toBe(true);
        const { BACKUP_PBKDF2_MIN_ITERATIONS } = backup;
        expect(updated.wrappedBackup).toEqual(expect.any(String));
        void BACKUP_PBKDF2_MIN_ITERATIONS;
        const unwrapped = await backup.unwrapPrivateKey({
            blob: updated.wrappedBackup, address, passphrase: PASSPHRASE,
        });
        expect(unwrapped).toBe(key.privateKey);
    });

    it('accepts a pasted #k= decryption link', async () => {
        const { actions, store } = await freshModules();
        const address = 'actions-link@example.com';
        const key = await generateKeyPair();
        await store.initKeyStore();
        await store.addPrivateKey(address, key.privateKey);
        const link = `https://m.example/#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent(address)}`;
        const updated = await actions.createBackupFromPastedKey({
            text: link, address, passphrase: PASSPHRASE,
        });
        expect(store.getWrappedBackup(address)).toBe(updated.wrappedBackup);
    });

    it('rejects key material that does not match any stored record', async () => {
        const { actions, store } = await freshModules();
        const address = 'actions-mismatch@example.com';
        const storedKey = await generateKeyPair();
        const otherKey = await generateKeyPair();
        await store.initKeyStore();
        await store.addPrivateKey(address, storedKey.privateKey);
        await expect(actions.createBackupFromPastedKey({
            text: otherKey.privateKey, address, passphrase: PASSPHRASE,
        })).rejects.toThrow(actions.BackupKeyMismatchError);
        expect(store.hasWrappedBackup(address)).toBe(false);
    });

    it('rejects invalid pasted text', async () => {
        const { actions, store } = await freshModules();
        const address = 'actions-invalid@example.com';
        const key = await generateKeyPair();
        await store.initKeyStore();
        await store.addPrivateKey(address, key.privateKey);
        await expect(actions.createBackupFromPastedKey({
            text: 'not-a-key', address, passphrase: PASSPHRASE,
        })).rejects.toThrow(actions.BackupKeyInvalidError);
        await expect(actions.createBackupFromPastedKey({
            text: '#kp=garbage&a=x', address, passphrase: PASSPHRASE,
        })).rejects.toThrow(actions.BackupKeyInvalidError);
        await expect(actions.createBackupFromPastedKey({
            text: '', address, passphrase: PASSPHRASE,
        })).rejects.toThrow(actions.BackupKeyInvalidError);
        expect(store.hasWrappedBackup(address)).toBe(false);
    });

    it('enforces the passphrase policy before wrapping', async () => {
        const { actions, store, backup } = await freshModules();
        const address = 'actions-policy@example.com';
        const key = await generateKeyPair();
        await store.initKeyStore();
        await store.addPrivateKey(address, key.privateKey);
        await expect(actions.createBackupFromPastedKey({
            text: key.privateKey, address, passphrase: 'short',
        })).rejects.toThrow(backup.BackupPassphraseError);
        expect(store.hasWrappedBackup(address)).toBe(false);
    });
});

describe('key-backup-actions extractRawKeyFromText', () => {
    it('extracts keys from links, fragments and bare keys', async () => {
        const { actions } = await freshModules();
        const key = await generateKeyPair();
        expect(actions.extractRawKeyFromText(key.privateKey)).toBe(key.privateKey);
        expect(actions.extractRawKeyFromText(`  ${key.privateKey}  `)).toBe(key.privateKey);
        expect(actions.extractRawKeyFromText(`https://m.example/#k=${key.privateKey}&a=a@b.c`)).toBe(key.privateKey);
        expect(actions.extractRawKeyFromText(`#k=${key.privateKey}&a=a@b.c`)).toBe(key.privateKey);
        expect(actions.extractRawKeyFromText('#kp=xyz&a=a@b.c')).toBeNull();
        expect(actions.extractRawKeyFromText('')).toBeNull();
        expect(actions.extractRawKeyFromText(null)).toBeNull();
    });
});
