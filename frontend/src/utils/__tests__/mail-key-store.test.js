import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { generateKeyPair } from '../mail-crypto';
import {
    mailPrivateKeys, getPrivateKey, getPrivateKeys, setPrivateKey, removePrivateKey,
    hasPrivateKey, buildDecryptionLink, getKeyStoreVersion,
} from '../mail-key-store';
import {
    parseDecryptionFragment, importKeyOrLink, isValidPrivateKey,
    ingestDecryptionFragmentFromLocation, stripDecryptionFragment,
} from '../mail-fragment';

const ADDRESS = 'test@example.com';
const OTHER = 'other@example.com';

beforeEach(() => {
    mailPrivateKeys.value = {};
});

describe('mail-key-store', () => {
    it('stores the newest key first and deduplicates', async () => {
        const first = await generateKeyPair();
        const second = await generateKeyPair();
        setPrivateKey(ADDRESS, first.privateKey);
        setPrivateKey(ADDRESS, second.privateKey);
        setPrivateKey(ADDRESS, first.privateKey);
        expect(getPrivateKey(ADDRESS)).toBe(first.privateKey);
        expect(getPrivateKeys(ADDRESS)).toEqual([first.privateKey, second.privateKey]);
        expect(hasPrivateKey(ADDRESS)).toBe(true);
    });

    it('returns empty results for unknown addresses', () => {
        expect(getPrivateKey('nobody@example.com')).toBeNull();
        expect(getPrivateKeys('')).toEqual([]);
        expect(hasPrivateKey('')).toBe(false);
    });

    it('keeps keys per address independent', async () => {
        const key = await generateKeyPair();
        setPrivateKey(ADDRESS, key.privateKey);
        expect(getPrivateKeys(OTHER)).toEqual([]);
        expect(getPrivateKeys(ADDRESS)).toHaveLength(1);
    });

    it('removePrivateKey removes only the given address', async () => {
        const a = await generateKeyPair();
        const b = await generateKeyPair();
        const before = getKeyStoreVersion();
        setPrivateKey(ADDRESS, a.privateKey);
        setPrivateKey(OTHER, b.privateKey);
        removePrivateKey(ADDRESS);
        expect(getPrivateKeys(ADDRESS)).toEqual([]);
        expect(getPrivateKeys(OTHER)).toEqual([b.privateKey]);
        expect(getKeyStoreVersion()).toBeGreaterThan(before);
    });

    it('normalizes a legacy single-string value into an array', async () => {
        const key = await generateKeyPair();
        mailPrivateKeys.value = { [ADDRESS]: key.privateKey };
        expect(getPrivateKeys(ADDRESS)).toEqual([key.privateKey]);
    });

    it('builds a decryption link containing key and address', async () => {
        const key = await generateKeyPair();
        setPrivateKey(ADDRESS, key.privateKey);
        const link = buildDecryptionLink(ADDRESS, 'https://mail.example.com');
        expect(link.startsWith('https://mail.example.com/#k=')).toBe(true);
        expect(link.endsWith(`&a=${encodeURIComponent(ADDRESS)}`)).toBe(true);
        const parsed = parseDecryptionFragment(link);
        expect(parsed.key).toBe(key.privateKey);
        expect(parsed.address).toBe(ADDRESS);
    });

    it('returns an empty decryption link when no key is stored', () => {
        expect(buildDecryptionLink('missing@example.com', 'https://mail.example.com')).toBe('');
    });
});

