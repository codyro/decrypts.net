import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
    generateKeyPair, encryptMail, decryptMail, importPrivateKeyNonExtractable,
} from '../mail-crypto';

// Fresh addresses per test: the shared fake-indexeddb database is never
// deleted (deleteDatabase would block on connections held by previously
// imported store modules), and unique addresses make tests independent.
let addressCounter = 0;
const uniqueAddress = () => `key-test-${++addressCounter}@example.com`;

const DB_NAME = 'cf-temp-email-keys';

const storageMap = new Map();
const localStorageStub = {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, value) => { storageMap.set(key, String(value)); },
    removeItem: (key) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
};

// Fresh module state for every test (the store keeps module-level state).
const freshModules = async () => {
    vi.resetModules();
    const store = await import('../mail-key-store');
    const fragment = await import('../mail-fragment');
    return { store, fragment };
};

beforeEach(() => {
    storageMap.clear();
    vi.stubGlobal('localStorage', localStorageStub);
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('mail-key-store (indexeddb mode)', () => {
    it('stores keys newest first, deduplicated, as non-extractable CryptoKeys', async () => {
        const address = uniqueAddress();
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(store.keyStoreMode.value).toBe('indexeddb');
        const first = await generateKeyPair();
        const second = await generateKeyPair();
        const before = store.getKeyStoreVersion();
        await store.addPrivateKey(address, first.privateKey);
        await store.addPrivateKey(address, second.privateKey);
        const duplicate = await store.addPrivateKey(address, first.privateKey);
        expect(duplicate.publicKey).toBe(first.publicKey);

        const keys = store.getPrivateKeys(address);
        expect(keys).toHaveLength(2);
        expect(keys[0] instanceof CryptoKey).toBe(true);
        for (const key of keys) {
            expect(key.extractable).toBe(false);
            await expect(crypto.subtle.exportKey('pkcs8', key)).rejects.toThrow();
        }
        const records = store.getKeyRecords(address);
        expect(records.map((record) => record.publicKey)).toEqual([second.publicKey, first.publicKey]);
        expect(records[0].wrappedBackup).toBeNull();
        expect(store.hasPrivateKey(address)).toBe(true);
        expect(store.getKeyStoreVersion()).toBeGreaterThan(before);
        expect(store.getPrivateKey(address)).toBe(keys[0]);
        expect(store.getPrivateKey(uniqueAddress())).toBeNull();
    });

    it('decrypts mail with a stored CryptoKey (round trip)', async () => {
        const address = uniqueAddress();
        const { store } = await freshModules();
        await store.initKeyStore();
        const keyPair = await generateKeyPair();
        await store.addPrivateKey(address, keyPair.privateKey);
        const envelope = await encryptMail(keyPair.publicKey, 'secret mime', { gzip: false });
        const plaintext = await decryptMail(store.getPrivateKeys(address)[0], envelope);
        expect(plaintext).toBe('secret mime');
    });

    it('accepts an existing non-extractable CryptoKey with the publicKey option', async () => {
        const address = uniqueAddress();
        const { store } = await freshModules();
        await store.initKeyStore();
        const keyPair = await generateKeyPair();
        const cryptoKey = await importPrivateKeyNonExtractable(keyPair.privateKey);
        const record = await store.addPrivateKey(address, cryptoKey, { publicKey: keyPair.publicKey });
        expect(record.publicKey).toBe(keyPair.publicKey);
        expect(store.getPrivateKeys(address)[0]).toBe(cryptoKey);
        // Without the public key it cannot be stored (public material cannot
        // be derived from a non-extractable key).
        const other = await generateKeyPair();
        expect(await store.addPrivateKey(address, await importPrivateKeyNonExtractable(other.privateKey)))
            .toBeNull();
    });

    it('rejects invalid key material without storing anything', async () => {
        const address = uniqueAddress();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(await store.addPrivateKey(address, 'not-a-key')).toBeNull();
        expect(await store.addPrivateKey(address, '')).toBeNull();
        expect(store.getPrivateKeys(address)).toEqual([]);
        expect(warn.mock.calls.flat().join(' ')).not.toContain('not-a-key');
    });

    it('persists records across a reload (fresh init) and removePrivateKeys deletes durably', async () => {
        const address = uniqueAddress();
        const other = uniqueAddress();
        const first = await generateKeyPair();
        const second = await generateKeyPair();
        let store = (await freshModules()).store;
        await store.initKeyStore();
        await store.addPrivateKey(address, first.privateKey);
        await store.addPrivateKey(other, second.privateKey);

        store = (await freshModules()).store;
        await store.initKeyStore();
        expect(store.getKeyRecords(address).map((r) => r.publicKey)).toEqual([first.publicKey]);
        expect(store.getKeyRecords(other).map((r) => r.publicKey)).toEqual([second.publicKey]);
        // stored keys remain non-extractable after reload
        expect(store.getPrivateKeys(address)[0].extractable).toBe(false);

        await store.removePrivateKeys(address);
        expect(store.getPrivateKeys(address)).toEqual([]);
        expect(store.getPrivateKeys(other)).toHaveLength(1);

        store = (await freshModules()).store;
        await store.initKeyStore();
        expect(store.getPrivateKeys(address)).toEqual([]);
        expect(store.getPrivateKeys(other)).toHaveLength(1);
    });

    it('persists wrapped backups across a reload and exposes accessors', async () => {
        const address = uniqueAddress();
        const { store } = await freshModules();
        await store.initKeyStore();
        const keyPair = await generateKeyPair();
        const record = await store.addPrivateKey(address, keyPair.privateKey);
        expect(record.wrappedBackup).toBeNull();
        expect(store.getWrappedBackup(address)).toBeNull();
        expect(store.hasWrappedBackup(address)).toBe(false);

        const updated = await store.setWrappedBackup(address, keyPair.publicKey, 'blob-value');
        expect(updated.wrappedBackup).toBe('blob-value');
        expect(store.getWrappedBackup(address)).toBe('blob-value');
        expect(store.hasWrappedBackup(address)).toBe(true);
        // unknown public key / unknown address: no-op
        expect(await store.setWrappedBackup(address, 'unknown-pub', 'x')).toBeNull();
        expect(await store.setWrappedBackup(uniqueAddress(), keyPair.publicKey, 'x')).toBeNull();
        expect(await store.setWrappedBackup(address, keyPair.publicKey, '')).toBeNull();

        const reloaded = (await freshModules()).store;
        await reloaded.initKeyStore();
        expect(reloaded.getWrappedBackup(address)).toBe('blob-value');
        expect(reloaded.hasWrappedBackup(address)).toBe(true);
    });

    it('attaches a supplied wrapped backup when addPrivateKey hits a duplicate without one', async () => {
        const address = uniqueAddress();
        const { store } = await freshModules();
        await store.initKeyStore();
        const keyPair = await generateKeyPair();
        await store.addPrivateKey(address, keyPair.privateKey);
        const duplicate = await store.addPrivateKey(address, keyPair.privateKey, { wrappedBackup: 'blob-1' });
        expect(duplicate.publicKey).toBe(keyPair.publicKey);
        expect(duplicate.wrappedBackup).toBe('blob-1');
        expect(store.getWrappedBackup(address)).toBe('blob-1');
        // an existing backup is never overwritten by a duplicate import
        const kept = await store.addPrivateKey(address, keyPair.privateKey, { wrappedBackup: 'blob-2' });
        expect(kept.wrappedBackup).toBe('blob-1');
    });

    it('falls back to memory mode when a later write fails, keeping the session key', async () => {
        const address = uniqueAddress();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const { store } = await freshModules();
        await store.initKeyStore();
        // sabotage subsequent write transactions only
        const realTransaction = IDBDatabase.prototype.transaction;
        vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (name, mode) {
            if (mode === 'readwrite') throw new Error('quota exceeded');
            return realTransaction.call(this, name, mode);
        });
        const keyPair = await generateKeyPair();
        const record = await store.addPrivateKey(address, keyPair.privateKey);
        expect(record).not.toBeNull();
        expect(store.keyStoreMode.value).toBe('memory');
        expect(store.getPrivateKeys(address)).toHaveLength(1);
        expect(warn).toHaveBeenCalled();
    });
});

describe('mail-key-store legacy localStorage migration', () => {
    it('imports legacy entries (array and single string), keeps the plaintext and flags the pending choice', async () => {
        const address = uniqueAddress();
        const other = uniqueAddress();
        const first = await generateKeyPair();
        const second = await generateKeyPair();
        const otherKey = await generateKeyPair();
        storageMap.set('mailPrivateKeys', JSON.stringify({
            [address]: [first.privateKey, second.privateKey],
            [other]: otherKey.privateKey, // legacy single-string shape
        }));
        const { store } = await freshModules();
        await store.initKeyStore();

        // The plaintext copy now stays until the user answers the one-time
        // backup prompt (legacyMigrationPending); keys are already usable.
        expect(storageMap.has('mailPrivateKeys')).toBe(true);
        expect(store.legacyMigrationPending.value).toBe(true);
        expect(store.legacyPlaintextKeysRetained.value).toBe(false);
        expect(store.getKeyRecords(address).map((r) => r.publicKey))
            .toEqual([first.publicKey, second.publicKey]);
        expect(store.getKeyRecords(other).map((r) => r.publicKey)).toEqual([otherKey.publicKey]);
        // keys are usable after migration
        const envelope = await encryptMail(first.publicKey, 'migrated body', { gzip: false });
        expect(await decryptMail(store.getPrivateKeys(address)[0], envelope)).toBe('migrated body');

        // and they survive a reload; the pending choice is still flagged
        const reloaded = (await freshModules()).store;
        await reloaded.initKeyStore();
        expect(reloaded.getKeyRecords(address)).toHaveLength(2);
        expect(reloaded.legacyMigrationPending.value).toBe(true);
        expect(storageMap.has('mailPrivateKeys')).toBe(true);
    });

    it('drops invalid legacy keys with a warning that never includes key material', async () => {
        const address = uniqueAddress();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const key = await generateKeyPair();
        storageMap.set('mailPrivateKeys', JSON.stringify({ [address]: ['garbage', key.privateKey] }));
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(store.getKeyRecords(address).map((r) => r.publicKey)).toEqual([key.publicKey]);
        // valid key was durably written and verified; plaintext is kept
        // pending the user's choice
        expect(storageMap.has('mailPrivateKeys')).toBe(true);
        expect(store.legacyMigrationPending.value).toBe(true);
        const logged = warn.mock.calls.flat().join(' ');
        expect(logged).not.toContain('garbage');
        expect(logged).not.toContain(key.privateKey);
    });

    it('completeLegacyMigration wraps every key, deletes the plaintext and stores verifiable blobs', async () => {
        const address = uniqueAddress();
        const other = uniqueAddress();
        const first = await generateKeyPair();
        const second = await generateKeyPair();
        const otherKey = await generateKeyPair();
        storageMap.set('mailPrivateKeys', JSON.stringify({
            [address]: [first.privateKey, second.privateKey],
            [other]: otherKey.privateKey,
        }));
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(store.legacyMigrationPending.value).toBe(true);

        const passphrase = 'correct horse battery staple';
        await store.completeLegacyMigration({ passphrase });

        expect(storageMap.has('mailPrivateKeys')).toBe(false);
        expect(store.legacyMigrationPending.value).toBe(false);
        const { unwrapPrivateKey } = await import('../key-backup');
        const { publicKeyFromPrivate } = await import('../mail-crypto');
        const checkBlobs = async (addr, keys) => {
            const records = store.getKeyRecords(addr);
            expect(records).toHaveLength(keys.length);
            for (const key of keys) {
                const record = records.find((r) => r.publicKey === key.publicKey);
                expect(typeof record.wrappedBackup).toBe('string');
                const raw = await unwrapPrivateKey({
                    blob: record.wrappedBackup, address: addr, passphrase,
                });
                expect(await publicKeyFromPrivate(raw)).toBe(key.publicKey);
            }
        };
        await checkBlobs(address, [first, second]);
        await checkBlobs(other, [otherKey]);

        // completion is durable across a reload
        const reloaded = (await freshModules()).store;
        await reloaded.initKeyStore();
        expect(reloaded.legacyMigrationPending.value).toBe(false);
        expect(reloaded.hasWrappedBackup(address)).toBe(true);
        expect(reloaded.hasWrappedBackup(other)).toBe(true);
    });

    it('completeLegacyMigration rejects a short passphrase and keeps the plaintext', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        storageMap.set('mailPrivateKeys', JSON.stringify({ [address]: [key.privateKey] }));
        const { store } = await freshModules();
        await store.initKeyStore();
        await expect(store.completeLegacyMigration({ passphrase: 'short' })).rejects.toThrow();
        expect(storageMap.has('mailPrivateKeys')).toBe(true);
        expect(store.legacyMigrationPending.value).toBe(true);
        expect(store.hasWrappedBackup(address)).toBe(false);
    });

    it('completeLegacyMigration is a safe no-op when nothing is pending or localStorage is gone', async () => {
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(store.legacyMigrationPending.value).toBe(false);
        await expect(store.completeLegacyMigration({ passphrase: 'correct horse battery staple' }))
            .resolves.toBeUndefined();
        // pending but entry vanished
        storageMap.set('mailPrivateKeys', JSON.stringify({}));
        store.legacyMigrationPending.value = true;
        await store.completeLegacyMigration({ passphrase: 'correct horse battery staple' });
        expect(store.legacyMigrationPending.value).toBe(false);
    });

    it('discardLegacyPlaintext deletes the plaintext without wrapping and clears the flag', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        storageMap.set('mailPrivateKeys', JSON.stringify({ [address]: [key.privateKey] }));
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(store.legacyMigrationPending.value).toBe(true);

        store.discardLegacyPlaintext();

        expect(storageMap.has('mailPrivateKeys')).toBe(false);
        expect(store.legacyMigrationPending.value).toBe(false);
        expect(store.hasWrappedBackup(address)).toBe(false);
        // keys remain usable
        expect(store.getKeyRecords(address)).toHaveLength(1);
    });

    it('keeps the plaintext copy and flags retention when IndexedDB is unavailable (memory mode)', async () => {
        const address = uniqueAddress();
        const key = await generateKeyPair();
        storageMap.set('mailPrivateKeys', JSON.stringify({ [address]: [key.privateKey] }));
        vi.stubGlobal('indexedDB', undefined);
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(store.keyStoreMode.value).toBe('memory');
        expect(store.legacyPlaintextKeysRetained.value).toBe(true);
        expect(store.legacyMigrationPending.value).toBe(false);
        // keys are imported for this session...
        expect(store.getKeyRecords(address).map((r) => r.publicKey)).toEqual([key.publicKey]);
        expect(store.getPrivateKeys(address)[0].extractable).toBe(false);
        // ...but the plaintext copy remains (it is the user's only durable copy)
        expect(storageMap.has('mailPrivateKeys')).toBe(true);
        // completion is a safe no-op in memory mode (no migration is pending):
        // blobs would die with the session, so the plaintext must survive
        await expect(store.completeLegacyMigration({ passphrase: 'correct horse battery staple' }))
            .resolves.toBeUndefined();
        expect(storageMap.has('mailPrivateKeys')).toBe(true);
        expect(store.hasWrappedBackup(address)).toBe(false);
    });

    it('falls back to memory mode when IndexedDB open fails', async () => {
        const address = uniqueAddress();
        vi.stubGlobal('indexedDB', { open: () => { throw new Error('idb blocked') } });
        const { store } = await freshModules();
        await store.initKeyStore();
        expect(store.keyStoreMode.value).toBe('memory');
        const keyPair = await generateKeyPair();
        const record = await store.addPrivateKey(address, keyPair.privateKey);
        expect(record.publicKey).toBe(keyPair.publicKey);
        expect(store.getPrivateKeys(address)).toHaveLength(1);
    });
});

