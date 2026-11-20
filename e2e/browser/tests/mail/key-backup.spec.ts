import { test, expect, request as apiRequest } from '@playwright/test';
import fs from 'fs';
import { generateKeyPair } from '../../../../frontend/src/utils/mail-crypto.js';
import { wrapPrivateKey } from '../../../../frontend/src/utils/key-backup.js';
import {
  FRONTEND_URL,
  WORKER_URL,
  TEST_DOMAIN,
  seedTestMail,
  deleteAddress,
} from '../../../fixtures/test-helpers';

/**
 * Passphrase-protected key backups (`#kp=`): creation-time wrapping, host
 * passphrase prompts, the raw-import offer, the legacy plaintext migration
 * prompt and the AccountSettings backup actions. Requires the default E2E
 * worker (ENABLE_MAIL_ENCRYPTION=true) and its frontend.
 */

const PASSPHRASE = 'e2e backup passphrase';

async function createEncryptedAddress(api: any, name: string) {
  const { publicKey, privateKey } = await generateKeyPair();
  const res = await api.post(`${WORKER_URL}/api/new_address`, {
    data: {
      name: `${name}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      domain: TEST_DOMAIN,
      encryption_public_key: publicKey,
    },
  });
  if (!res.ok()) throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return { jwt: body.jwt, address: body.address, privateKey, publicKey };
}

/** Read the key-store records straight from IndexedDB. */
async function readKeyRecords(page: any): Promise<any[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const rq = indexedDB.open('cf-temp-email-keys', 1);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
    return new Promise<any[]>((resolve, reject) => {
      const rq = db.transaction('keys', 'readonly').objectStore('keys').getAll();
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  });
}

async function readClipboard(page: any): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe('Passphrase-protected key backups', () => {
  test('creation flow: raw link shown once, protected backup created, mail decrypts after reload', async ({ page }) => {
    test.setTimeout(240_000);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      await page.goto(`${FRONTEND_URL}/en/`);
      await page.getByRole('button', { name: 'Create Email Address', exact: true }).click();
      const form = page.locator('.n-tab-pane:visible form');
      await form.locator('.n-input-group .n-input input').fill(`backup${Date.now()}`);
      await form.getByText('Encrypt received mail end-to-end', { exact: false }).click();

      const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/new_address');
      await form.getByRole('button', { name: 'Create Email Address', exact: true }).click();
      const created = await createdResponse;
      expect(created.ok()).toBe(true);
      const mailbox = await created.json();
      jwt = mailbox.jwt;

      // The raw #k= link is shown exactly once in the creation dialog.
      const rawLink = page.getByTestId('key-backup-raw-link').locator('textarea');
      await expect(rawLink).toBeVisible();
      await expect(rawLink).toHaveValue(/#k=/);
      // The address-credentials dialog opened afterwards sits on top; close
      // it so the backup dialog's controls are clickable.
      await page.keyboard.press('Escape');

      // Create the passphrase-protected backup from the transient raw key.
      await page.getByTestId('key-backup-passphrase').locator('input').fill(PASSPHRASE);
      await page.getByTestId('key-backup-confirm').locator('input').fill(PASSPHRASE);
      await page.getByTestId('key-backup-create').click();
      await expect(page.getByTestId('key-backup-copy-link')).toBeVisible();

      // The copied protected link is a #kp= link, never a raw #k= link.
      await page.getByTestId('key-backup-copy-link').click();
      await expect.poll(async () => (await readClipboard(page)).includes('#kp=')).toBe(true);
      const protectedLink = await readClipboard(page);
      expect(protectedLink).not.toContain('#k=');
      expect(protectedLink).toContain(`a=${encodeURIComponent(mailbox.address)}`);

      // Close the backup dialog, seed a mail, reload: the mail decrypts
      // with the stored non-extractable key.
      await page.keyboard.press('Escape');
      const subject = `Backup Decrypt ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject, text: 'backup protected body' });
      await page.reload();
      await expect(page.locator('.mail-summary-subject').first()).toContainText(subject, { timeout: 60_000 });

      // The raw key is not in localStorage; IndexedDB holds a
      // non-extractable CryptoKey plus the wrapped backup blob.
      expect(await page.evaluate(() => localStorage.getItem('mailPrivateKeys'))).toBeNull();
      const stored = await page.evaluate(async (address) => {
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
        const rec = records.find((r) => r.address === address);
        return {
          count: records.length,
          isCryptoKey: rec?.privateKey instanceof CryptoKey,
          extractable: rec?.privateKey ? (rec.privateKey as CryptoKey).extractable : null,
          hasWrapped: typeof rec?.wrappedBackup === 'string',
        };
      }, mailbox.address);
      expect(stored.count).toBeGreaterThan(0);
      expect(stored.isCryptoKey).toBe(true);
      expect(stored.extractable).toBe(false);
      expect(stored.hasWrapped).toBe(true);

      // "Copy protected backup link" still works after the reload.
      await page.getByText('Mailbox Settings', { exact: true }).click();
      const copyButton = page.getByTestId('copy-protected-backup-link');
      await expect(copyButton).toBeEnabled();
      await copyButton.click();
      await expect.poll(async () => (await readClipboard(page)).includes('#kp=')).toBe(true);
      expect(await readClipboard(page)).not.toContain('#k=');
    } finally {
      try {
        await deleteAddress(api, jwt);
      } catch (error) {
        console.warn(`cleanup: failed to delete address: ${error}`);
      }
      await api.dispose();
    }
  });

  test('opening a #kp= link prompts for the passphrase, wrong then right, and strips the fragment', async ({ page }) => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'kp-import');
      jwt = mailbox.jwt;
      const subject = `Kp Import ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject, text: 'kp import body' });

      const blob = await wrapPrivateKey({
        privateKeyB64u: mailbox.privateKey,
        address: mailbox.address,
        passphrase: PASSPHRASE,
      });
      await page.goto(
        `${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`
        + `#kp=${encodeURIComponent(blob)}&a=${encodeURIComponent(mailbox.address)}`,
      );

      // The wrapped backup is queued for the global passphrase prompt and
      // the fragment is stripped from the address bar.
      const dialog = page.getByTestId('key-backup-wrapped-import');
      await expect(dialog).toBeVisible({ timeout: 60_000 });
      await expect.poll(() => new URL(page.url()).hash).toBe('');

      // Wrong passphrase shows an inline error and retries.
      await page.getByTestId('wrapped-import-passphrase').locator('input').fill('wrong passphrase');
      await page.getByTestId('wrapped-import-submit').click();
      await expect(page.getByTestId('wrapped-import-error')).toBeVisible();
      await expect(page.getByTestId('wrapped-import-error')).toContainText('Incorrect passphrase');

      // Correct passphrase imports the key and the mail decrypts.
      await page.getByTestId('wrapped-import-passphrase').locator('input').fill(PASSPHRASE);
      await page.getByTestId('wrapped-import-submit').click();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('.mail-summary-subject').first()).toContainText(subject, { timeout: 60_000 });
    } finally {
      try {
        await deleteAddress(api, jwt);
      } catch (error) {
        console.warn(`cleanup: failed to delete address: ${error}`);
      }
      await api.dispose();
    }
  });

  test('a plain #k= link still imports and offers to protect the key (skip works)', async ({ page }) => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'k-import');
      jwt = mailbox.jwt;
      const subject = `K Import ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject, text: 'k import body' });

      await page.goto(
        `${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`
        + `#k=${encodeURIComponent(mailbox.privateKey)}&a=${encodeURIComponent(mailbox.address)}`,
      );

      // The raw key imports and the host offers to protect it.
      const offer = page.getByTestId('key-backup-raw-offer');
      await expect(offer).toBeVisible({ timeout: 60_000 });
      await expect.poll(() => new URL(page.url()).hash).toBe('');

      // Skipping drops the raw key and the mail decrypts with the imported key.
      await page.getByTestId('raw-offer-skip').click();
      await expect(offer).toHaveCount(0);
      await expect(page.locator('.mail-summary-subject').first()).toContainText(subject, { timeout: 60_000 });
      const records = await readKeyRecords(page);
      expect(records.some((r) => r.address === mailbox.address)).toBe(true);
    } finally {
      try {
        await deleteAddress(api, jwt);
      } catch (error) {
        console.warn(`cleanup: failed to delete address: ${error}`);
      }
      await api.dispose();
    }
  });

  test('legacy migration: setting a passphrase wraps the keys and removes the plaintext copy', async ({ page }) => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'legacy-wrap');
      jwt = mailbox.jwt;
      await page.addInitScript(({ address, privateKey }) => {
        localStorage.setItem('mailPrivateKeys', JSON.stringify({ [address]: [privateKey] }));
      }, { address: mailbox.address, privateKey: mailbox.privateKey });

      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      await expect(page.getByTestId('key-backup-legacy-migration')).toBeVisible({ timeout: 60_000 });

      await page.getByTestId('legacy-choose-passphrase').click();
      await page.getByTestId('legacy-passphrase').locator('input').fill(PASSPHRASE);
      await page.getByTestId('legacy-confirm').locator('input').fill(PASSPHRASE);
      await page.getByTestId('legacy-submit').click();

      // Plaintext removed; every migrated record holds a wrapped backup.
      // (The passphrase modal only disappears after every key was wrapped,
      // which takes a while with the default PBKDF2 iteration count.)
      await expect(page.getByTestId('key-backup-legacy-passphrase')).toHaveCount(0, { timeout: 60_000 });
      await expect.poll(async () => page.evaluate(() => localStorage.getItem('mailPrivateKeys')), {
        timeout: 30_000,
      }).toBeNull();
      await expect.poll(async () => {
        const records = await readKeyRecords(page);
        return records.filter((r) => r.address === mailbox.address && typeof r.wrappedBackup === 'string').length;
      }, { timeout: 30_000 }).toBe(1);
    } finally {
      try {
        await deleteAddress(api, jwt);
      } catch (error) {
        console.warn(`cleanup: failed to delete address: ${error}`);
      }
      await api.dispose();
    }
  });

  test('legacy migration: skip and delete removes the plaintext copy', async ({ page }) => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'legacy-del');
      jwt = mailbox.jwt;
      await page.addInitScript(({ address, privateKey }) => {
        localStorage.setItem('mailPrivateKeys', JSON.stringify({ [address]: [privateKey] }));
      }, { address: mailbox.address, privateKey: mailbox.privateKey });

      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      await expect(page.getByTestId('key-backup-legacy-migration')).toBeVisible({ timeout: 60_000 });

      await page.getByTestId('legacy-choose-delete').click();
      await page.locator('.n-popconfirm').getByRole('button', { name: 'Confirm' }).click();
      await expect(page.getByTestId('key-backup-legacy-migration')).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem('mailPrivateKeys'))).toBeNull();
    } finally {
      try {
        await deleteAddress(api, jwt);
      } catch (error) {
        console.warn(`cleanup: failed to delete address: ${error}`);
      }
      await api.dispose();
    }
  });

  test('legacy migration: "later" keeps the plaintext copy for this session', async ({ page }) => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'legacy-later');
      jwt = mailbox.jwt;
      await page.addInitScript(({ address, privateKey }) => {
        localStorage.setItem('mailPrivateKeys', JSON.stringify({ [address]: [privateKey] }));
      }, { address: mailbox.address, privateKey: mailbox.privateKey });

      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      await expect(page.getByTestId('key-backup-legacy-migration')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('legacy-choose-later').click();
      await expect(page.getByTestId('key-backup-legacy-migration')).toHaveCount(0);

      // Plaintext stays until the user answers.
      expect(await page.evaluate(() => localStorage.getItem('mailPrivateKeys'))).toContain(mailbox.address);

      // The key is still usable (migrated into IndexedDB).
      const subject = `Legacy Later ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject, text: 'legacy later body' });
      await page.reload();
      await expect(page.locator('.mail-summary-subject').first()).toContainText(subject, { timeout: 60_000 });
    } finally {
      try {
        await deleteAddress(api, jwt);
      } catch (error) {
        console.warn(`cleanup: failed to delete address: ${error}`);
      }
      await api.dispose();
    }
  });

  test('AccountSettings: backup buttons disabled without a backup, "create from my key" works', async ({ page }) => {
    test.setTimeout(300_000);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const api = await apiRequest.newContext();
    let jwt = '';
    try {
      const mailbox = await createEncryptedAddress(api, 'settings-backup');
      jwt = mailbox.jwt;
      // Import the raw key first (skip the protect offer) so a local record exists.
      await page.goto(
        `${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`
        + `#k=${encodeURIComponent(mailbox.privateKey)}&a=${encodeURIComponent(mailbox.address)}`,
      );
      await expect(page.getByTestId('key-backup-raw-offer')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('raw-offer-skip').click();

      await page.getByText('Mailbox Settings', { exact: true }).click();
      const copyButton = page.getByTestId('copy-protected-backup-link');
      const downloadButton = page.getByTestId('download-protected-backup-file');
      await expect(copyButton).toBeDisabled();
      await expect(downloadButton).toBeDisabled();
      await expect(page.getByText('No protected backup exists', { exact: false })).toBeVisible();

      // Create a protected backup by pasting the raw key.
      await page.getByTestId('create-backup-from-key').click();
      await page.getByTestId('create-backup-input').locator('textarea').fill(mailbox.privateKey);
      await page.getByTestId('create-backup-passphrase').locator('input').fill(PASSPHRASE);
      await page.getByTestId('create-backup-confirm').locator('input').fill(PASSPHRASE);
      await page.getByTestId('create-backup-submit').click();

      // Buttons are enabled and the copied link is a #kp= link.
      await expect(page.getByTestId('create-backup-dialog')).toHaveCount(0);
      await expect(copyButton).toBeEnabled();
      await copyButton.click();
      await expect.poll(async () => (await readClipboard(page)).includes('#kp=')).toBe(true);
      expect(await readClipboard(page)).not.toContain('#k=');

      // Downloading the backup file produces a parseable backup file.
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      const download = await downloadPromise;
      const path = await download.path();
      const content = fs.readFileSync(path, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed.format).toBe('cf-temp-email-key-backup');
      expect(parsed.address).toBe(mailbox.address);
      expect(typeof parsed.blob).toBe('string');
    } finally {
      try {
        await deleteAddress(api, jwt);
      } catch (error) {
        console.warn(`cleanup: failed to delete address: ${error}`);
      }
      await api.dispose();
    }
  });
});
