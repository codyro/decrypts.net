import { test, expect, request as apiRequest } from '@playwright/test';
import { generateKeyPair } from '../../../../frontend/src/utils/mail-crypto.js';
import {
  FRONTEND_URL,
  WORKER_URL,
  TEST_DOMAIN,
  seedTestMail,
  createTestAddress,
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

      // The private key fragment is ingested into the browser key store and
      // stripped from the address bar (it must never be sent to any server).
      await expect.poll(() => new URL(page.url()).hash).toBe('');
      // A raw `#k=` import opens the "protect this key" offer; skip it
      // (creation-time backups are covered in key-backup.spec.ts).
      await page.keyboard.press('Escape');

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

  test('legacy localStorage plaintext keys migrate to a non-extractable IndexedDB key', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'enc-migrate');
      jwt = mailbox.jwt;
      const subject = `Migrate Decrypt ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject, text: 'migrated body' });

      // Seed the legacy plaintext key store before the app boots. Opening
      // the page must move the key into IndexedDB (non-extractable). The
      // plaintext copy is now KEPT until the user answers the one-time
      // backup prompt (legacyMigrationPending) — the UI for that is a
      // follow-up; here we assert the deferral-driven state directly.
      await page.addInitScript(({ address, privateKey }) => {
        localStorage.setItem('mailPrivateKeys', JSON.stringify({ [address]: [privateKey] }));
      }, { address: mailbox.address, privateKey: mailbox.privateKey });

      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);

      // IndexedDB holds the key as a non-extractable CryptoKey (allow extra
      // time for a cold dev-server first load).
      await expect.poll(async () => {
        return page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const rq = indexedDB.open('cf-temp-email-keys', 1);
            rq.onsuccess = () => resolve(rq.result);
            rq.onerror = () => reject(rq.error);
          });
          const records = await new Promise<any[]>((resolve, reject) => {
            const rq = db.transaction('keys', 'readonly').objectStore('keys').getAll();
            rq.onsuccess = () => resolve(rq.result);
            rq.onerror = () => reject(rq.error);
          });
          const record = records[0] || null;
          return {
            count: records.length,
            address: record?.address ?? null,
            hasPublicKey: typeof record?.publicKey === 'string',
            privateKeyIsCryptoKey: record?.privateKey instanceof CryptoKey,
            extractable: record?.privateKey ? (record.privateKey as CryptoKey).extractable : null,
          };
        });
      }, { timeout: 30_000 }).toEqual({
        count: 1,
        address: mailbox.address,
        hasPublicKey: true,
        privateKeyIsCryptoKey: true,
        extractable: false,
      });

      // The plaintext localStorage copy is deliberately kept while the
      // one-time backup prompt (legacyMigrationPending) is unanswered.
      expect(await page.evaluate(() => localStorage.getItem('mailPrivateKeys'))).toContain(mailbox.address);

      // The mail still decrypts with the migrated key.
      await expect(page.locator('.mail-summary-subject').first()).toContainText(subject);
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

  test('sent mail in an encrypted address shows decrypted content in the sendbox', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'enc-sendbox');
      jwt = mailbox.jwt;
      const subject = `Sendbox Decrypt ${Date.now()}`;
      const sendRes = await api.post(`${WORKER_URL}/api/send_mail`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
        data: {
          from_name: '', from_mail: mailbox.address,
          to_name: '', to_mail: `recipient-${Date.now()}@test.example.com`,
          subject, content: 'sendbox decrypted body', is_html: false,
        },
      });
      expect(sendRes.ok(), await sendRes.text()).toBe(true);

      await page.goto(
        `${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`
        + `#k=${encodeURIComponent(mailbox.privateKey)}&a=${encodeURIComponent(mailbox.address)}`,
      );
      await expect.poll(() => new URL(page.url()).hash).toBe('');
      // A raw `#k=` import opens the "protect this key" offer; skip it
      // (creation-time backups are covered in key-backup.spec.ts).
      await page.keyboard.press('Escape');

      await page.getByText('Sent', { exact: true }).click();
      const row = page.locator('.sent-list-scroll .n-list-item').first();
      await expect(row).toContainText(subject);
      await expect(row.locator('.sent-lock')).toHaveCount(0);

      // The stored sendbox raw is an envelope, never shown as content
      await row.click();
      const detail = page.locator('.mail-item, .sent-mobile-detail').first();
      await expect(detail).toContainText('sendbox decrypted body');
      await expect(detail).not.toContainText('cfte1.');
    } finally {
      await deleteAddress(api, jwt);
      await api.dispose();
    }
  });

  test('a plaintext mail starting with cfte1. renders as plaintext on a migrated database', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createTestAddress(api, 'encplain');
      jwt = mailbox.jwt;
      // Plaintext row whose body starts with the envelope prefix: on a
      // migrated DB the explicit is_encrypted=0 flag is authoritative.
      const marker = `cfte1.${'A'.repeat(64)}`;
      const subject = `Plain Prefix ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject, text: marker });

      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      const summary = page.locator('.mail-summary').first();
      // is_encrypted=0 is authoritative: no lock, real subject
      await expect(summary.locator('.mail-summary-lock')).toHaveCount(0);
      await expect(summary).toContainText(subject);

      await summary.click();
      await expect(page.locator('.mail-content-renderer')).toContainText(marker);
    } finally {
      await deleteAddress(api, jwt);
      await api.dispose();
    }
  });

  test('"Encrypt existing mail" re-encrypts plaintext inbox mail and it still reads correctly', async ({ page }) => {
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      // Seed plaintext mail BEFORE the public key is set: mail received
      // while a key is set is already stored encrypted.
      const mailbox = await createTestAddress(api, 'encexist');
      jwt = mailbox.jwt;
      const subjects = [`Existing One ${Date.now()}`, `Existing Two ${Date.now()}`];
      for (const subject of subjects) {
        await seedTestMail(api, mailbox.address, { subject, text: `body of ${subject}` });
      }
      const { publicKey, privateKey } = await generateKeyPair();
      const enableRes = await api.post(`${WORKER_URL}/api/address_encryption`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
        data: { publicKey },
      });
      expect(enableRes.ok(), await enableRes.text()).toBe(true);

      await page.goto(
        `${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`
        + `#k=${encodeURIComponent(privateKey)}&a=${encodeURIComponent(mailbox.address)}`,
      );
      await expect.poll(() => new URL(page.url()).hash).toBe('');
      // A raw `#k=` import opens the "protect this key" offer; skip it
      // (creation-time backups are covered in key-backup.spec.ts).
      await page.keyboard.press('Escape');

      await page.getByText('Mailbox Settings', { exact: true }).click();
      await page.getByRole('button', { name: 'Encrypt Existing Mail', exact: true }).click();
      const dialog = page.locator('.n-modal');
      await expect(dialog).toContainText('irreversibly');
      await dialog.getByRole('button', { name: 'Encrypt Existing Mail', exact: true }).click();

      await expect(page.locator('.enc-existing')).toContainText('2 encrypted, 0 skipped');

      // The mail still reads correctly in the UI after re-encryption
      await page.getByText('Inbox', { exact: true }).click();
      const summary = page.locator('.mail-summary-subject').first();
      await expect(summary).toContainText(subjects[1]);
      await summary.click();
      await expect(page.locator('.mail-content-renderer')).toContainText(`body of ${subjects[1]}`);

      // The DB rows are now encrypted envelopes
      const query = await api.get(`${WORKER_URL}/__test/query`, {
        params: {
          sql: `SELECT is_encrypted, substr(raw, 1, 6) AS prefix FROM raw_mails`
            + ` WHERE address = '${mailbox.address}' ORDER BY id`,
        },
      });
      expect(query.ok(), await query.text()).toBe(true);
      const { results } = await query.json();
      expect(results).toHaveLength(2);
      for (const row of results) {
        expect(row.is_encrypted).toBe(1);
        expect(row.prefix).toBe('cfte1.');
      }
    } finally {
      await deleteAddress(api, jwt);
      await api.dispose();
    }
  });
});
