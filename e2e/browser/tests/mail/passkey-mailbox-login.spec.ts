import { test, expect, request as apiRequest, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { generateKeyPair } from '../../../../frontend/src/utils/mail-crypto.js';
import {
  FRONTEND_URL,
  WORKER_URL,
  TEST_DOMAIN,
  seedTestMail,
} from '../../../fixtures/test-helpers';

/**
 * Mailbox-level passkey login, browser side.
 *
 * Requires the default E2E worker (ENABLE_MAIL_ENCRYPTION=true), its HTTPS
 * frontend (WebAuthn needs a secure context) and a CDP virtual authenticator
 * with PRF (hasPrf: true). Scenarios:
 *   (a) guided "Use a passkey for this mailbox" on an encrypted mailbox:
 *       passkey-only sign-up -> link -> passkey backup from the pasted
 *       decryption link; then a simulated new device (local storage and
 *       IndexedDB cleared, authenticator kept) logs in with the passkey from
 *       the Login tab, opens the mailbox and unlocks it via the passkey
 *       backup — a seeded encrypted mail decrypts;
 *   (b) a fresh passkey account with no linked mailboxes gets the
 *       explanation and a shortcut to the Create tab.
 */

const PRF_AUTHENTICATOR = {
  protocol: 'ctap2',
  transport: 'internal',
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  hasPrf: true,
};

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function addPrfAuthenticator(cdp: CDPSession) {
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: PRF_AUTHENTICATOR,
  });
  return authenticatorId;
}

/** Simulate a new device: drop every local trace, keep the authenticator. */
async function clearLocalDeviceState(page: Page) {
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
}

