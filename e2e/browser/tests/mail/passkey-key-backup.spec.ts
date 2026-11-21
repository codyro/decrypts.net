import { test, expect, request as apiRequest, type Page, type BrowserContext, type CDPSession } from '@playwright/test';
import { createHash } from 'crypto';
import { generateKeyPair } from '../../../../frontend/src/utils/mail-crypto.js';
import {
  PASSKEY_BACKUP_VERSION, PASSKEY_BACKUP_MIN_BLOB_BYTES, PASSKEY_BACKUP_MAX_BLOB_BYTES,
} from '../../../../frontend/src/utils/passkey-wrap.js';
import {
  FRONTEND_URL,
  WORKER_URL,
  TEST_DOMAIN,
  seedTestMail,
} from '../../../fixtures/test-helpers';

/**
 * Passkey (WebAuthn PRF) wrapped key backups, browser side (Phase 3b).
 *
 * Requires the default E2E worker (ENABLE_MAIL_ENCRYPTION=true), its
 * frontend (HTTPS for WebAuthn) and a Chromium whose virtual authenticator
 * supports the PRF extension (CDP WebAuthn.addVirtualAuthenticator with
 * hasPrf: true; Chromium >= 116 — the Playwright 1.65.1 image ships
 * Chromium 159). Scenarios:
 *   (a) account user rotates a key and protects it with a passkey — the
 *       server row holds an opaque blob (version 0x02, no PKCS8 material);
 *   (b) new-device recovery from EMPTY local state: restore the key from
 *       the passkey backup and decrypt mail with a non-extractable key;
 *   (c) deleting the backup removes the server row;
 *   (d) mailbox-only visitors see the passphrase fallback hint, no button;
 *   (e) an authenticator without PRF shows the PRF-unsupported hint.
 *
 * Tests (a)-(c) share ONE browser context so the virtual authenticator's
 * credentials survive the simulated device switch (test b clears only
 * IndexedDB/localStorage, not the context's storage partition).
 */

const USER_PASSWORD = 'passkey-backup-pwd-123';
const HASHED_PASSWORD = createHash('sha256').update(USER_PASSWORD).digest('hex');
const PASSKEY_NAME = 'E2E PRF Passkey';

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function registerAccountUser(api: any, tag: string) {
  const email = `${uniqueId(tag)}@test.example.com`;
  const registerRes = await api.post(`${WORKER_URL}/user_api/register`, {
    data: { email, password: HASHED_PASSWORD },
  });
  if (!registerRes.ok()) throw new Error(`register failed: ${registerRes.status()} ${await registerRes.text()}`);
  const loginRes = await api.post(`${WORKER_URL}/user_api/login`, {
    data: { email, password: HASHED_PASSWORD },
  });
  if (!loginRes.ok()) throw new Error(`login failed: ${loginRes.status()} ${await loginRes.text()}`);
  const { jwt } = await loginRes.json();
  return { email, userJwt: jwt };
}

