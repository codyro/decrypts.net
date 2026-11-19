import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

// Worker-side crypto util: load the TypeScript source like mail-crypto.test.mjs does,
// providing the one external helper (compressText from worker/src/gzip.ts) it imports.
const workerCryptoUrl = new URL('../../../worker/src/utils/mail_crypto.ts', import.meta.url);
const loadWorkerCrypto = async () => {
    const source = `const compressText = async (text) => {
            const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
            return new Response(stream).arrayBuffer();
        };
        ${readFileSync(workerCryptoUrl, 'utf8').replace(/^import .*\n/gm, '')}`;
    return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
};

const PLAIN_RAW = 'From: sender@example.com\r\nTo: user@test.com\r\n\r\nbody';

test('isEncryptedMailRow: explicit flag is authoritative on migrated rows', async () => {
    const { isEncryptedMailRow, MAIL_ENCRYPTION_PREFIX } = await loadWorkerCrypto();
    const envelope = MAIL_ENCRYPTION_PREFIX + 'abc';

    // flag present and set: encrypted even regardless of the raw value
    assert.equal(isEncryptedMailRow({ is_encrypted: 1, raw: 'anything' }), true);
    // flag present and clear: NOT encrypted even when raw carries the prefix
    // (sender-controlled plaintext on a migrated database)
    assert.equal(isEncryptedMailRow({ is_encrypted: 0, raw: envelope }), false);
    // flag present with other falsy values
    assert.equal(isEncryptedMailRow({ is_encrypted: 0, raw: PLAIN_RAW }), false);
    assert.equal(isEncryptedMailRow({ is_encrypted: null, raw: envelope }), false);
});

test('isEncryptedMailRow: un-migrated rows fall back to the envelope prefix', async () => {
    const { isEncryptedMailRow, MAIL_ENCRYPTION_PREFIX } = await loadWorkerCrypto();
    const envelope = MAIL_ENCRYPTION_PREFIX + 'abc';

    // no is_encrypted property at all (un-migrated database)
    assert.equal(isEncryptedMailRow({ raw: envelope }), true);
    assert.equal(isEncryptedMailRow({ raw: PLAIN_RAW }), false);
    // missing/null row or raw
    assert.equal(isEncryptedMailRow(null), false);
    assert.equal(isEncryptedMailRow(undefined), false);
    assert.equal(isEncryptedMailRow({}), false);
    assert.equal(isEncryptedMailRow({ raw: null }), false);
});
