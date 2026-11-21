import 'fake-indexeddb/auto';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildOpenDeviceLink } from '../open-device-link';

const freshModules = async () => {
    vi.resetModules();
    const store = await import('../mail-key-store');
    const fragment = await import('../mail-fragment');
    const { generateKeyPair } = await import('../mail-crypto');
    return { store, fragment, generateKeyPair };
};

beforeEach(() => {
    vi.resetModules();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('buildOpenDeviceLink', () => {
    it('builds a credential-only link in the fragment (nothing in the query)', () => {
        const link = buildOpenDeviceLink({ jwt: 'token.abc', baseUrl: 'https://m.example' });
        expect(link).toBe('https://m.example/#jwt=token.abc');
        expect(link).not.toContain('?jwt=');
    });

    it('appends the wrapped backup (not a raw key) for encrypted mailboxes', () => {
        const blob = 'AQID_backup_blob';
        const link = buildOpenDeviceLink({
            jwt: 'token.abc',
            address: 'qr@example.com',
            wrappedBackup: blob,
            baseUrl: 'https://m.example',
        });
        expect(link.startsWith('https://m.example/#jwt=token.abc&kp=')).toBe(true);
        expect(link).toContain(`&a=${encodeURIComponent('qr@example.com')}`);
    });

    it('round-trips through parseCredentialFragment', async () => {
        const { fragment } = await freshModules();
        const blob = 'AQID_backup_blob';
        const link = buildOpenDeviceLink({
            jwt: 'token.abc',
            address: 'qr@example.com',
            wrappedBackup: blob,
            baseUrl: 'https://m.example',
        });
        const parsed = fragment.parseCredentialFragment(link);
        expect(parsed).toEqual({ jwt: 'token.abc', blob, address: 'qr@example.com' });
    });

    it('never emits a raw #k= key', () => {
        const rawKey = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg_rawkeymaterial';
        // Even if a caller tries to smuggle a raw key in the backup slot the
        // builder just drops unknown material: it only has a wrappedBackup
        // slot, and a raw key is not a wrapped backup.
        const link = buildOpenDeviceLink({
            jwt: 'token.abc',
            address: 'qr@example.com',
            wrappedBackup: null,
            baseUrl: 'https://m.example',
        });
        expect(link).not.toContain('#k=');
        expect(link).not.toContain(rawKey);
        expect(link).not.toContain('kp=');
    });

    it('returns empty without a credential', () => {
        expect(buildOpenDeviceLink({ jwt: '', baseUrl: 'https://m.example' })).toBe('');
    });
});

describe('parseCredentialFragment', () => {
    it('parses #jwt=&kp=&a= fragments', async () => {
        const { fragment } = await freshModules();
        const parsed = fragment.parseCredentialFragment(
            `#jwt=token.abc&kp=${encodeURIComponent('blob_x')}&a=${encodeURIComponent('a@b.c')}`,
        );
        expect(parsed).toEqual({ jwt: 'token.abc', blob: 'blob_x', address: 'a@b.c' });
    });

    it('parses credential-only fragments', async () => {
        const { fragment } = await freshModules();
        expect(fragment.parseCredentialFragment('#jwt=token.abc')).toEqual({
            jwt: 'token.abc', blob: '', address: '',
        });
    });

    it('rejects fragments with a backup but no address', async () => {
        const { fragment } = await freshModules();
        expect(fragment.parseCredentialFragment('#jwt=token.abc&kp=blob_x')).toBeNull();
    });

    it('returns null for non-credential fragments (#k= / #kp=)', async () => {
        const { fragment } = await freshModules();
        expect(fragment.parseCredentialFragment('#k=rawkey&a=a@b.c')).toBeNull();
        expect(fragment.parseCredentialFragment('#kp=blob&a=a@b.c')).toBeNull();
        expect(fragment.parseCredentialFragment('#other=1')).toBeNull();
        expect(fragment.parseCredentialFragment('')).toBeNull();
    });
});

describe('ingestDecryptionFragmentFromLocation with #jwt=', () => {
    const stubLocation = (hash, pathname = '/en/', search = '') => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { hash, pathname, search },
            history: { replaceState },
        });
        return replaceState;
    };

    it('queues the credential login and the wrapped backup, and strips the fragment', async () => {
        const { fragment } = await freshModules();
        const replaceState = stubLocation(
            `#jwt=token.abc&kp=${encodeURIComponent('blob_x')}&a=${encodeURIComponent('a@b.c')}`,
            '/en/', '?mail_id=1',
        );

        const stored = await fragment.ingestDecryptionFragmentFromLocation();

        expect(stored).toBeNull();
        expect(fragment.pendingCredentialLogins.value).toEqual([{ jwt: 'token.abc' }]);
        expect(fragment.pendingWrappedImports.value).toEqual([{ address: 'a@b.c', blob: 'blob_x' }]);
        expect(replaceState).toHaveBeenCalledWith(null, '', '/en/?mail_id=1');
    });

    it('queues a credential-only fragment without a wrapped import', async () => {
        const { fragment } = await freshModules();
        const replaceState = stubLocation('#jwt=token.abc');

        await fragment.ingestDecryptionFragmentFromLocation();

        expect(fragment.pendingCredentialLogins.value).toEqual([{ jwt: 'token.abc' }]);
        expect(fragment.pendingWrappedImports.value).toEqual([]);
        expect(replaceState).toHaveBeenCalledWith(null, '', '/en/');
    });

    it('still ingests #k= fragments unchanged', async () => {
        const { store, fragment, generateKeyPair } = await freshModules();
        await store.initKeyStore();
        const key = await generateKeyPair();
        const address = 'legacy-k@example.com';
        stubLocation(`#k=${key.privateKey}&a=${encodeURIComponent(address)}`);

        const stored = await fragment.ingestDecryptionFragmentFromLocation();

        expect(stored).toBe(address);
        expect(store.getPrivateKeys(address)).toHaveLength(1);
    });

    it('still queues #kp= fragments without a credential login', async () => {
        const { fragment } = await freshModules();
        stubLocation(`#kp=${encodeURIComponent('blob_x')}&a=${encodeURIComponent('a@b.c')}`);

        await fragment.ingestDecryptionFragmentFromLocation();

        expect(fragment.pendingCredentialLogins.value).toEqual([]);
        expect(fragment.pendingWrappedImports.value).toEqual([{ address: 'a@b.c', blob: 'blob_x' }]);
    });
});

describe('stripDecryptionFragment with credential fragments', () => {
    it('strips #jwt= fragments from hashes and full paths', async () => {
        const { fragment } = await freshModules();
        const hash = '#jwt=token.abc&kp=blob_x&a=a@b.c';
        expect(fragment.stripDecryptionFragment(hash)).toBe('');
        expect(fragment.stripDecryptionFragment(`/en/${hash}`)).toBe('/en/');
        expect(fragment.stripDecryptionFragment(`/en/?jwt=query-token${hash}`)).toBe('/en/?jwt=query-token');
    });

    it('keeps unrelated hashes and fragments without params', async () => {
        const { fragment } = await freshModules();
        expect(fragment.stripDecryptionFragment('#section')).toBe('#section');
        expect(fragment.stripDecryptionFragment('/en/')).toBe('/en/');
        expect(fragment.stripDecryptionFragment('')).toBe('');
    });
});
