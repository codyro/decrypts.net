import { test, expect } from '@playwright/test';
import http from 'node:http';
import {
  generateKeyPair, decryptMail, bytesToBase64Url, base64UrlToBytes,
} from '../../../frontend/src/utils/mail-crypto.js';
import {
  WORKER_URL, WORKER_URL_ENV_OFF, WORKER_GZIP_URL, TEST_DOMAIN,
  createTestAddress, deleteAddress, seedTestMail,
} from '../../fixtures/test-helpers';

/**
 * "Encrypt existing mail" endpoints (P1b). The browser lists its plaintext
 * rows via GET /api/encrypt_existing/pending, encrypts each raw to the
 * address public key and uploads only the envelope via
 * POST /api/encrypt_existing. The server never sees keys, never stores
 * anything but a strictly validated "cfte1." envelope, and never
 * overwrites an already-encrypted row.
 */

const ENC_PREFIX = 'cfte1.';
const HKDF_INFO = 'cf-temp-email/mail-encryption/v1';

/** Encrypt raw UTF-8 content into a "cfte1." envelope (flag byte 0), exactly
 * like the browser-side mail-crypto util (which has no encrypt export). */
async function encryptMailFor(publicKeyB64u: string, raw: string): Promise<string> {
  const recipientKey = await crypto.subtle.importKey(
    'raw', base64UrlToBytes(publicKeyB64u) as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const ephPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey }, eph.privateKey, 256);
  const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveBits']);
  const aesBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', salt: ephPub as BufferSource, info: new TextEncoder().encode(HKDF_INFO), hash: 'SHA-256' },
    hkdfKey, 256);
  const aesKey = await crypto.subtle.importKey('raw', aesBits, 'AES-GCM', false, ['encrypt']);
  const content = new TextEncoder().encode(raw);
  const plaintext = new Uint8Array(1 + content.length);
  plaintext[0] = 0;
  plaintext.set(content, 1);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: new TextEncoder().encode('cfte1') },
    aesKey, plaintext as BufferSource));
  const envelope = new Uint8Array(65 + 12 + ciphertext.length);
  envelope.set(ephPub, 0);
  envelope.set(iv, 65);
  envelope.set(ciphertext, 77);
  return ENC_PREFIX + bytesToBase64Url(envelope);
}

