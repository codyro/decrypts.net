import { test, expect } from '@playwright/test';
import { generateKeyPair, decryptMail } from '../../../frontend/src/utils/mail-crypto.js';
import { WORKER_URL, TEST_DOMAIN, deleteAddress, seedTestMail } from '../../fixtures/test-helpers';

/**
 * Admin /admin/new_address with the optional encryption_public_key field
 * (ENABLE_MAIL_ENCRYPTION=true on the default e2e worker):
 * - valid key: mail is stored as a "cfte1." envelope, client-side
 *   decryption with the matching private key recovers the MIME
 * - invalid key: 400, no address created
 * - absent key: identical plaintext behavior as before
 * - batch-like: several addresses each with their own key; every mailbox
 *   decrypts only with its own private key
 */

const ENC_PREFIX = 'cfte1.';

async function createAdminAddress(
  ctx: any,
  name: string,
  extra: Record<string, unknown> = {},
): Promise<{ res: any; body: any }> {
  const res = await ctx.post(`${WORKER_URL}/admin/new_address`, {
    data: {
      name: `${name}${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
      domain: TEST_DOMAIN,
      ...extra,
    },
  });
  const body = res.ok() ? await res.json() : await res.text();
  return { res, body };
}

async function getMails(ctx: any, jwt: string): Promise<any[]> {
  const res = await ctx.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(res.ok()).toBe(true);
  const { results } = await res.json();
  return results;
}

test.describe('Admin new address with mail encryption', () => {
  test('valid encryption_public_key stores mail encrypted and decrypts with the private key', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { res, body } = await createAdminAddress(request, 'adm-enc', {
      encryption_public_key: publicKey,
    });
    expect(res.ok()).toBe(true);
    expect(body.address).toContain('@' + TEST_DOMAIN);
    expect(body.jwt).toBeTruthy();
    expect(body.address_id).toBeGreaterThan(0);

    const subject = `Admin Encrypted ${Date.now()}`;
    const text = 'admin encrypted body';
    try {
      await seedTestMail(request, body.address, { subject, text });

      const results = await getMails(request, body.jwt);
      expect(results).toHaveLength(1);
      const raw: string = results[0].raw;
      expect(raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(raw).not.toContain(subject);
      expect(raw).not.toContain(text);

      const decrypted = await decryptMail(privateKey, raw);
      expect(decrypted).toContain(`Subject: ${subject}`);
      expect(decrypted).toContain(text);
    } finally {
      await deleteAddress(request, body.jwt);
    }
  });

  test('invalid encryption_public_key returns 400', async ({ request }) => {
    const { res, body } = await createAdminAddress(request, 'adm-enc-bad', {
      encryption_public_key: 'AAAA',
    });
    expect(res.status()).toBe(400);
    expect(typeof body).toBe('string');
  });

  test('absent encryption_public_key stores mail as plaintext', async ({ request }) => {
    const { res, body } = await createAdminAddress(request, 'adm-plain');
    expect(res.ok()).toBe(true);

    const subject = `Admin Plain ${Date.now()}`;
    try {
      await seedTestMail(request, body.address, { subject, text: 'admin plaintext body' });

      const results = await getMails(request, body.jwt);
      expect(results).toHaveLength(1);
      expect(results[0].raw.startsWith(ENC_PREFIX)).toBe(false);
      expect(results[0].raw).toContain(subject);
    } finally {
      await deleteAddress(request, body.jwt);
    }
  });

  test('batch-like: each address decrypts only with its own private key', async ({ request }) => {
    const mailboxes: { address: string; jwt: string; subject: string; privateKey: string }[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const { publicKey, privateKey } = await generateKeyPair();
        const { res, body } = await createAdminAddress(request, `adm-batch${i}`, {
          encryption_public_key: publicKey,
        });
        expect(res.ok()).toBe(true);
        mailboxes.push({
          address: body.address,
          jwt: body.jwt,
          privateKey,
          subject: `Admin Batch ${i} ${Date.now()}`,
        });
      }
      expect(new Set(mailboxes.map((m) => m.address)).size).toBe(3);

      for (const mailbox of mailboxes) {
        await seedTestMail(request, mailbox.address, {
          subject: mailbox.subject,
          text: `body for ${mailbox.subject}`,
        });
      }

      for (const [index, mailbox] of mailboxes.entries()) {
        const results = await getMails(request, mailbox.jwt);
        expect(results).toHaveLength(1);
        const raw: string = results[0].raw;
        expect(raw.startsWith(ENC_PREFIX)).toBe(true);

        // own key decrypts
        const decrypted = await decryptMail(mailbox.privateKey, raw);
        expect(decrypted).toContain(`Subject: ${mailbox.subject}`);

        // another mailbox's key must not decrypt
        const otherKey = mailboxes[(index + 1) % mailboxes.length].privateKey;
        await expect(decryptMail(otherKey, raw)).rejects.toThrow();
      }
    } finally {
      for (const mailbox of mailboxes) {
        await deleteAddress(request, mailbox.jwt);
      }
    }
  });
});
