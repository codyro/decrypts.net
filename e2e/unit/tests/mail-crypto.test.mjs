import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

// Worker-side crypto util: load the TypeScript source like statistics.test.mjs does,
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

const frontendCrypto = await import('../../../frontend/src/utils/mail-crypto.js');

const SAMPLE_MAIL = [
    'From: sender@example.com',
    'To: user@test.com',
    'Subject: Round trip test',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Hello, this is a test mail body.',
    'Unicode: 你好世界 🌍 — àéîõü — ΑαΒβΓγ',
].join('\r\n');

const LARGE_MAIL = `${SAMPLE_MAIL}\r\n${'Large payload line with some repeated text for compression. '.repeat(20000)}`; // ~1.3MB

test('round-trip without gzip', async () => {
    const workerCrypto = await loadWorkerCrypto();
    const { publicKey, privateKey } = await frontendCrypto.generateKeyPair();
    const envelope = await workerCrypto.encryptMail(publicKey, SAMPLE_MAIL, { gzip: false });
    assert.ok(envelope.startsWith('cfte1.'));
    assert.ok(workerCrypto.isEncryptedRaw(envelope));
    assert.ok(frontendCrypto.isEncryptedRaw(envelope));
    assert.equal(await frontendCrypto.decryptMail(privateKey, envelope), SAMPLE_MAIL);
});

test('round-trip with gzip flag', async () => {
    const workerCrypto = await loadWorkerCrypto();
    const { publicKey, privateKey } = await frontendCrypto.generateKeyPair();
    const envelope = await workerCrypto.encryptMail(publicKey, SAMPLE_MAIL, { gzip: true });
    assert.ok(envelope.startsWith('cfte1.'));
    assert.equal(await frontendCrypto.decryptMail(privateKey, envelope), SAMPLE_MAIL);
});

test('large ~1MB payload round-trips with and without gzip', async t => {
    const workerCrypto = await loadWorkerCrypto();
    assert.ok(LARGE_MAIL.length > 1000 * 1000, 'payload should be at least 1MB');
    for (const gzip of [false, true]) {
        await t.test(`gzip=${gzip}`, async () => {
            const { publicKey, privateKey } = await frontendCrypto.generateKeyPair();
            const envelope = await workerCrypto.encryptMail(publicKey, LARGE_MAIL, { gzip });
            assert.equal(await frontendCrypto.decryptMail(privateKey, envelope), LARGE_MAIL);
        });
    }
});

test('tampered ciphertext fails to decrypt', async () => {
    const workerCrypto = await loadWorkerCrypto();
    const { publicKey, privateKey } = await frontendCrypto.generateKeyPair();
    const envelope = await workerCrypto.encryptMail(publicKey, SAMPLE_MAIL, { gzip: false });
    const bytes = frontendCrypto.base64UrlToBytes(envelope.slice('cfte1.'.length));
    bytes[bytes.length - 1] ^= 0x01;
    const tampered = `cfte1.${frontendCrypto.bytesToBase64Url(bytes)}`;
    await assert.rejects(() => frontendCrypto.decryptMail(privateKey, tampered), /wrong key or tampered/);
});

test('decrypting with the wrong key fails', async () => {
    const workerCrypto = await loadWorkerCrypto();
    const { publicKey } = await frontendCrypto.generateKeyPair();
    const other = await frontendCrypto.generateKeyPair();
    const envelope = await workerCrypto.encryptMail(publicKey, SAMPLE_MAIL, { gzip: false });
    await assert.rejects(() => frontendCrypto.decryptMail(other.privateKey, envelope), /wrong key or tampered/);
});

test('publicKeyFromPrivate matches the generated public key', async () => {
    const { publicKey, privateKey } = await frontendCrypto.generateKeyPair();
    assert.equal(await frontendCrypto.publicKeyFromPrivate(privateKey), publicKey);
});

test('validatePublicKey accepts generated keys and rejects invalid input', async () => {
    const workerCrypto = await loadWorkerCrypto();
    const { publicKey } = await frontendCrypto.generateKeyPair();
    assert.equal(await workerCrypto.validatePublicKey(publicKey), true);
    assert.equal(await workerCrypto.validatePublicKey(null), false);
    assert.equal(await workerCrypto.validatePublicKey(123), false);
    assert.equal(await workerCrypto.validatePublicKey(''), false);
    assert.equal(await workerCrypto.validatePublicKey('not-base64url!!'), false);
    assert.equal(await workerCrypto.validatePublicKey('aGVsbG8'), false); // "hello" - wrong length
    // valid base64url of 65 bytes but not a curve point (first byte 0x00)
    const badPoint = `cfte1.${frontendCrypto.bytesToBase64Url(new Uint8Array(65))}`;
    assert.equal(await workerCrypto.validatePublicKey(badPoint.slice('cfte1.'.length)), false);
});

test('isEncryptedRaw only matches the envelope prefix', async () => {
    assert.equal(frontendCrypto.isEncryptedRaw('cfte1.abc'), true);
    assert.equal(frontendCrypto.isEncryptedRaw('cfte1xabc'), false);
    assert.equal(frontendCrypto.isEncryptedRaw('From: a@b.c\r\n'), false);
    assert.equal(frontendCrypto.isEncryptedRaw(null), false);
    assert.equal(frontendCrypto.isEncryptedRaw(undefined), false);
});

test('decryptMail rejects non-envelope input and bad private keys', async () => {
    const { privateKey } = await frontendCrypto.generateKeyPair();
    await assert.rejects(() => frontendCrypto.decryptMail(privateKey, SAMPLE_MAIL), /Not an encrypted mail envelope/);
    await assert.rejects(() => frontendCrypto.decryptMail('garbage-key', 'cfte1.aaaa'), /bad private key|Invalid|Failed/);
});
