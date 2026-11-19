import { test, expect, request as apiRequest } from '@playwright/test';
import { generateKeyPair } from '../../../../frontend/src/utils/mail-crypto.js';
import {
  FRONTEND_URL,
  WORKER_URL,
  TEST_DOMAIN,
  seedTestMail,
  deleteAddress,
} from '../../../fixtures/test-helpers';

/**
 * Browser-side decryption of mailbox-encrypted mail via a decryption link
 * (`#k=<privateKey>&a=<address>` fragment). Requires the default E2E worker
 * (ENABLE_MAIL_ENCRYPTION=true) and its frontend.
 */

async function createEncryptedAddress(api: any, name: string) {
  const { publicKey, privateKey } = await generateKeyPair();
  const res = await api.post(`${WORKER_URL}/api/new_address`, {
    data: {
      name: `${name}${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
      domain: TEST_DOMAIN,
      encryption_public_key: publicKey,
    },
  });
  if (!res.ok()) throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return { jwt: body.jwt, address: body.address, privateKey };
}

test.describe('Mailbox encryption browser flow', () => {
  test('decryption-link login strips the fragment and shows the decrypted subject', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'enc-browser');
      jwt = mailbox.jwt;
      const subject = `Browser Decrypt ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject, text: 'browser decryption body' });

      await page.goto(
        `${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`
        + `#k=${encodeURIComponent(mailbox.privateKey)}&a=${encodeURIComponent(mailbox.address)}`,
      );

      // The private key fragment is ingested into localStorage and stripped
      // from the address bar (it must never be sent to any server).
      await expect.poll(() => new URL(page.url()).hash).toBe('');

      // The encrypted mail renders with its decrypted subject
      const summary = page.locator('.mail-summary-subject').first();
      await expect(summary).toContainText(subject);

      // Opening the mail shows the decrypted body
      await summary.click();
      await expect(page.locator('.mail-content-renderer')).toContainText('browser decryption body');
    } finally {
      await deleteAddress(api, jwt);
      await api.dispose();
    }
  });

  test('encrypted mail shows a locked placeholder when no private key is stored', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'enc-lock');
      jwt = mailbox.jwt;
      await seedTestMail(api, mailbox.address, {
        subject: `Locked Subject ${Date.now()}`,
        text: 'locked body',
      });

      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      const summary = page.locator('.mail-summary').first();
      await expect(summary.locator('.mail-summary-lock')).toBeVisible();
      // The plaintext subject must not leak into the list
      await expect(summary).not.toContainText('Locked Subject');
    } finally {
      await deleteAddress(api, jwt);
      await api.dispose();
    }
  });
});
