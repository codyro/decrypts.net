import { test, expect } from '@playwright/test';
import http from 'node:http';
import { generateKeyPair, decryptMail } from '../../../frontend/src/utils/mail-crypto.js';
import { WORKER_URL, TEST_DOMAIN, createTestAddress, deleteAddress, seedTestMail } from '../../fixtures/test-helpers';

/**
 * These tests run against the default worker instance with
 * ENABLE_MAIL_ENCRYPTION=true. They verify per-mailbox encryption of stored
 * mail: the worker stores only a "cfte1." envelope of the raw MIME, the
 * parsed endpoints return placeholders, and decryption happens client-side
 * with the private key (frontend/src/utils/mail-crypto.js, importable in Node).
 */

const ENC_PREFIX = 'cfte1.';

async function createAddressWithKey(
  ctx: any,
  name: string,
  encryptionPublicKey?: string,
): Promise<{ jwt: string; address: string }> {
  const uniqueName = `${name}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const res = await ctx.post(`${WORKER_URL}/api/new_address`, {
    data: {
      name: uniqueName,
      domain: TEST_DOMAIN,
      ...(encryptionPublicKey ? { encryption_public_key: encryptionPublicKey } : {}),
    },
  });
  if (!res.ok()) throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return { jwt: body.jwt, address: body.address };
}

async function getMails(ctx: any, jwt: string): Promise<any[]> {
  const res = await ctx.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(res.ok()).toBe(true);
  const { results } = await res.json();
  return results;
}

/**
 * Start a temporary HTTP server that records all incoming requests.
 */
async function startWebhookReceiver(): Promise<{
  server: http.Server;
  requests: Promise<{ body: string }>[];
  url: string;
}> {
  const requests: Promise<{ body: string }>[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      requests.push(Promise.resolve({ body: Buffer.concat(chunks).toString('utf-8') }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to resolve webhook receiver port');
  const hostname = process.env.CI ? 'e2e-runner' : 'localhost';
  return { server, requests, url: `http://${hostname}:${addr.port}/webhook` };
}