describe('mail-fragment parsing', () => {
    it('parses a bare hash and a full URL', async () => {
        const { fragment } = await freshModules();
        expect(fragment.parseDecryptionFragment('#k=abc&a=x%40y.z')).toEqual({ key: 'abc', address: 'x@y.z' });
        expect(fragment.parseDecryptionFragment('https://m.example/?jwt=t#k=abc&a=x'))
            .toEqual({ key: 'abc', address: 'x' });
    });

    it('rejects malformed input', async () => {
        const { fragment } = await freshModules();
        expect(fragment.parseDecryptionFragment('')).toBeNull();
        expect(fragment.parseDecryptionFragment('#a=only-address')).toBeNull();
        expect(fragment.parseDecryptionFragment('#k=only-key')).toBeNull();
        expect(fragment.parseDecryptionFragment('no-hash-here')).toBeNull();
    });

    it('validates key material', async () => {
        const { fragment } = await freshModules();
        const key = await generateKeyPair();
        expect(await fragment.isValidPrivateKey(key.privateKey)).toBe(true);
        expect(await fragment.isValidPrivateKey('not-a-key')).toBe(false);
        expect(await fragment.isValidPrivateKey('')).toBe(false);
    });

    it('imports a pasted decryption link as a non-extractable key', async () => {
        const address = uniqueAddress();
        const { store, fragment } = await freshModules();
        const key = await generateKeyPair();
        const link = `https://m.example/#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent(address)}`;
        const result = await fragment.importKeyOrLink(link);
        expect(result).toEqual({ ok: true, address });
        const records = store.getKeyRecords(address);
        expect(records[0].publicKey).toBe(key.publicKey);
        expect(records[0].privateKey instanceof CryptoKey).toBe(true);
        expect(records[0].privateKey.extractable).toBe(false);
    });

    it('imports a bare key with a fallback address', async () => {
        const address = uniqueAddress();
        const { store, fragment } = await freshModules();
        const key = await generateKeyPair();
        const result = await fragment.importKeyOrLink(key.privateKey, address);
        expect(result).toEqual({ ok: true, address });
        expect(store.getKeyRecords(address)[0].publicKey).toBe(key.publicKey);
    });

    it('rejects an invalid key or link without storing anything', async () => {
        const address = uniqueAddress();
        const { store, fragment } = await freshModules();
        expect(await fragment.importKeyOrLink('garbage', address)).toEqual({ ok: false, address: '' });
        expect(await fragment.importKeyOrLink(`https://m.example/#k=garbage&a=${encodeURIComponent(address)}`))
            .toEqual({ ok: false, address });
        expect(store.getPrivateKeys(address)).toEqual([]);
    });
});

