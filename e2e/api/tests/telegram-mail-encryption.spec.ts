import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { generateKeyPair, decryptMail } from '../../../frontend/src/utils/mail-crypto.js';
import { WORKER_URL, TEST_DOMAIN, deleteAddress, seedTestMail } from '../../fixtures/test-helpers';

/**
 * Telegram mini-app /telegram/new_address with the optional
 * encryption_public_key field (ENABLE_MAIL_ENCRYPTION=true on the default e2e
 * worker):
 * - valid key: address is created and bound, mail is stored as a "cfte1."
 *   envelope, client-side decryption with the matching private key recovers
 *   the MIME, and /telegram/get_mail returns the raw envelope
 * - invalid key: 400, no address created
 * - absent key: identical plaintext behavior as before
 *
 * The bot /new text command never receives a key and stays plaintext-only;
 * encrypted addresses get no Telegram push (sendMailToTelegram is skipped for
 * encrypted mailboxes in the email ingest pipeline).
 */

const ENC_PREFIX = 'cfte1.';

function initData(userId: number) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId }),
  };
  const key = createHmac('sha256', 'WebAppData').update('e2e-telegram-test-token').digest();
  const hash = createHmac('sha256', key)
    .update(Object.entries(fields).map(([name, value]) => `${name}=${value}`).join('\n'))
    .digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function newTelegramAddress(
  ctx: APIRequestContext,
  userId: number,
  extra: Record<string, unknown> = {},
) {
  return ctx.post(`${WORKER_URL}/telegram/new_address`, {
    data: {
      initData: initData(userId),
      address: `tgenc${Date.now()}${Math.random().toString(36).slice(2, 8)}@${TEST_DOMAIN}`,
      ...extra,
    },
  });
}

async function getMails(ctx: APIRequestContext, jwt: string): Promise<any[]> {
  const res = await ctx.get(`${WORKER_URL}/api/mails?limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { results } = await res.json();
  return results;
}

test.describe('Telegram new address with mail encryption', () => {
  test('valid encryption_public_key stores mail encrypted and decrypts with the private key', async ({ request }) => {
    const owner = Date.now();
    const { publicKey, privateKey } = await generateKeyPair();
    const res = await newTelegramAddress(request, owner, { encryption_public_key: publicKey });
    expect(res.ok(), await res.text()).toBe(true);
    const mailbox = await res.json();

    const subject = `TG Encrypted ${Date.now()}`;
    const text = 'telegram encrypted body';
    try {
      await seedTestMail(request, mailbox.address, { subject, text });

      const results = await getMails(request, mailbox.jwt);
      expect(results).toHaveLength(1);
      const raw: string = results[0].raw;
      expect(raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(raw).not.toContain(subject);
      expect(raw).not.toContain(text);

      const decrypted = await decryptMail(privateKey, raw);
      expect(decrypted).toContain(`Subject: ${subject}`);
      expect(decrypted).toContain(text);

      // The mini-app mail fetch is a raw reader: it passes the envelope through
      const tgMail = await request.post(`${WORKER_URL}/telegram/get_mail`, {
        data: { initData: initData(owner), mailId: results[0].id },
      });
      expect(tgMail.ok(), await tgMail.text()).toBe(true);
      const tgBody = await tgMail.json();
      expect(tgBody.id).toBe(results[0].id);
      expect((tgBody.raw as string).startsWith(ENC_PREFIX)).toBe(true);
    } finally {
      await deleteAddress(request, mailbox.jwt);
    }
  });

  test('invalid encryption_public_key returns 400', async ({ request }) => {
    const res = await newTelegramAddress(request, Date.now(), { encryption_public_key: 'AAAA' });
    expect(res.status()).toBe(400);
    expect(typeof (await res.text())).toBe('string');
  });

  test('absent encryption_public_key stores mail as plaintext', async ({ request }) => {
    const owner = Date.now();
    const res = await newTelegramAddress(request, owner);
    expect(res.ok(), await res.text()).toBe(true);
    const mailbox = await res.json();

    const subject = `TG Plain ${Date.now()}`;
    try {
      await seedTestMail(request, mailbox.address, { subject, text: 'telegram plaintext body' });

      const results = await getMails(request, mailbox.jwt);
      expect(results).toHaveLength(1);
      expect(results[0].raw.startsWith(ENC_PREFIX)).toBe(false);
      expect(results[0].raw).toContain(subject);

      const tgMail = await request.post(`${WORKER_URL}/telegram/get_mail`, {
        data: { initData: initData(owner), mailId: results[0].id },
      });
      expect(tgMail.ok(), await tgMail.text()).toBe(true);
      const tgBody = await tgMail.json();
      expect((tgBody.raw as string)).toContain(subject);
    } finally {
      await deleteAddress(request, mailbox.jwt);
    }
  });

  test('encrypted mail triggers a content-free Telegram push with no subject, sender, or body', async ({ request }) => {
    const owner = Date.now();
    const { publicKey } = await generateKeyPair();
    const res = await newTelegramAddress(request, owner, { encryption_public_key: publicKey });
    expect(res.ok(), await res.text()).toBe(true);
    const mailbox = await res.json();

    const subject = `TG Push Encrypted ${Date.now()}`;
    const text = 'telegram push secret body';
    try {
      await request.post(`${WORKER_URL}/__test/telegram_binding`, {
        data: { userId: owner, address: mailbox.address, jwt: mailbox.jwt },
      });

      const boundary = `----TG${Date.now()}`;
      const raw = [
        `From: Sender <sender@test.example.com>`,
        `To: ${mailbox.address}`,
        `Subject: ${subject}`,
        `Message-ID: <tg-push-${Date.now()}@test>`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=utf-8`,
        ``,
        text,
        `--${boundary}--`,
      ].join('\r\n');

      const receiveRes = await request.post(`${WORKER_URL}/__test/receive_mail`, {
        data: { from: 'sender@test.example.com', to: mailbox.address, raw, record_telegram: true },
      });
      expect(receiveRes.ok(), await receiveRes.text()).toBe(true);
      const result = await receiveRes.json();
      expect(result.success).toBe(true);
      expect(result.telegramCalls).toHaveLength(1);
      expect(result.telegramCalls[0].method).toBe('sendMessage');
      const messageText = result.telegramCalls[0].payload.text as string;
      expect(messageText.length).toBeGreaterThan(0);
      // fixed content-free notice: no subject, sender, or body leaked
      expect(messageText).not.toContain(subject);
      expect(messageText).not.toContain(text);
      expect(messageText).not.toContain('sender@test.example.com');

      // and the stored mail is still an encrypted envelope
      const results = await getMails(request, mailbox.jwt);
      expect(results[0].raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(results[0].is_encrypted).toBe(1);
    } finally {
      await deleteAddress(request, mailbox.jwt);
    }
  });
});