test.describe('Mailbox encryption (ENABLE_MAIL_ENCRYPTION)', () => {
  test('open settings expose enableMailEncryption and GET /api/address_encryption returns enabled with no key', async ({ request }) => {
    const settingsRes = await request.get(`${WORKER_URL}/open_api/settings`);
    expect(settingsRes.ok()).toBe(true);
    expect((await settingsRes.json()).enableMailEncryption).toBe(true);

    const { jwt } = await createAddressWithKey(request, 'enc-status');
    try {
      const res = await request.get(`${WORKER_URL}/api/address_encryption`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(res.ok()).toBe(true);
      expect(await res.json()).toEqual({ enabled: true, publicKey: null });
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('rejects invalid public key, accepts a valid P-256 key, and returns it on GET', async ({ request }) => {
    const { jwt } = await createAddressWithKey(request, 'enc-key');
    try {
      const auth = { Authorization: `Bearer ${jwt}` };

      const invalidRes = await request.post(`${WORKER_URL}/api/address_encryption`, {
        headers: auth,
        data: { publicKey: 'not-a-valid-key' },
      });
      expect(invalidRes.status()).toBe(400);

      const { publicKey, privateKey } = await generateKeyPair();
      expect(privateKey.length).toBeGreaterThan(0);

      const saveRes = await request.post(`${WORKER_URL}/api/address_encryption`, {
        headers: auth,
        data: { publicKey },
      });
      expect(saveRes.ok()).toBe(true);
      expect((await saveRes.json()).publicKey).toBe(publicKey);

      const getRes = await request.get(`${WORKER_URL}/api/address_encryption`, {
        headers: auth,
      });
      expect(await getRes.json()).toEqual({ enabled: true, publicKey });
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('new_address validates encryption_public_key', async ({ request }) => {
    const badRes = await request.post(`${WORKER_URL}/api/new_address`, {
      data: {
        name: `enc-bad-key${Date.now()}`,
        domain: TEST_DOMAIN,
        encryption_public_key: 'AAAA',
      },
    });
    expect(badRes.status()).toBe(400);
  });

  test('mail to an encrypted address is stored as a cfte1. envelope and decrypts to the original MIME', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { jwt, address } = await createAddressWithKey(request, 'enc-store', publicKey);
    const subject = `Encrypted Subject ${Date.now()}`;
    const body = 'secret body that must never be stored in plaintext';
    try {
      await seedTestMail(request, address, { subject, text: body });

      const results = await getMails(request, jwt);
      expect(results).toHaveLength(1);
      const raw: string = results[0].raw;
      expect(raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(raw).not.toContain(subject);
      expect(raw).not.toContain(body);

      const decrypted = await decryptMail(privateKey, raw);
      expect(decrypted).toContain(`Subject: ${subject}`);
      expect(decrypted).toContain(body);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('parsed_mails returns an encrypted placeholder for encrypted mail', async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const { jwt, address } = await createAddressWithKey(request, 'enc-parsed', publicKey);
    const subject = `Parsed Placeholder ${Date.now()}`;
    try {
      await seedTestMail(request, address, { subject, text: 'placeholder check body' });

      const res = await request.get(`${WORKER_URL}/api/parsed_mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}`, 'x-lang': 'en' },
      });
      expect(res.ok()).toBe(true);
      const { results } = await res.json();
      expect(results).toHaveLength(1);
      expect(results[0].encrypted).toBe(true);
      expect(results[0].subject).toBe('[Encrypted mail]');
      expect(results[0].text).toBe('');
      expect(results[0].html).toBe('');
      expect(results[0].attachments).toEqual([]);
      // plaintext metadata is replaced by placeholders; the real sender and
      // Message-ID live inside the encrypted MIME headers
      expect(results[0].source).toBe('');
      expect(results[0].message_id).toBeNull();
      expect(results[0].is_encrypted).toBe(1);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('encrypted rows store placeholder source/message_id and is_encrypted=1 at rest', async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const { jwt, address } = await createAddressWithKey(request, 'enc-meta', publicKey);
    const subject = `Metadata Placeholder ${Date.now()}`;
    try {
      await seedTestMail(request, address, { subject, text: 'metadata placeholder body' });

      const res = await request.get(`${WORKER_URL}/__test/query`, {
        params: { sql: `SELECT source, message_id, is_encrypted, substr(raw, 1, 6) AS raw_prefix FROM raw_mails WHERE address = '${address}'` },
      });
      expect(res.ok(), await res.text()).toBe(true);
      const { results } = await res.json();
      expect(results).toHaveLength(1);
      expect(results[0].is_encrypted).toBe(1);
      expect(results[0].raw_prefix).toBe('cfte1.');
      expect(results[0].source).toBe('');
      expect(results[0].message_id).toBeNull();

      // /api/mails exposes the flag as well
      const mails = await getMails(request, jwt);
      expect(mails[0].is_encrypted).toBe(1);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('plaintext address rows keep is_encrypted=0', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'enc-plainflag');
    try {
      await seedTestMail(request, address, { subject: `Plain Flag ${Date.now()}`, text: 'plain body' });

      const mails = await getMails(request, jwt);
      expect(mails).toHaveLength(1);
      expect(mails[0].is_encrypted).toBe(0);
      expect(mails[0].source).toContain('sender@test.example.com');
      expect(mails[0].message_id).toContain('@test');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('sender-controlled plaintext starting with cfte1. is NOT treated as encrypted on a migrated DB', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'enc-prefix');
    const fakeEnvelope = 'cfte1. dGhpcyBpcyBubyBlbnZlbG9wZSBhdCBhbGw';
    try {
      // Direct insert through the test fixture (bypasses the email handler)
      // so the stored raw really starts with the envelope prefix.
      const seedRes = await request.post(`${WORKER_URL}/__test/seed_mail`, {
        data: { address, source: 'sender@test.example.com', raw: fakeEnvelope },
      });
      expect(seedRes.ok(), await seedRes.text()).toBe(true);

      const mails = await getMails(request, jwt);
      expect(mails).toHaveLength(1);
      expect(mails[0].raw.startsWith('cfte1.')).toBe(true);
      // the explicit flag is authoritative, not the prefix
      expect(mails[0].is_encrypted).toBe(0);

      const parsedRes = await request.get(`${WORKER_URL}/api/parsed_mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}`, 'x-lang': 'en' },
      });
      const { results } = await parsedRes.json();
      expect(results[0].encrypted).toBeUndefined();
      expect(results[0].subject).not.toBe('[Encrypted mail]');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('plaintext address still stores and parses mail unchanged', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'enc-plain');
    const subject = `Plaintext Subject ${Date.now()}`;
    try {
      await seedTestMail(request, address, { subject, text: 'plaintext body' });

      const results = await getMails(request, jwt);
      expect(results).toHaveLength(1);
      expect(results[0].raw).toContain(subject);
      expect(results[0].raw.startsWith(ENC_PREFIX)).toBe(false);

      const parsedRes = await request.get(`${WORKER_URL}/api/parsed_mails?limit=10&offset=0`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const { results: parsed } = await parsedRes.json();
      expect(parsed[0].encrypted).toBeUndefined();
      expect(parsed[0].subject).toBe(subject);
      expect(parsed[0].text).toContain('plaintext body');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('clearing the key stores new mail as plaintext while old mail stays encrypted', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { jwt, address } = await createAddressWithKey(request, 'enc-clear', publicKey);
    const firstSubject = `Before Clear ${Date.now()}`;
    const secondSubject = `After Clear ${Date.now()}`;
    try {
      await seedTestMail(request, address, { subject: firstSubject, text: 'before clearing the key' });

      const clearRes = await request.post(`${WORKER_URL}/api/address_encryption`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { publicKey: null },
      });
      expect(clearRes.ok()).toBe(true);

      const getRes = await request.get(`${WORKER_URL}/api/address_encryption`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect((await getRes.json()).publicKey).toBeNull();

      await seedTestMail(request, address, { subject: secondSubject, text: 'after clearing the key' });

      const results = await getMails(request, jwt);
      expect(results).toHaveLength(2);

      // The encrypted mail must still be an envelope and decryptable
      const encryptedMail = results.find((m: any) => m.raw.startsWith(ENC_PREFIX));
      expect(encryptedMail).toBeDefined();
      const decrypted = await decryptMail(privateKey, encryptedMail.raw);
      expect(decrypted).toContain(`Subject: ${firstSubject}`);

      // The new mail is plaintext
      const plaintextMail = results.find((m: any) => !m.raw.startsWith(ENC_PREFIX));
      expect(plaintextMail).toBeDefined();
      expect(plaintextMail.raw).toContain(secondSubject);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('webhook for encrypted addresses is content-free, and is called again after the key is cleared', async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const { jwt, address } = await createAddressWithKey(request, 'enc-webhook', publicKey);
    const { server, requests, url } = await startWebhookReceiver();
    try {
      const saveRes = await request.post(`${WORKER_URL}/api/webhook/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: {
          enabled: true,
          url,
          method: 'POST',
          headers: JSON.stringify({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ from: '${from}', subject: '${subject}' }),
        },
      });
      expect(saveRes.ok()).toBe(true);

      // Encrypted mail triggers the webhook with a content-free payload only
      await seedTestMail(request, address, {
        subject: `Webhook Encrypted ${Date.now()}`,
        text: 'must not reach the webhook',
      });
      await expect.poll(() => requests.length, { timeout: 10_000 }).toBe(1);
      const payload = JSON.parse((await requests[0]).body);
      expect(payload).toEqual({
        encrypted: true,
        address,
        mail_id: expect.any(Number),
        created_at: expect.any(String),
      });
      // no subject, sender, body, raw, or attachments anywhere in the payload
      expect(JSON.stringify(payload)).not.toContain('must not reach the webhook');

      // After clearing the key, plaintext mail triggers the normal webhook
      const clearRes = await request.post(`${WORKER_URL}/api/address_encryption`, {
        headers: { Authorization: `Bearer ${jwt}` },
        data: { publicKey: null },
      });
      expect(clearRes.ok()).toBe(true);

      const plainSubject = `Webhook Plain ${Date.now()}`;
      await seedTestMail(request, address, { subject: plainSubject, text: 'should reach the webhook' });
      await expect.poll(() => requests.length, { timeout: 10_000 }).toBe(2);
      const plainPayload = JSON.parse((await requests[1]).body);
      expect(plainPayload.subject).toBe(plainSubject);
    } finally {
      server.close();
      await deleteAddress(request, jwt);
    }
  });
});