describe('mail-fragment parsing', () => {
    it('parses a bare hash and a full URL', () => {
        expect(parseDecryptionFragment('#k=abc&a=x%40y.z')).toEqual({ key: 'abc', address: 'x@y.z' });
        expect(parseDecryptionFragment('https://m.example/?jwt=t#k=abc&a=x'))
            .toEqual({ key: 'abc', address: 'x' });
    });

    it('rejects malformed input', () => {
        expect(parseDecryptionFragment('')).toBeNull();
        expect(parseDecryptionFragment('#a=only-address')).toBeNull();
        expect(parseDecryptionFragment('#k=only-key')).toBeNull();
        expect(parseDecryptionFragment('no-hash-here')).toBeNull();
    });

    it('validates key material', async () => {
        const key = await generateKeyPair();
        expect(await isValidPrivateKey(key.privateKey)).toBe(true);
        expect(await isValidPrivateKey('not-a-key')).toBe(false);
        expect(await isValidPrivateKey('')).toBe(false);
    });

    it('imports a pasted decryption link', async () => {
        const key = await generateKeyPair();
        const link = `https://m.example/#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent(ADDRESS)}`;
        const result = await importKeyOrLink(link);
        expect(result).toEqual({ ok: true, address: ADDRESS });
        expect(getPrivateKey(ADDRESS)).toBe(key.privateKey);
    });

    it('imports a bare key with a fallback address', async () => {
        const key = await generateKeyPair();
        const result = await importKeyOrLink(key.privateKey, OTHER);
        expect(result).toEqual({ ok: true, address: OTHER });
        expect(getPrivateKey(OTHER)).toBe(key.privateKey);
    });

    it('rejects an invalid key or link without storing anything', async () => {
        expect(await importKeyOrLink('garbage', ADDRESS)).toEqual({ ok: false, address: '' });
        expect(await importKeyOrLink(`https://m.example/#k=garbage&a=${encodeURIComponent(ADDRESS)}`))
            .toEqual({ ok: false, address: ADDRESS });
        expect(getPrivateKeys(ADDRESS)).toEqual([]);
    });
});

describe('mail-fragment ingestion from location', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const stubLocation = (hash) => {
        const replaceState = vi.fn();
        vi.stubGlobal('window', {
            location: { hash, pathname: '/en/', search: '?jwt=token' },
            history: { replaceState },
        });
        return replaceState;
    };

    it('ingests a valid fragment and strips it preserving path+search', async () => {
        const key = await generateKeyPair();
        const replaceState = stubLocation(`#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent(ADDRESS)}`);
        const stored = await ingestDecryptionFragmentFromLocation();
        expect(stored).toBe(ADDRESS);
        expect(getPrivateKey(ADDRESS)).toBe(key.privateKey);
        expect(replaceState).toHaveBeenCalledWith(null, '', '/en/?jwt=token');
    });

    it('rejects an invalid fragment silently-ish and still strips it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => { });
        const replaceState = stubLocation(`#k=garbage&a=${encodeURIComponent(ADDRESS)}`);
        const stored = await ingestDecryptionFragmentFromLocation();
        expect(stored).toBeNull();
        expect(getPrivateKeys(ADDRESS)).toEqual([]);
        expect(replaceState).toHaveBeenCalled();
        // the key material must never be logged
        expect(warn.mock.calls.flat().join(' ')).not.toContain('garbage');
    });

    it('does nothing when there is no fragment', async () => {
        const replaceState = stubLocation('');
        expect(await ingestDecryptionFragmentFromLocation()).toBeNull();
        expect(replaceState).not.toHaveBeenCalled();
    });
});

describe('stripDecryptionFragment', () => {
    it('removes a decryption fragment from a hash or full path', async () => {
        const key = await generateKeyPair();
        const hash = `#k=${encodeURIComponent(key.privateKey)}&a=${encodeURIComponent(ADDRESS)}`;
        expect(stripDecryptionFragment(hash)).toBe('');
        expect(stripDecryptionFragment(`/en/?jwt=token${hash}`)).toBe('/en/?jwt=token');
    });

    it('keeps hashes and paths without a decryption fragment untouched', () => {
        expect(stripDecryptionFragment('#section')).toBe('#section');
        expect(stripDecryptionFragment('/en/?x=1#section')).toBe('/en/?x=1#section');
        expect(stripDecryptionFragment('/en/?x=1')).toBe('/en/?x=1');
        expect(stripDecryptionFragment('')).toBe('');
        expect(stripDecryptionFragment('#k=only-key')).toBe('#k=only-key');
    });
});