describe('mail-fragment ingestion from location', () => {
    const stubLocation = (hash) => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { hash, pathname: '/en/', search: '?jwt=token' },
            history: { replaceState },
        });
        return replaceState;
    };

    it('ingests a valid fragment and strips it preserving path+search', async () => {
        const address = uniqueAddress();
        const { store, fragment } = await freshModules();
        const key = await generateKeyPair();
        const replaceState = stubLocation(`#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent(address)}`);
        const stored = await fragment.ingestDecryptionFragmentFromLocation();
        expect(stored).toBe(address);
        expect(store.getKeyRecords(address)[0].publicKey).toBe(key.publicKey);
        expect(store.getPrivateKeys(address)[0] instanceof CryptoKey).toBe(true);
        expect(replaceState).toHaveBeenCalledWith(null, '', '/en/?jwt=token');
    });

    it('rejects an invalid fragment silently-ish and still strips it', async () => {
        const address = uniqueAddress();
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const { store, fragment } = await freshModules();
        const replaceState = stubLocation(`#k=garbage&a=${encodeURIComponent(address)}`);
        const stored = await fragment.ingestDecryptionFragmentFromLocation();
        expect(stored).toBeNull();
        expect(store.getPrivateKeys(address)).toEqual([]);
        expect(replaceState).toHaveBeenCalled();
        // the key material must never be logged
        expect(warn.mock.calls.flat().join(' ')).not.toContain('garbage');
    });

    it('does nothing when there is no fragment', async () => {
        const { fragment } = await freshModules();
        const replaceState = stubLocation('');
        expect(await fragment.ingestDecryptionFragmentFromLocation()).toBeNull();
        expect(replaceState).not.toHaveBeenCalled();
    });
});

