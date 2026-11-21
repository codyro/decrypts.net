import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { WORKER_URL } from '../../fixtures/test-helpers';
import { createSoftCredential } from '../../fixtures/webauthn-soft-authenticator';

const RP_ID = 'localhost';
const ORIGIN = 'http://localhost';
const PASSKEY_ONLY_EMAIL_DOMAIN = 'passkey.invalid';

async function setUserSettings(
  request: APIRequestContext,
  settings: Record<string, unknown>,
): Promise<void> {
  const res = await request.post(`${WORKER_URL}/admin/user_settings`, { data: settings });
  expect(res.ok(), await res.text()).toBe(true);
}

async function signupRequest(request: APIRequestContext) {
  return await request.post(`${WORKER_URL}/user_api/passkey/signup_request`, {
    data: { domain: RP_ID, cf_token: '' },
  });
}

test.describe('Passkey Sign-up API', () => {
  test.beforeAll(async ({ request }) => {
    await setUserSettings(request, {
      enable: true,
      enableMailVerify: false,
      enablePasskeySignup: true,
    });
  });

  test('open_settings exposes enablePasskeySignup', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/user_api/open_settings`);
    expect(res.ok()).toBe(true);
    const settings = await res.json();
    expect(settings.enable).toBe(true);
    expect(settings.enablePasskeySignup).toBe(true);
  });

  test('signup_request returns 403 when the setting is off', async ({ request }) => {
    await setUserSettings(request, {
      enable: true,
      enableMailVerify: false,
      enablePasskeySignup: false,
    });
    try {
      const res = await signupRequest(request);
      expect(res.status()).toBe(403);
    } finally {
      await setUserSettings(request, {
        enable: true,
        enableMailVerify: false,
        enablePasskeySignup: true,
      });
    }
  });

  test('signup_request returns discoverable-credential registration options', async ({ request }) => {
    const res = await signupRequest(request);
    expect(res.ok(), await res.text()).toBe(true);
    const options = await res.json();
    expect(options.rp.id).toBe(RP_ID);
    expect(options.challenge).toBeTruthy();
    // no email: the user name is a neutral label
    expect(options.user.name).not.toContain('@');
    expect(options.authenticatorSelection.residentKey).toBe('required');
    expect(options.authenticatorSelection.userVerification).toBe('preferred');
    expect(options.extensions?.prf).toBeDefined();
  });

  test('signup_response creates a passkey-only account and logs in', async ({ request }) => {
    const optionsRes = await signupRequest(request);
    const options = await optionsRes.json();
    const credential = createSoftCredential(RP_ID);

    const res = await request.post(`${WORKER_URL}/user_api/passkey/signup_response`, {
      data: {
        origin: ORIGIN,
        credential: credential.attest(options.challenge, ORIGIN),
      },
    });
    expect(res.ok(), await res.text()).toBe(true);
    const { jwt } = await res.json();
    expect(jwt).toBeTruthy();
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
    expect(payload.user_email.endsWith(`@${PASSKEY_ONLY_EMAIL_DOMAIN}`)).toBe(true);

    // the account shows up in the admin user list with its pseudo-email
    const usersRes = await request.get(
      `${WORKER_URL}/admin/users?query=${encodeURIComponent(`@${PASSKEY_ONLY_EMAIL_DOMAIN}`)}&limit=20&offset=0`,
    );
    expect(usersRes.ok()).toBe(true);
    const { results } = await usersRes.json();
    expect(
      results.some((row: { user_email: string }) => row.user_email === payload.user_email),
    ).toBe(true);
  });

  test('.invalid emails are rejected by register, verify_code and login', async ({ request }) => {
    const pseudoEmail = `pk-deadbeefdeadbeefdeadbeef@${PASSKEY_ONLY_EMAIL_DOMAIN}`;

    const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
      data: { email: pseudoEmail, password: 'whatever-password-123' },
    });
    expect(registerRes.status()).toBe(400);

    const verifyRes = await request.post(`${WORKER_URL}/user_api/verify_code`, {
      data: { email: pseudoEmail, cf_token: '' },
    });
    expect(verifyRes.status()).toBe(400);

    const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
      data: { email: pseudoEmail, password: 'whatever-password-123' },
    });
    expect(loginRes.status()).toBe(400);
  });

  test('deleting the last passkey of a passkey-only account is refused', async ({ request }) => {
    // create a genuine passkey-only account via the public sign-up flow
    const optionsRes = await signupRequest(request);
    const options = await optionsRes.json();
    const first = createSoftCredential(RP_ID);
    const signupRes = await request.post(`${WORKER_URL}/user_api/passkey/signup_response`, {
      data: { origin: ORIGIN, credential: first.attest(options.challenge, ORIGIN) },
    });
    expect(signupRes.ok(), await signupRes.text()).toBe(true);
    const { jwt } = await signupRes.json();

    // deleting the only passkey must be refused
    const deleteRes = await request.delete(
      `${WORKER_URL}/user_api/passkey/${encodeURIComponent(first.credentialId)}`,
      { headers: { 'x-user-token': jwt } },
    );
    expect(deleteRes.status()).toBe(400);

    // add a second passkey; deleting the first one is allowed again
    const registerOptionsRes = await request.post(
      `${WORKER_URL}/user_api/passkey/register_request`,
      { headers: { 'x-user-token': jwt }, data: { domain: RP_ID } },
    );
    expect(registerOptionsRes.ok()).toBe(true);
    const registerOptions = await registerOptionsRes.json();
    const second = createSoftCredential(RP_ID);
    const registerRes = await request.post(`${WORKER_URL}/user_api/passkey/register_response`, {
      headers: { 'x-user-token': jwt },
      data: {
        origin: ORIGIN,
        passkey_name: 'second passkey',
        credential: second.attest(registerOptions.challenge, ORIGIN),
      },
    });
    expect(registerRes.ok(), await registerRes.text()).toBe(true);

    const deleteFirstRes = await request.delete(
      `${WORKER_URL}/user_api/passkey/${encodeURIComponent(first.credentialId)}`,
      { headers: { 'x-user-token': jwt } },
    );
    expect(deleteFirstRes.ok(), await deleteFirstRes.text()).toBe(true);

    // and the remaining passkey can log in (authenticate_response round trip)
    const authOptionsRes = await request.post(`${WORKER_URL}/user_api/passkey/authenticate_request`, {
      data: { domain: RP_ID },
    });
    const authOptions = await authOptionsRes.json();
    const authRes = await request.post(`${WORKER_URL}/user_api/passkey/authenticate_response`, {
      data: {
        domain: RP_ID,
        origin: ORIGIN,
        credential: second.assert(authOptions.challenge, ORIGIN),
      },
    });
    expect(authRes.ok(), await authRes.text()).toBe(true);
    const authBody = await authRes.json();
    expect(authBody.jwt).toBeTruthy();
  });
});