test.describe('Passkey mailbox login (browser)', () => {
  test.describe.configure({ mode: 'serial', lock: 'user-settings' });

  test('(a) guided setup, then passkey login on a new device unlocks the mailbox', async ({ browser }) => {
    test.setTimeout(300_000);
    const api = await apiRequest.newContext();
    const mailbox = { jwt: '', address: '', address_id: 0 };
    let decryptionLink = '';
    const seededSubject = `Passkey mailbox mail ${Date.now()}`;
    let context: BrowserContext | null = null;
    try {
      // Enable user registration and passkey-only sign-up (idempotent KV setting).
      await api.post(`${WORKER_URL}/admin/user_settings`, {
        data: { enable: true, enableMailVerify: false, enablePasskeySignup: true },
      });
      // Encrypted mailbox created via API: the test knows the raw key and
      // hands it to the setup dialog as the saved decryption link.
      const keyPair = await generateKeyPair();
      const res = await api.post(`${WORKER_URL}/api/new_address`, {
        data: {
          name: uniqueId('pkmail'),
          domain: TEST_DOMAIN,
          encryption_public_key: keyPair.publicKey,
        },
      });
      if (!res.ok()) throw new Error(`new_address failed: ${res.status()} ${await res.text()}`);
      const body = await res.json();
      mailbox.jwt = body.jwt;
      mailbox.address = body.address;
      mailbox.address_id = body.address_id;
      decryptionLink = `#k=${keyPair.privateKey}&a=${mailbox.address}`;

      context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      await addPrfAuthenticator(cdp);

      // === 1: open the encrypted mailbox on the "old" device ===
      await page.goto(`${FRONTEND_URL}/en/?jwt=${mailbox.jwt}`);
      await page.getByText('Mailbox Settings', { exact: true }).click();
      await page.getByTestId('use-passkey-for-mailbox').click();
      const dialog = page.getByTestId('passkey-mailbox-setup');
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      // === 2: step 01 — create a passkey account (no email) ===
      const signupButton = dialog.getByTestId('setup-passkey-signup');
      await expect(signupButton).toBeVisible({ timeout: 15_000 });
      await signupButton.click();
      await expect(dialog.getByTestId('setup-step-signin')).toContainText('✓', { timeout: 30_000 });

      // === 3: step 02 — link this mailbox to the new account ===
      const linkButton = dialog.getByTestId('setup-link-mailbox');
      await expect(linkButton).toBeVisible({ timeout: 15_000 });
      await linkButton.click();
      await expect(dialog.getByTestId('setup-step-link')).toContainText('✓', { timeout: 30_000 });

      // === 4: step 03 — add a passkey backup from the saved decryption link ===
      const backupInput = dialog.getByTestId('setup-backup-input');
      await expect(backupInput).toBeVisible({ timeout: 15_000 });
      await backupInput.locator('textarea').fill(decryptionLink);
      await dialog.getByTestId('setup-add-backup').click();
      await expect(dialog.getByTestId('setup-outcome'))
        .toContainText('can unlock this mailbox on other devices', { timeout: 60_000 });

      // Seed an encrypted mail for the new-device assertion below.
      await seedTestMail(api, mailbox.address, { subject: seededSubject, text: 'passkey mailbox body' });

      // === 5: simulate a new device — everything local cleared, passkey kept ===
      await clearLocalDeviceState(page);

      // === 6: "Log in with passkey" on the Login tab opens the mailbox ===
      await page.goto(`${FRONTEND_URL}/en/`);
      await page.locator('.n-tabs-tab').getByText('Log In to Mailbox', { exact: true }).click();
      const passkeyButton = page.getByTestId('passkey-login-button');
      await expect(passkeyButton).toBeVisible({ timeout: 15_000 });
      await passkeyButton.click();
      // Exactly one linked mailbox -> opened directly.
      await expect(page.getByText('Mailbox Settings', { exact: true }))
        .toBeVisible({ timeout: 60_000 });

      // === 7: the inline prompt restores the key from the passkey backup ===
      const banner = page.getByTestId('passkey-unlock-restore');
      await expect(banner).toBeVisible({ timeout: 30_000 });
      await banner.getByTestId('passkey-unlock-button').click();
      await expect(page.getByText('Decryption key restored from the passkey backup'))
        .toBeVisible({ timeout: 60_000 });

      // === 8: the seeded encrypted mail decrypts ===
      await page.getByText('Inbox', { exact: true }).click();
      await expect(page.locator('.mail-summary-subject').first())
        .toContainText(seededSubject, { timeout: 30_000 });
    } finally {
      await api.dispose();
      if (mailbox.jwt) {
        const cleanup = await apiRequest.newContext();
        try {
          await cleanup.delete(`${WORKER_URL}/api/delete_address`, {
            headers: { Authorization: `Bearer ${mailbox.jwt}` },
          });
        } finally {
          await cleanup.dispose();
        }
      }
      if (context) await context.close();
    }
  });

  test('(b) passkey login with no linked mailboxes explains and offers the Create tab', async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      await addPrfAuthenticator(cdp);

      // A fresh passkey-only account, then log out again.
      await page.goto(`${FRONTEND_URL}/en/user`);
      await page.locator('.n-tabs-tab').getByText('Register', { exact: true }).click();
      await page.getByRole('button', { name: 'Create account with a passkey' }).click();
      await expect(page.getByText('Passkey account')).toBeVisible({ timeout: 30_000 });
      await page.getByRole('button', { name: 'Logout' }).click();
      const logoutModal = page.locator('.n-dialog');
      await expect(logoutModal).toBeVisible({ timeout: 5_000 });
      await logoutModal.getByRole('button', { name: 'Logout' }).click();
      // Logout reloads the page; wait for that navigation before moving on.
      await page.waitForLoadState('load');

      // Log in with the passkey from the mailbox Login tab: no linked mailboxes.
      await page.goto(`${FRONTEND_URL}/en/`);
      await page.locator('.n-tabs-tab').getByText('Log In to Mailbox', { exact: true }).click();
      const passkeyButton = page.getByTestId('passkey-login-button');
      await expect(passkeyButton).toBeVisible({ timeout: 15_000 });
      await passkeyButton.click();
      const noneAlert = page.getByTestId('passkey-login-none');
      await expect(noneAlert).toBeVisible({ timeout: 30_000 });
      await expect(noneAlert).toContainText('no mailboxes are linked to this account yet');

      // The offered shortcut leads to mailbox creation: with no Login card
      // mounted after the sign-in, that is the user center; its address
      // management tab holds the "Add Mailbox" creation card.
      await noneAlert.getByTestId('passkey-login-none-create').click();
      await expect(page).toHaveURL(/\/en\/user/, { timeout: 15_000 });
      await page.locator('.n-tabs-tab').getByText('Mailbox Management', { exact: true }).click();
      await expect(page.locator('.n-tabs-tab').getByText('Add Mailbox', { exact: true }))
        .toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });
});