/** Create an address with an encryption public key and bind it to the user. */
async function createBoundEncryptedAddress(api: any, userJwt: string, name: string) {
  const { publicKey } = await generateKeyPair();
  const res = await api.post(`${WORKER_URL}/api/new_address`, {
    data: {
      name: uniqueId(name),
      domain: TEST_DOMAIN,
      encryption_public_key: publicKey,
    },
  });
  if (!res.ok()) throw new Error(`new_address failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  const bindRes = await api.post(`${WORKER_URL}/user_api/bind_address`, {
    headers: { Authorization: `Bearer ${body.jwt}`, 'x-user-token': userJwt },
  });
  if (!bindRes.ok()) throw new Error(`bind failed: ${bindRes.status()} ${await bindRes.text()}`);
  return { jwt: body.jwt, address: body.address, address_id: body.address_id };
}

async function getServerBackups(api: any, userJwt: string, address: string) {
  const res = await api.get(`${WORKER_URL}/user_api/key_backups`, {
    headers: { 'x-user-token': userJwt },
    params: { address },
  });
  if (!res.ok()) throw new Error(`key_backups failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

async function getAccountPasskeys(api: any, userJwt: string) {
  const res = await api.get(`${WORKER_URL}/user_api/passkey`, {
    headers: { 'x-user-token': userJwt },
  });
  if (!res.ok()) throw new Error(`passkey list failed: ${res.status()} ${await res.text()}`);
  return res.json();
}

/** Assert the stored blob is opaque and matches the PRF wrap shape. */
async function assertOpaqueBlob(api: any, address: string) {
  const query = await api.get(`${WORKER_URL}/__test/query`, {
    params: {
      sql: `SELECT key_id, passkey_id, blob FROM user_key_backups`
        + ` WHERE address = '${address}' ORDER BY id`,
    },
  });
  expect(query.ok(), await query.text()).toBe(true);
  const { results } = await query.json();
  expect(results).toHaveLength(1);
  const row = results[0];
  const bytes = Buffer.from(row.blob, 'base64url');
  expect(bytes[0]).toBe(PASSKEY_BACKUP_VERSION);
  expect(bytes.length).toBeGreaterThanOrEqual(PASSKEY_BACKUP_MIN_BLOB_BYTES);
  expect(bytes.length).toBeLessThanOrEqual(PASSKEY_BACKUP_MAX_BLOB_BYTES);
  // No plaintext PKCS8/DER private key material anywhere in the blob.
  const pkcs8DerPrefix = Buffer.from([0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20]);
  expect(bytes.includes(pkcs8DerPrefix)).toBe(false);
  expect(row.blob).not.toMatch(/[+/=]/); // unpadded base64url on the wire
  return row;
}

/** Register a passkey on the account through the User Settings UI. */
async function createPasskeyViaUI(page: Page, name: string) {
  await page.getByText('User Settings').click();
  await page.getByRole('button', { name: 'Create Passkey' }).click();
  const modal = page.locator('.n-dialog');
  await expect(modal).toBeVisible({ timeout: 5_000 });
  await modal.getByRole('textbox').fill(name);
  await modal.getByRole('button', { name: 'Create Passkey' }).click();
  await expect(modal).not.toBeVisible({ timeout: 15_000 });
}

/** Rotate the mailbox encryption key via Mailbox Settings; the backup dialog opens. */
async function rotateKeyViaUI(page: Page) {
  await page.getByText('Mailbox Settings', { exact: true }).click();
  await page.getByRole('button', { name: 'Rotate Key', exact: true }).click();
  const dialog = page.locator('.n-dialog');
  await expect(dialog).toContainText('A new key pair will be generated');
  await dialog.getByRole('button', { name: 'Rotate Key', exact: true }).click();
  await expect(page.getByText('New Decryption Key Generated')).toBeVisible({ timeout: 15_000 });
}

async function clickPopconfirm(page: Page) {
  const popconfirm = page.locator('.n-popconfirm');
  await expect(popconfirm).toBeVisible({ timeout: 5_000 });
  await popconfirm.locator('.n-button--primary-type').click();
}

test.describe('Passkey wrapped key backups (WebAuthn PRF)', () => {
  test.describe.configure({ mode: 'serial', lock: 'user-settings' });

  let user: { email: string; userJwt: string };
  let mailbox: { jwt: string; address: string; address_id: number };
  let rotatedSubject: string;
  // Shared browser state: the virtual authenticator's credentials must
  // survive across tests (b) simulates a new device by clearing site data
  // only, keeping the context (and its authenticator storage partition).
  let sharedContext: BrowserContext;
  let sharedPage: Page;
  let cdp: CDPSession;
  let prfAuthenticatorId: string;

  test.beforeAll(async ({ browser }) => {
    const api = await apiRequest.newContext();
    try {
      // Make sure user registration is enabled (idempotent KV setting).
      await api.post(`${WORKER_URL}/admin/user_settings`, {
        data: { enable: true, enableMailVerify: false },
      });
      user = await registerAccountUser(api, 'pkbackup');
      mailbox = await createBoundEncryptedAddress(api, user.userJwt, 'pkbmain');
    } finally {
      await api.dispose();
    }
    sharedContext = await browser.newContext({ ignoreHTTPSErrors: true });
    sharedPage = await sharedContext.newPage();
    cdp = await sharedContext.newCDPSession(sharedPage);
    await cdp.send('WebAuthn.enable');
  });

  test.afterAll(async () => {
    const api = await apiRequest.newContext();
    try {
      await api.delete(`${WORKER_URL}/api/delete_address`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
    } finally {
      await api.dispose();
    }
    if (cdp) await cdp.detach();
    if (sharedContext) await sharedContext.close();
  });

  test('(a) rotate a key and protect it with a PRF passkey; the server blob is opaque', async () => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    const page = sharedPage;
    try {
      const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          hasPrf: true,
        },
      });
      prfAuthenticatorId = authenticatorId;

      await page.goto(`${FRONTEND_URL}/en/`);
      await page.evaluate((jwt) => { localStorage.setItem('userJwt', jwt); }, user.userJwt);
      await page.goto(`${FRONTEND_URL}/en/user`);
      await expect(page.getByText(user.email)).toBeVisible({ timeout: 15_000 });
      await createPasskeyViaUI(page, PASSKEY_NAME);

      // Open the bound encrypted mailbox and rotate its key.
      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      await expect(page.getByText('Mailbox Settings', { exact: true })).toBeVisible({ timeout: 30_000 });
      await rotateKeyViaUI(page);

      // The passkey control sees a logged-in account with a bound address
      // and one registered passkey → the action is offered directly.
      const protectButton = page.getByTestId('passkey-backup-protect');
      await expect(protectButton).toBeVisible({ timeout: 15_000 });
      await protectButton.click();
      await expect(page.getByTestId('passkey-backup-success')).toBeVisible({ timeout: 30_000 });

      // The server holds exactly one opaque blob bound to the right passkey.
      const passkeys = await getAccountPasskeys(api, user.userJwt);
      expect(passkeys).toHaveLength(1);
      const row = await assertOpaqueBlob(api, mailbox.address);
      expect(row.passkey_id).toBe(passkeys[0].passkey_id);
      const serverKey = await api.get(`${WORKER_URL}/api/address_encryption`, {
        headers: { Authorization: `Bearer ${mailbox.jwt}` },
      });
      expect(serverKey.ok()).toBe(true);
      expect((await serverKey.json()).publicKey).toBe(row.key_id);

      // Seed a mail: it is stored encrypted under the rotated key.
      rotatedSubject = `Passkey backup mail ${Date.now()}`;
      await seedTestMail(api, mailbox.address, { subject: rotatedSubject, text: 'passkey backup body' });
    } finally {
      await api.dispose();
    }
  });

  test('(b) new device: empty local state, log in again, restore the key from the passkey backup', async () => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    const page = sharedPage;
    try {
      // Simulate a new device: drop every local trace (IndexedDB + storage)
      // but keep the browser context (the virtual authenticator credentials
      // live in its storage partition).
      await page.goto(`${FRONTEND_URL}/en/`);
      await page.evaluate(async () => {
        localStorage.clear();
        sessionStorage.clear();
        await new Promise<void>((resolve) => {
          const rq = indexedDB.deleteDatabase('cf-temp-email-keys');
          rq.onsuccess = () => resolve();
          rq.onerror = () => resolve();
          rq.onblocked = () => resolve();
        });
      });

      // Log in to the account again (plain password login).
      await page.goto(`${FRONTEND_URL}/en/user`);
      const loginForm = page.locator('.user-login-form');
      await expect(loginForm).toBeVisible({ timeout: 30_000 });
      await loginForm.locator('input').first().fill(user.email);
      await loginForm.locator('input[type="password"]').fill(USER_PASSWORD);
      await loginForm.getByRole('button', { name: 'Login', exact: true }).click();
      await expect(page.getByText(user.email)).toBeVisible({ timeout: 30_000 });

      // Open the bound mailbox from the address management list.
      const addressRow = page.locator('.n-data-table-tr', { hasText: mailbox.address });
      await expect(addressRow).toBeVisible({ timeout: 30_000 });
      await addressRow.getByRole('button', { name: 'Open Mailbox' }).click();
      await clickPopconfirm(page);

      // Mailbox Settings: the passkey backup is listed as a non-local key.
      await page.getByText('Mailbox Settings', { exact: true }).click();
      const backupList = page.getByTestId('passkey-backup-list');
      await expect(backupList).toBeVisible({ timeout: 30_000 });
      await expect(backupList).toContainText(PASSKEY_NAME);
      await expect(backupList.getByTestId('passkey-backup-old')).toBeVisible();

      // Restore the key from the passkey backup (PRF assertion runs headlessly).
      await page.getByTestId('restore-passkey-backup').click();
      await expect(page.getByText('Decryption key restored from the passkey backup'))
        .toBeVisible({ timeout: 30_000 });

      // The stored private key is a non-extractable CryptoKey.
      const keyInfo = await page.evaluate(async (address) => {
        const records = await new Promise<any[]>((resolve, reject) => {
          const rq = indexedDB.open('cf-temp-email-keys', 1);
          rq.onsuccess = () => {
            const getAll = rq.result.transaction('keys', 'readonly').objectStore('keys').getAll();
            getAll.onsuccess = () => resolve(getAll.result);
            getAll.onerror = () => reject(getAll.error);
          };
          rq.onerror = () => reject(rq.error);
        });
        const record = records.find((item) => item.address === address);
        return {
          found: !!record,
          isCryptoKey: record?.privateKey instanceof CryptoKey,
          extractable: record?.privateKey?.extractable === true,
          hasWrappedPasskeyBlob: false,
        };
      }, mailbox.address);
      expect(keyInfo.found).toBe(true);
      expect(keyInfo.isCryptoKey).toBe(true);
      expect(keyInfo.extractable).toBe(false);

      // The import notification re-parses the locked mail: subject appears.
      await page.getByText('Inbox', { exact: true }).click();
      await expect(page.locator('.mail-summary-subject').first())
        .toContainText(rotatedSubject, { timeout: 30_000 });
    } finally {
      await api.dispose();
    }
  });

  test('(c) deleting the passkey backup removes the server row', async () => {
    test.setTimeout(120_000);
    const api = await apiRequest.newContext();
    const page = sharedPage;
    try {
      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      await page.getByText('Mailbox Settings', { exact: true }).click();
      const backupList = page.getByTestId('passkey-backup-list');
      await expect(backupList).toBeVisible({ timeout: 30_000 });
      await expect(backupList.getByTestId('passkey-backup-current')).toBeVisible();
      await page.getByTestId('delete-passkey-backup').click();
      await clickPopconfirm(page);
      await expect(backupList.getByTestId('passkey-backup-empty')).toBeVisible({ timeout: 30_000 });
      const backups = await getServerBackups(api, user.userJwt, mailbox.address);
      expect(backups).toHaveLength(0);
    } finally {
      await api.dispose();
    }
  });

  test('(d) mailbox-only visitor sees the passphrase fallback hint, no passkey button', async () => {
    test.setTimeout(180_000);
    const api = await apiRequest.newContext();
    const page = sharedPage;
    let anonymousJwt = '';
    try {
      // Fresh anonymous visitor: no mailbox session, no account.
      await page.goto(`${FRONTEND_URL}/en/`);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto(`${FRONTEND_URL}/en/`);
      // The create tab is the landing default; click it explicitly to be safe.
      await page.locator('.n-tabs-tab').getByText('Create Email Address', { exact: true }).click();
      const form = page.locator('.n-tab-pane:visible form');
      await form.locator('.n-input-group .n-input input').fill(uniqueId('pkdanon'));
      await form.getByText('Encrypt stored mail', { exact: false }).click();
      const createdResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/api/new_address',
      );
      await form.getByRole('button', { name: 'Create Email Address', exact: true }).click();
      const created = await createdResponse;
      expect(created.ok()).toBe(true);
      anonymousJwt = (await created.json()).jwt;

      // The creation-time backup dialog offers the passphrase backup and a
      // passkey hint — never a passkey action for mailbox-only visitors.
      await expect(page.getByTestId('key-backup-passphrase')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('passkey-backup-login-hint')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('passkey-backup-protect')).toHaveCount(0);
    } finally {
      if (anonymousJwt) {
        await api.delete(`${WORKER_URL}/api/delete_address`, {
          headers: { Authorization: `Bearer ${anonymousJwt}` },
        });
      }
      await api.dispose();
    }
  });

  test('(e) an authenticator without PRF shows the PRF-unsupported hint', async () => {
    test.setTimeout(240_000);
    const api = await apiRequest.newContext();
    const page = sharedPage;
    let mailbox2: { jwt: string; address: string } | null = null;
    try {
      // Drop the PRF-capable authenticator so the new passkey lives on a
      // non-PRF authenticator only.
      if (prfAuthenticatorId) {
        await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: prfAuthenticatorId });
        prfAuthenticatorId = '';
      }
      await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          hasPrf: false,
        },
      });

      const user2 = await registerAccountUser(api, 'pkbackup-noprf');
      mailbox2 = await createBoundEncryptedAddress(api, user2.userJwt, 'pkbnoprf');

      await page.goto(`${FRONTEND_URL}/en/`);
      await page.evaluate((jwt) => { localStorage.setItem('userJwt', jwt); }, user2.userJwt);
      await page.goto(`${FRONTEND_URL}/en/user`);
      await expect(page.getByText(user2.email)).toBeVisible({ timeout: 15_000 });
      await createPasskeyViaUI(page, 'No-PRF Passkey');

      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox2.jwt}`);
      await expect(page.getByText('Mailbox Settings', { exact: true })).toBeVisible({ timeout: 30_000 });
      await rotateKeyViaUI(page);
      const protectButton = page.getByTestId('passkey-backup-protect');
      await expect(protectButton).toBeVisible({ timeout: 15_000 });
      await protectButton.click();
      // The authenticator returns no prf result → dedicated hint, no error wall.
      await expect(page.getByTestId('passkey-prf-unsupported')).toBeVisible({ timeout: 30_000 });
      const backups = await getServerBackups(api, user2.userJwt, mailbox2.address);
      expect(backups).toHaveLength(0);
    } finally {
      if (mailbox2) {
        await api.delete(`${WORKER_URL}/api/delete_address`, {
          headers: { Authorization: `Bearer ${mailbox2.jwt}` },
        });
      }
      await api.dispose();
    }
  });
});