async function savePublicKey(ctx: any, workerUrl: string, jwt: string, publicKey: string) {
  const res = await ctx.post(`${workerUrl}/api/address_encryption`, {
    headers: { Authorization: `Bearer ${jwt}` },
    data: { publicKey },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function seedPlaintextMail(ctx: any, address: string, marker: string) {
  const raw = [
    'From: sender@test.example.com',
    `To: ${address}`,
    `Subject: ${marker}`,
    `Message-ID: <${marker}@test>`,
    '',
    `body of ${marker}`,
  ].join('\r\n');
  const res = await ctx.post(`${WORKER_URL}/__test/seed_mail`, {
    data: { address, source: 'sender@test.example.com', raw, message_id: `<${marker}@test>` },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function getPending(ctx: any, jwt: string, query: Record<string, string> = {}) {
  const res = await ctx.get(`${WORKER_URL}/api/encrypt_existing/pending`, {
    headers: { Authorization: `Bearer ${jwt}` },
    params: query,
  });
  return res;
}

async function postEncrypt(ctx: any, jwt: string, body: unknown) {
  return ctx.post(`${WORKER_URL}/api/encrypt_existing`, {
    headers: { Authorization: `Bearer ${jwt}` },
    data: body,
  });
}

async function getMails(ctx: any, jwt: string): Promise<any[]> {
  const res = await ctx.get(`${WORKER_URL}/api/mails?limit=50&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(res.ok()).toBe(true);
  const { results } = await res.json();
  return results;
}

async function queryRows(ctx: any, sql: string): Promise<any[]> {
  const res = await ctx.get(`${WORKER_URL}/__test/query`, { params: { sql } });
  expect(res.ok(), await res.text()).toBe(true);
  const { results } = await res.json();
  return results;
}

test.describe('Encrypt existing mail (P1b)', () => {
  test('feature disabled => 400 on both endpoints', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'WORKER_URL_ENV_OFF not set');
    const { jwt } = await createTestAddress(request, 'encx-off', TEST_DOMAIN, WORKER_URL_ENV_OFF);
    const auth = { Authorization: `Bearer ${jwt}` };
    const pending = await request.get(`${WORKER_URL_ENV_OFF}/api/encrypt_existing/pending`, {
      headers: auth, params: { box: 'inbox' },
    });
    expect(pending.status()).toBe(400);
    const upload = await request.post(`${WORKER_URL_ENV_OFF}/api/encrypt_existing`, {
      headers: auth,
      data: { box: 'inbox', items: [{ id: 1, raw: 'cfte1.abc' }] },
    });
    expect(upload.status()).toBe(400);
  });

  test('address without a public key => 400 on both endpoints', async ({ request }) => {
    const { jwt } = await createTestAddress(request, 'encx-nokey');
    try {
      const pending = await getPending(request, jwt);
      expect(pending.status()).toBe(400);
      const upload = await postEncrypt(request, jwt, { box: 'inbox', items: [{ id: 1, raw: 'cfte1.abc' }] });
      expect(upload.status()).toBe(400);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('missing or invalid JWT => 401', async ({ request }) => {
    const noAuth = await request.get(`${WORKER_URL}/api/encrypt_existing/pending?box=inbox`);
    expect(noAuth.status()).toBe(401);
    const badAuth = await request.get(`${WORKER_URL}/api/encrypt_existing/pending?box=inbox`, {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    expect(badAuth.status()).toBe(401);
    const badPost = await request.post(`${WORKER_URL}/api/encrypt_existing`, {
      headers: { Authorization: 'Bearer not-a-jwt' },
      data: { box: 'inbox', items: [] },
    });
    expect(badPost.status()).toBe(401);
  });

  test('invalid box / limit / items => 400', async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const { jwt } = await createTestAddress(request, 'encx-badreq');
    try {
      await savePublicKey(request, WORKER_URL, jwt, publicKey);
      expect((await getPending(request, jwt, { box: 'bogus' })).status()).toBe(400);
      expect((await getPending(request, jwt, { limit: '0' })).status()).toBe(400);
      expect((await getPending(request, jwt, { limit: '51' })).status()).toBe(400);
      expect((await getPending(request, jwt, { after_id: '-1' })).status()).toBe(400);
      expect((await postEncrypt(request, jwt, { box: 'bogus', items: [{ id: 1, raw: 'x' }] })).status()).toBe(400);
      expect((await postEncrypt(request, jwt, { box: 'inbox', items: [] })).status()).toBe(400);
      expect((await postEncrypt(request, jwt, { box: 'inbox', items: 'nope' })).status()).toBe(400);
      const tooMany = {
        box: 'inbox',
        items: Array.from({ length: 51 }, (_, i) => ({ id: i + 1, raw: 'cfte1.abc' })),
      };
      expect((await postEncrypt(request, jwt, tooMany)).status()).toBe(400);
      expect((await postEncrypt(request, jwt, { box: 'inbox', items: [{ id: 'x', raw: 'cfte1.abc' }] })).status()).toBe(400);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('pending lists only plaintext rows, paged by after_id, remaining counts all plaintext', async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const { jwt, address } = await createTestAddress(request, 'encx-pending');
    try {
      await seedPlaintextMail(request, address, `pending-a-${Date.now()}`);
      await seedPlaintextMail(request, address, `pending-b-${Date.now()}`);
      await seedPlaintextMail(request, address, `pending-c-${Date.now()}`);
      await savePublicKey(request, WORKER_URL, jwt, publicKey);
      // an encrypted row (stored via the normal receive path) must not appear
      await seedTestMail(request, address, { subject: `pending-enc-${Date.now()}`, text: 'encrypted one' });

      const page1 = await getPending(request, jwt, { limit: '2' });
      expect(page1.ok()).toBe(true);
      const body1 = await page1.json();
      expect(body1.publicKey).toBe(publicKey);
      expect(body1.remaining).toBe(3);
      expect(body1.results).toHaveLength(2);
      expect(body1.results[0].id).toBeLessThan(body1.results[1].id);

      const page2 = await getPending(request, jwt, { after_id: String(body1.results[1].id) });
      const body2 = await page2.json();
      expect(body2.remaining).toBe(3);
      expect(body2.results).toHaveLength(1);

      const all = [...body1.results, ...body2.results];
      const subjects = all.map((r: any) => r.raw).join('\n');
      expect(subjects).toContain('pending-a-');
      expect(subjects).toContain('pending-b-');
      expect(subjects).toContain('pending-c-');
      expect(subjects).not.toContain('pending-enc-');
      expect(all.every((r: any) => !r.raw.startsWith(ENC_PREFIX))).toBe(true);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('uploading valid envelopes replaces raw, sets flags, clears metadata, decrypts back', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { jwt, address } = await createTestAddress(request, 'encx-upload');
    const marker = `upload-${Date.now()}`;
    try {
      await seedPlaintextMail(request, address, marker);
      await savePublicKey(request, WORKER_URL, jwt, publicKey);

      const pending = await getPending(request, jwt);
      const { results } = await pending.json();
      expect(results).toHaveLength(1);
      const row = results[0];
      const envelope = await encryptMailFor(publicKey, row.raw);

      const res = await postEncrypt(request, jwt, { box: 'inbox', items: [{ id: row.id, raw: envelope }] });
      expect(res.ok(), await res.text()).toBe(true);
      expect(await res.json()).toEqual({ success: true, encrypted: [row.id], skipped: [] });

      // at rest: envelope in raw, flag set, blob cleared, metadata hardened
      const rows = await queryRows(request,
        `SELECT raw, source, message_id, is_encrypted, raw_blob FROM raw_mails WHERE id = ${row.id}`);
      expect(rows).toHaveLength(1);
      expect(rows[0].raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(rows[0].is_encrypted).toBe(1);
      expect(rows[0].source).toBe('');
      expect(rows[0].message_id).toBeNull();
      expect(rows[0].raw_blob).toBeNull();

      // via the API the envelope is returned flagged as encrypted
      const mails = await getMails(request, jwt);
      expect(mails[0].raw).toBe(envelope);
      expect(mails[0].is_encrypted).toBe(1);

      // the envelope really encrypts the original raw for this key
      const decrypted = await decryptMail(privateKey, envelope);
      expect(decrypted).toContain(`Subject: ${marker}`);
      expect(decrypted).toContain(`body of ${marker}`);

      // nothing left to encrypt
      const after = await getPending(request, jwt);
      expect((await after.json()).remaining).toBe(0);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('invalid envelopes are skipped per item and the stored row stays unchanged', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { jwt, address } = await createTestAddress(request, 'encx-invalid');
    const marker = `invalid-${Date.now()}`;
    try {
      await seedPlaintextMail(request, address, marker);
      await savePublicKey(request, WORKER_URL, jwt, publicKey);
      const { results } = await (await getPending(request, jwt)).json();
      const id = results[0].id;

      // also create a genuinely valid envelope to prove it still succeeds
      // while its neighbours are skipped
      const good = await encryptMailFor(publicKey, results[0].raw);
      const res = await postEncrypt(request, jwt, {
        box: 'inbox',
        items: [
          { id, raw: 'this is plaintext, not an envelope' },       // wrong prefix
          { id, raw: 'cfte1.!!!not-base64url!!!' },                // bad charset
          { id, raw: 'cfte1.AQID' },                               // decoded too short
          { id, raw: `xxxxx.${good.slice(ENC_PREFIX.length)}` },   // wrong prefix, valid body
          { id, raw: good },                                       // valid
        ],
      });
      expect(res.ok(), await res.text()).toBe(true);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.encrypted).toEqual([id]);
      expect(body.skipped).toEqual([
        { id, reason: 'invalid_envelope' },
        { id, reason: 'invalid_envelope' },
        { id, reason: 'invalid_envelope' },
        { id, reason: 'invalid_envelope' },
      ]);

      const rows = await queryRows(request,
        `SELECT raw, is_encrypted, source FROM raw_mails WHERE id = ${id}`);
      expect(rows[0].raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(rows[0].is_encrypted).toBe(1);
      expect(rows[0].source).toBe('');
      const decrypted = await decryptMail(privateKey, rows[0].raw);
      expect(decrypted).toContain(`Subject: ${marker}`);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('an already-encrypted row is never overwritten', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { jwt, address } = await createTestAddress(request, 'encx-nooverwrite');
    const subject = `no-overwrite-${Date.now()}`;
    try {
      await savePublicKey(request, WORKER_URL, jwt, publicKey);
      await seedTestMail(request, address, { subject, text: 'already encrypted body' });
      const mails = await getMails(request, jwt);
      expect(mails).toHaveLength(1);
      const id = mails[0].id;
      expect(mails[0].raw.startsWith(ENC_PREFIX)).toBe(true);

      const otherRaw = 'From: a@b\r\n\r\ntrying to overwrite';
      const res = await postEncrypt(request, jwt, {
        box: 'inbox',
        items: [{ id, raw: await encryptMailFor(publicKey, otherRaw) }],
      });
      expect(res.ok(), await res.text()).toBe(true);
      const body = await res.json();
      expect(body.encrypted).toEqual([]);
      expect(body.skipped).toEqual([{ id, reason: 'already_encrypted' }]);

      const rows = await queryRows(request, `SELECT raw FROM raw_mails WHERE id = ${id}`);
      const decrypted = await decryptMail(privateKey, rows[0].raw);
      expect(decrypted).toContain(`Subject: ${subject}`);
      expect(decrypted).not.toContain('trying to overwrite');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test("cannot touch another address's row", async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const a = await createTestAddress(request, 'encx-addr-a');
    const b = await createTestAddress(request, 'encx-addr-b');
    const marker = `other-${Date.now()}`;
    try {
      await seedPlaintextMail(request, a.address, marker);
      await seedPlaintextMail(request, b.address, marker);
      await savePublicKey(request, WORKER_URL, a.jwt, publicKey);
      await savePublicKey(request, WORKER_URL, b.jwt, publicKey);

      const bPending = await getPending(request, b.jwt);
      const bId = (await bPending.json()).results[0].id;

      const res = await postEncrypt(request, a.jwt, {
        box: 'inbox',
        items: [{ id: bId, raw: await encryptMailFor(publicKey, 'attacker content') }],
      });
      expect(res.ok(), await res.text()).toBe(true);
      const body = await res.json();
      expect(body.encrypted).toEqual([]);
      expect(body.skipped).toEqual([{ id: bId, reason: 'not_found' }]);

      // b's row is untouched and still listed as plaintext
      const bRows = await queryRows(request,
        `SELECT raw, is_encrypted FROM raw_mails WHERE id = ${bId}`);
      expect(bRows[0].is_encrypted).toBe(0);
      expect(bRows[0].raw).toContain(`Subject: ${marker}`);
    } finally {
      await deleteAddress(request, a.jwt);
      await deleteAddress(request, b.jwt);
    }
  });

  test('sendbox box works end to end', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { jwt, address } = await createTestAddress(request, 'encx-sendbox');
    const subject = `sendbox-${Date.now()}`;
    try {
      // send before setting the key so the sendbox row is plaintext
      const sendRes = await request.post(`${WORKER_URL}/api/send_mail`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          from_name: '', from_mail: address,
          to_name: '', to_mail: `recipient-${Date.now()}@test.example.com`,
          subject, content: 'sendbox body', is_html: false,
        },
      });
      expect(sendRes.ok(), await sendRes.text()).toBe(true);
      await savePublicKey(request, WORKER_URL, jwt, publicKey);

      const pending = await getPending(request, jwt, { box: 'sendbox' });
      expect(pending.ok(), await pending.text()).toBe(true);
      const { publicKey: returnedKey, remaining, results } = await pending.json();
      expect(returnedKey).toBe(publicKey);
      expect(remaining).toBe(1);
      expect(results).toHaveLength(1);
      expect(results[0].raw).toContain(subject);

      const envelope = await encryptMailFor(publicKey, results[0].raw);
      const res = await postEncrypt(request, jwt, { box: 'sendbox', items: [{ id: results[0].id, raw: envelope }] });
      expect(res.ok(), await res.text()).toBe(true);
      expect(await res.json()).toEqual({ success: true, encrypted: [results[0].id], skipped: [] });

      const sendbox = await request.get(`${WORKER_URL}/api/sendbox?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const { results: sendboxRows } = await sendbox.json();
      expect(sendboxRows).toHaveLength(1);
      expect(sendboxRows[0].raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(sendboxRows[0].is_encrypted).toBe(1);
      const decrypted = await decryptMail(privateKey, sendboxRows[0].raw);
      expect(decrypted).toContain(subject);
      expect(decrypted).toContain('sendbox body');

      expect((await (await getPending(request, jwt, { box: 'sendbox' })).json()).remaining).toBe(0);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('gzip raw_blob plaintext row is resolved, encrypted, and raw_blob cleared', async ({ request }) => {
    test.skip(!WORKER_GZIP_URL, 'WORKER_GZIP_URL not set');
    const { publicKey, privateKey } = await generateKeyPair();
    const uniqueName = `encx-gzip${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const createRes = await request.post(`${WORKER_GZIP_URL}/api/new_address`, {
      data: { name: uniqueName, domain: TEST_DOMAIN },
    });
    expect(createRes.ok(), await createRes.text()).toBe(true);
    const { jwt, address } = await createRes.json();
    const auth = { Authorization: `Bearer ${jwt}` };
    const subject = `gzip-pending-${Date.now()}`;

    try {
      // receive BEFORE setting the key: stored gzipped in raw_blob as plaintext
      const raw = [
        'From: sender@test.example.com',
        `To: ${address}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'gzip plaintext body',
      ].join('\r\n');
      const recv = await request.post(`${WORKER_GZIP_URL}/__test/receive_mail`, {
        data: { from: `sender@${TEST_DOMAIN}`, to: address, raw },
      });
      expect(recv.ok(), await recv.text()).toBe(true);

      const keyRes = await request.post(`${WORKER_GZIP_URL}/api/address_encryption`, {
        headers: auth, data: { publicKey },
      });
      expect(keyRes.ok(), await keyRes.text()).toBe(true);

      const stored = await request.get(`${WORKER_GZIP_URL}/__test/query`, {
        params: { sql: `SELECT id, raw_blob, is_encrypted FROM raw_mails WHERE address = '${address}'` },
      });
      const storedRows = (await stored.json()).results;
      expect(storedRows).toHaveLength(1);
      expect(storedRows[0].raw_blob).toBeTruthy();
      expect(storedRows[0].is_encrypted).toBe(0);
      const mailId = storedRows[0].id;

      // pending resolves the gzipped row to plaintext
      const pending = await request.get(`${WORKER_GZIP_URL}/api/encrypt_existing/pending`, {
        headers: auth, params: { box: 'inbox' },
      });
      expect(pending.ok(), await pending.text()).toBe(true);
      const pendingBody = await pending.json();
      expect(pendingBody.remaining).toBe(1);
      expect(pendingBody.results).toHaveLength(1);
      expect(pendingBody.results[0].id).toBe(mailId);
      expect(pendingBody.results[0].raw).toContain(subject);
      expect(pendingBody.results[0].raw).toContain('gzip plaintext body');

      const envelope = await encryptMailFor(publicKey, pendingBody.results[0].raw);
      const upload = await request.post(`${WORKER_GZIP_URL}/api/encrypt_existing`, {
        headers: auth,
        data: { box: 'inbox', items: [{ id: mailId, raw: envelope }] },
      });
      expect(upload.ok(), await upload.text()).toBe(true);

      const after = await request.get(`${WORKER_GZIP_URL}/__test/query`, {
        params: { sql: `SELECT raw, raw_blob, is_encrypted FROM raw_mails WHERE id = ${mailId}` },
      });
      const afterRow = (await after.json()).results[0];
      expect(afterRow.raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(afterRow.is_encrypted).toBe(1);
      expect(afterRow.raw_blob).toBeNull();
      const decrypted = await decryptMail(privateKey, afterRow.raw);
      expect(decrypted).toContain(subject);
    } finally {
      await request.delete(`${WORKER_GZIP_URL}/api/delete_address`, { headers: auth });
    }
  });

  test('parsed and webhook endpoints never parse envelopes', async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const { jwt, address } = await createTestAddress(request, 'encx-locked');
    const subject = `locked-${Date.now()}`;
    const received: { body: string }[] = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        received.push({ body: Buffer.concat(chunks).toString('utf-8') });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    const webhookUrl = `http://${process.env.CI ? 'e2e-runner' : 'localhost'}:${addr.port}/hook`;
    try {
      await seedPlaintextMail(request, address, subject);
      await savePublicKey(request, WORKER_URL, jwt, publicKey);
      const { results } = await (await getPending(request, jwt)).json();
      const id = results[0].id;
      const envelope = await encryptMailFor(publicKey, results[0].raw);
      const res = await postEncrypt(request, jwt, { box: 'inbox', items: [{ id, raw: envelope }] });
      expect(res.ok(), await res.text()).toBe(true);

      // parsed endpoints return the placeholder, not parser output
      const parsed = await request.get(`${WORKER_URL}/api/parsed_mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}`, 'x-lang': 'en' },
      });
      const { results: parsedRows } = await parsed.json();
      expect(parsedRows[0].encrypted).toBe(true);
      expect(parsedRows[0].subject).toBe('[Encrypted mail]');

      // webhook test-send succeeds with placeholder fields (never parses)
      const testSend = await request.post(`${WORKER_URL}/api/webhook/test`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true, url: webhookUrl, method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ subject: '${subject}', from: '${from}' }),
          mail_id: id,
        },
      });
      expect(testSend.ok(), await testSend.text()).toBe(true);
      expect(received).toHaveLength(1);
      const payload = JSON.parse(received[0].body);
      // placeholder values, not envelope-derived content
      expect(payload.subject).toBe('test subject');
      expect(payload.from).toBe('test@test.com');

      // webhook filter check keeps the existing locked behaviour for envelopes:
      // a field-requiring filter cannot be evaluated without parsing and fails
      const checkFilter = await request.post(`${WORKER_URL}/api/webhook/check_filter`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          filter: { operator: 'contains', field: 'subject', value: 'x' },
          mail_id: id,
        },
      });
      expect(checkFilter.status()).toBe(400);
    } finally {
      server.close();
      await deleteAddress(request, jwt);
    }
  });
});
