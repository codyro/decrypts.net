import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPair, decryptMail, MAIL_ENCRYPTION_PREFIX } from '../mail-crypto';

const apiFetch = vi.fn();

vi.mock('../../api', () => ({
    api: { fetch: (...args) => apiFetch(...args) },
}));

const { encryptExistingMail } = await import('../encrypt-existing');

beforeEach(() => {
    apiFetch.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** Simulate the server: pending returns plaintext rows, POST accepts envelopes. */
const setupServer = async (inboxRows, sendboxRows) => {
    const keyPair = await generateKeyPair();
    const state = { inbox: [...inboxRows], sendbox: [...sendboxRows] };
    apiFetch.mockImplementation(async (path, options = {}) => {
        if (path.startsWith('/api/encrypt_existing/pending')) {
            const url = new URL(`https://x${path}`);
            const box = url.searchParams.get('box');
            const afterId = Number(url.searchParams.get('after_id'));
            // emulate the server-side plaintext filter: encrypted rows are
            // never returned by pending
            const results = state[box]
                .filter((row) => row.id > afterId && !row.raw.startsWith(MAIL_ENCRYPTION_PREFIX));
            return { publicKey: keyPair.publicKey, remaining: results.length, results };
        }
        if (path === '/api/encrypt_existing') {
            const body = JSON.parse(options.body);
            const encrypted = [];
            const skipped = [];
            for (const item of body.items) {
                if (item.raw.startsWith(MAIL_ENCRYPTION_PREFIX)) {
                    state[body.box] = state[body.box].map((row) => row.id === item.id ? { ...row, raw: item.raw } : row);
                    encrypted.push(item.id);
                } else {
                    skipped.push({ id: item.id, reason: 'invalid_envelope' });
                }
            }
            return { success: true, encrypted, skipped };
        }
        throw new Error(`unexpected request: ${path}`);
    });
    return state;
};

describe('encryptExistingMail', () => {
    it('encrypts and uploads only envelopes for inbox and sendbox', async () => {
        const keyPair = await generateKeyPair();
        apiFetch.mockImplementation(async (path, options = {}) => {
            if (path.startsWith('/api/encrypt_existing/pending')) {
                const url = new URL(`https://x${path}`);
                const box = url.searchParams.get('box');
                const afterId = Number(url.searchParams.get('after_id'));
                const all = box === 'inbox'
                    ? [{ id: 1, raw: 'inbox one' }, { id: 2, raw: 'inbox two' }]
                    : [{ id: 5, raw: '{"version":"v2"}' }];
                const results = all.filter((row) => row.id > afterId);
                return { publicKey: keyPair.publicKey, remaining: results.length, results };
            }
            if (path === '/api/encrypt_existing') {
                const body = JSON.parse(options.body);
                return { success: true, encrypted: body.items.map((i) => i.id), skipped: [] };
            }
            throw new Error(`unexpected request: ${path}`);
        });
        const progress = [];
        const totals = await encryptExistingMail({
            onProgress: (p) => progress.push(p),
        });
        expect(totals).toEqual({ encrypted: 3, skipped: 0 });
        // every uploaded raw was a well-formed envelope decryptable with the key
        const posts = apiFetch.mock.calls.filter(([path]) => path === '/api/encrypt_existing');
        expect(posts.length).toBe(2);
        for (const [, options] of posts) {
            const body = JSON.parse(options.body);
            expect(['inbox', 'sendbox']).toContain(body.box);
            for (const item of body.items) {
                expect(item.raw.startsWith(MAIL_ENCRYPTION_PREFIX)).toBe(true);
                const plaintext = await decryptMail(keyPair.privateKey, item.raw);
                expect(typeof plaintext).toBe('string');
            }
        }
        expect(progress.length).toBeGreaterThan(0);
    });

    it('respects the box filter', async () => {
        await setupServer([{ id: 1, raw: 'inbox one' }], [{ id: 5, raw: 'send one' }]);
        const totals = await encryptExistingMail({ box: 'sendbox' });
        expect(totals).toEqual({ encrypted: 1, skipped: 0 });
        const posts = apiFetch.mock.calls.filter(([path]) => path === '/api/encrypt_existing');
        expect(posts.every(([, options]) => JSON.parse(options.body).box === 'sendbox')).toBe(true);
    });

    it('is resumable: rows already encrypted are skipped on the next run', async () => {
        const state = await setupServer([{ id: 1, raw: 'inbox one' }], []);
        const first = await encryptExistingMail({ box: 'inbox' });
        expect(first).toEqual({ encrypted: 1, skipped: 0 });
        // server state now holds an envelope; the plaintext filter excludes it
        const second = await encryptExistingMail({ box: 'inbox' });
        expect(second).toEqual({ encrypted: 0, skipped: 0 });
        expect(state.inbox[0].raw.startsWith(MAIL_ENCRYPTION_PREFIX)).toBe(true);
    });

    it('propagates request failures instead of swallowing them', async () => {
        apiFetch.mockRejectedValue(new Error('network down'));
        await expect(encryptExistingMail({ box: 'inbox' })).rejects.toThrow('network down');
    });

    it('stops cleanly when the signal is aborted', async () => {
        await setupServer([{ id: 1, raw: 'inbox one' }], []);
        const controller = new AbortController();
        controller.abort();
        await expect(encryptExistingMail({ box: 'inbox', signal: controller.signal }))
            .rejects.toMatchObject({ name: 'AbortError' });
        expect(apiFetch).not.toHaveBeenCalled();
    });

    it('stops before uploading when the server key matches no local key', async () => {
        const server = await generateKeyPair();
        const other = await generateKeyPair();
        apiFetch.mockImplementation(async (path) => {
            if (path.startsWith('/api/encrypt_existing/pending')) {
                return { publicKey: server.publicKey, remaining: 1, results: [{ id: 1, raw: 'Subject: a\r\n\r\nbody' }] };
            }
            throw new Error(`unexpected request: ${path}`);
        });
        const { EncryptExistingKeyMismatchError } = await import('../encrypt-existing');
        await expect(encryptExistingMail({ box: 'inbox', expectedPublicKeys: [other.publicKey] }))
            .rejects.toBeInstanceOf(EncryptExistingKeyMismatchError);
        expect(apiFetch.mock.calls.every(([path]) => !path.startsWith('/api/encrypt_existing') || path.includes('pending'))).toBe(true);
    });
});
