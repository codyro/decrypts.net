import { test, expect } from '@playwright/test';
import { request as apiRequest } from '@playwright/test';
import { WORKER_URL, FRONTEND_URL } from '../../../fixtures/test-helpers';

test.describe.configure({ lock: 'user-settings' });

test.describe('Passkey Sign-up Browser Flow', () => {
  test.beforeAll(async () => {
    const api = await apiRequest.newContext();
    try {
      // Enable user registration and passkey sign-up
      await api.post(`${WORKER_URL}/admin/user_settings`, {
        data: { enable: true, enableMailVerify: false, enablePasskeySignup: true },
      });
    } finally {
      await api.dispose();
    }
  });

  test('sign up with a passkey, log out, log back in', async ({ page, context }) => {
    // The full flow (sign-up ceremony, nudge, logout, re-login ceremony) is
    // slower than the default 30s, especially on the Docker dev server.
    test.setTimeout(90_000);
    // Set up virtual authenticator via CDP
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });

    try {
      await page.goto(`${FRONTEND_URL}/en/user`);

      // === Step 1: switch to the register tab and sign up with a passkey ===
      await page.locator('.n-tabs-tab').getByText('Register', { exact: true }).click();
      const signupBtn = page.getByRole('button', { name: 'Create account with a passkey' });
      await expect(signupBtn).toBeVisible({ timeout: 15_000 });
      await signupBtn.click();

      // The virtual authenticator handles the WebAuthn ceremony automatically;
      // afterwards the user center shows the account as a passkey account.
      await expect(page.getByText('Passkey account')).toBeVisible({ timeout: 15_000 });

      // === Step 2: the one-time nudge to add a second passkey is shown ===
      await expect(page.getByText(/single passkey/i)).toBeVisible({ timeout: 15_000 });

      // === Step 3: log out ===
      await page.getByRole('button', { name: 'Logout' }).click();
      const logoutModal = page.locator('.n-dialog');
      await expect(logoutModal).toBeVisible({ timeout: 5_000 });
      await logoutModal.getByRole('button', { name: 'Logout' }).click();

      // Wait for logout to complete and navigate to the user page
      await page.goto(`${FRONTEND_URL}/en/user`);

      // === Step 4: log back in with the passkey ===
      const passkeyBtn = page.getByRole('button', { name: 'Login with Passkey' });
      await expect(passkeyBtn).toBeVisible({ timeout: 10_000 });
      await passkeyBtn.click();

      // The account still shows as "Passkey account"
      await expect(page.getByText('Passkey account')).toBeVisible({ timeout: 15_000 });
    } finally {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
      await cdp.detach();
    }
  });
});