describe('stripDecryptionFragment', () => {
    it('removes a decryption fragment from a hash or full path', async () => {
        const { fragment } = await freshModules();
        const key = await generateKeyPair();
        const hash = `#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent('strip@example.com')}`;
        expect(fragment.stripDecryptionFragment(hash)).toBe('');
        expect(fragment.stripDecryptionFragment(`/en/?jwt=token${hash}`)).toBe('/en/?jwt=token');
    });

    it('keeps hashes and paths without a decryption fragment untouched', async () => {
        const { fragment } = await freshModules();
        expect(fragment.stripDecryptionFragment('#section')).toBe('#section');
        expect(fragment.stripDecryptionFragment('/en/?x=1#section')).toBe('/en/?x=1#section');
        expect(fragment.stripDecryptionFragment('/en/?x=1')).toBe('/en/?x=1');
        expect(fragment.stripDecryptionFragment('')).toBe('');
        expect(fragment.stripDecryptionFragment('#k=only-key')).toBe('#k=only-key');
    });
});

describe('store constants', () => {
    it('exposes the IndexedDB layout used by the browser e2e spec', async () => {
        const { store } = await freshModules();
        expect(store.KEY_STORE_DB_NAME).toBe(DB_NAME);
        expect(store.KEY_STORE_DB_VERSION).toBe(1);
        expect(store.KEY_STORE_OBJECT_STORE).toBe('keys');
    });
});
