import { test, expect, type APIRequestContext } from '@playwright/test';
import { generateKeyPair } from '../../../frontend/src/utils/mail-crypto.js';
import {
  WORKER_URL,
  WORKER_URL_ENV_OFF,
  TEST_DOMAIN,
  createTestAddress,
  hashPassword,
  seedTestMail,
} from '../../fixtures/test-helpers';
import { createSoftCredential } from '../../fixtures/webauthn-soft-authenticator';

/**
 * "Burn account": a signed-in user can permanently delete their account and
 * every mailbox bound to it, with all their data, after fresh
 * re-authentication. Gated by ENABLE_USER_BURN_ACCOUNT (enabled on the main
 * e2e worker, left off on the env-off worker).
 */

const RP_ID = 'localhost';
const ORIGIN = 'http://localhost';
const CONFIRM_PHRASE = 'burn my account';
const PASSWORD = 'test-password-123';
const BLOB = (() => {
  const bytes = Buffer.alloc(62, 1);
  bytes[0] = 0x02;
  return bytes.toString('base64url');
})();

const unique = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

async function setUserSettings(request: APIRequestContext, base: string, settings: Record<string, unknown>) {
  const res = await request.post(`${base}/admin/user_settings`, { data: settings });
  expect(res.ok(), await res.text()).toBe(true);
}

async function createUser(request: APIRequestContext, tag: string, base: string = WORKER_URL) {
  const email = `${unique(tag)}@test.example.com`;
  const password = hashPassword(PASSWORD);
  const registerRes = await request.post(`${base}/user_api/register`, {
    data: { email, password },
  });
  expect(registerRes.ok(), await registerRes.text()).toBe(true);
  const loginRes = await request.post(`${base}/user_api/login`, { data: { email, password } });
  expect(loginRes.ok(), await loginRes.text()).toBe(true);
  const { jwt } = await loginRes.json();
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return { jwt, userId: payload.user_id as number, email };
}

async function bindAddress(request: APIRequestContext, base: string, userJwt: string, addressJwt: string) {
  const res = await request.post(`${base}/user_api/bind_address`, {
    headers: { Authorization: `Bearer ${addressJwt}`, 'x-user-token': userJwt },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function insertPasskeyRow(request: APIRequestContext, userId: number, passkeyId: string) {
  const res = await request.post(`${WORKER_URL}/__test/insert_passkey`, {
    data: { user_id: userId, passkey_id: passkeyId },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function query(request: APIRequestContext, sql: string) {
  const res = await request.get(`${WORKER_URL}/__test/query`, {
    params: { sql },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const body = await res.json();
  return body.results as Record<string, unknown>[];
}

/** Sign up a fresh passkey-only account via the public sign-up flow. */
async function signupPasskeyOnlyAccount(request: APIRequestContext) {
  const optionsRes = await request.post(`${WORKER_URL}/user_api/passkey/signup_request`, {
    data: { domain: RP_ID, cf_token: '' },
  });
  expect(optionsRes.ok(), await optionsRes.text()).toBe(true);
  const options = await optionsRes.json();
  const credential = createSoftCredential(RP_ID);
  const signupRes = await request.post(`${WORKER_URL}/user_api/passkey/signup_response`, {
    data: { origin: ORIGIN, credential: credential.attest(options.challenge, ORIGIN) },
  });
  expect(signupRes.ok(), await signupRes.text()).toBe(true);
  const { jwt } = await signupRes.json();
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return { jwt, userId: payload.user_id as number, credential };
}

/** Register a real passkey on an existing password account. */
async function registerPasskey(request: APIRequestContext, userJwt: string) {
  const optionsRes = await request.post(`${WORKER_URL}/user_api/passkey/register_request`, {
    headers: { 'x-user-token': userJwt },
    data: { domain: RP_ID },
  });
  expect(optionsRes.ok(), await optionsRes.text()).toBe(true);
  const options = await optionsRes.json();
  const credential = createSoftCredential(RP_ID);
  const registerRes = await request.post(`${WORKER_URL}/user_api/passkey/register_response`, {
    headers: { 'x-user-token': userJwt },
    data: {
      origin: ORIGIN,
      passkey_name: 'e2e-burn-passkey',
      credential: credential.attest(options.challenge, ORIGIN),
    },
  });
  expect(registerRes.ok(), await registerRes.text()).toBe(true);
  return credential;
}

async function burnChallenge(request: APIRequestContext, userJwt: string) {
  const res = await request.post(`${WORKER_URL}/user_api/burn_account/challenge`, {
    headers: { 'x-user-token': userJwt },
    data: { domain: RP_ID },
  });
  return res;
}

async function burnAccount(
  request: APIRequestContext,
  userJwt: string,
  body: Record<string, unknown>,
) {
  return request.post(`${WORKER_URL}/user_api/burn_account`, {
    headers: { 'x-user-token': userJwt },
    data: body,
  });
}

test.describe('Burn account API', () => {
  test.beforeAll(async ({ request }) => {
    await setUserSettings(request, WORKER_URL, {
      enable: true,
      enableMailVerify: false,
      enablePasskeySignup: true,
    });
  });

  test('both endpoints return 403 when the feature is disabled', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'WORKER_URL_ENV_OFF not set');
    await setUserSettings(request, WORKER_URL_ENV_OFF, { enable: true, enableMailVerify: false });
    const user = await createUser(request, 'burn-off', WORKER_URL_ENV_OFF);

    const challengeRes = await request.post(`${WORKER_URL_ENV_OFF}/user_api/burn_account/challenge`, {
      headers: { 'x-user-token': user.jwt },
      data: { domain: RP_ID },
    });
    expect(challengeRes.status()).toBe(403);

    const burnRes = await request.post(`${WORKER_URL_ENV_OFF}/user_api/burn_account`, {
      headers: { 'x-user-token': user.jwt },
      data: { confirm: CONFIRM_PHRASE, password: hashPassword(PASSWORD), origin: ORIGIN },
    });
    expect(burnRes.status()).toBe(403);
  });

  test('open_settings exposes enableBurnAccount', async ({ request }) => {
    const res = await request.get(`${WORKER_URL}/user_api/open_settings`);
    expect(res.ok()).toBe(true);
    const settings = await res.json();
    expect(settings.enableBurnAccount).toBe(true);
  });

  test('wrong confirmation phrase returns 400', async ({ request }) => {
    const user = await createUser(request, 'burn-phrase');
    const res = await burnAccount(request, user.jwt, {
      confirm: 'delete please',
      password: hashPassword(PASSWORD),
      origin: ORIGIN,
    });
    expect(res.status()).toBe(400);
    // nothing was deleted
    const settingsRes = await request.get(`${WORKER_URL}/user_api/settings`, {
      headers: { 'x-user-token': user.jwt },
    });
    expect(settingsRes.ok()).toBe(true);
  });

  test('wrong password returns 401 and deletes nothing', async ({ request }) => {
    const user = await createUser(request, 'burn-wrongpass');
    const res = await burnAccount(request, user.jwt, {
      confirm: CONFIRM_PHRASE,
      password: hashPassword('wrong-password'),
      origin: ORIGIN,
    });
    expect(res.status()).toBe(401);
    const settingsRes = await request.get(`${WORKER_URL}/user_api/settings`, {
      headers: { 'x-user-token': user.jwt },
    });
    expect(settingsRes.ok()).toBe(true);
  });

  test('password account burn deletes the user, passkeys, roles, backups, bound addresses and their mail', async ({ request }) => {
    const user = await createUser(request, 'burn-full');

    // two bound addresses; the first is encrypted so it can hold a key backup
    const { publicKey } = await generateKeyPair();
    const encName = unique('burnenc');
    const encRes = await request.post(`${WORKER_URL}/api/new_address`, {
      data: { name: encName, domain: TEST_DOMAIN, encryption_public_key: publicKey },
    });
    expect(encRes.ok(), await encRes.text()).toBe(true);
    const enc = await encRes.json();
    await bindAddress(request, WORKER_URL, user.jwt, enc.jwt);

    const plain = await createTestAddress(request, 'burnplain');
    await bindAddress(request, WORKER_URL, user.jwt, plain.jwt);

    await seedTestMail(request, enc.address, { subject: 'burn me 1' });
    await seedTestMail(request, plain.address, { subject: 'burn me 2' });

    // a registered passkey and a wrapped key backup
    const passkeyId = unique('burnpk');
    await insertPasskeyRow(request, user.userId, passkeyId);
    const backupRes = await request.put(`${WORKER_URL}/user_api/key_backups`, {
      headers: { 'x-user-token': user.jwt },
      data: { address: enc.address, key_id: publicKey, passkey_id: passkeyId, blob: BLOB },
    });
    expect(backupRes.ok(), await backupRes.text()).toBe(true);

    // a role row
    const roleRes = await request.post(`${WORKER_URL}/admin/user_roles`, {
      data: { user_id: user.userId, role_text: 'case-role' },
    });
    expect(roleRes.ok(), await roleRes.text()).toBe(true);

    const burnRes = await burnAccount(request, user.jwt, {
      confirm: CONFIRM_PHRASE,
      password: hashPassword(PASSWORD),
      origin: ORIGIN,
    });
    expect(burnRes.ok(), await burnRes.text()).toBe(true);
    const body = await burnRes.json();
    expect(body.success).toBe(true);
    expect(body.deleted_addresses.sort()).toEqual([enc.address, plain.address].sort());

    // every per-user and per-address row is gone
    expect(await query(request, `SELECT id FROM users WHERE id = ${user.userId}`)).toHaveLength(0);
    expect(await query(request, `SELECT id FROM users_address WHERE user_id = ${user.userId}`)).toHaveLength(0);
    expect(await query(request, `SELECT id FROM user_passkeys WHERE user_id = ${user.userId}`)).toHaveLength(0);
    expect(await query(request, `SELECT id FROM user_roles WHERE user_id = ${user.userId}`)).toHaveLength(0);
    expect(await query(request, `SELECT id FROM user_key_backups WHERE user_id = ${user.userId}`)).toHaveLength(0);
    for (const address of [enc.address, plain.address]) {
      expect(await query(request, `SELECT id FROM address WHERE name = '${address}'`)).toHaveLength(0);
      expect(await query(request, `SELECT id FROM raw_mails WHERE address = '${address}'`)).toHaveLength(0);
      expect(await query(request, `SELECT id FROM sendbox WHERE address = '${address}'`)).toHaveLength(0);
      expect(await query(request, `SELECT id FROM address_sender WHERE address = '${address}'`)).toHaveLength(0);
    }

    // the old user token and the address JWTs no longer work
    const settingsRes = await request.get(`${WORKER_URL}/user_api/settings`, {
      headers: { 'x-user-token': user.jwt },
    });
    expect(settingsRes.status()).toBe(400);
    for (const jwt of [enc.jwt, plain.jwt]) {
      const apiSettingsRes = await request.get(`${WORKER_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(apiSettingsRes.status()).toBe(401);
    }
  });

  test('passkey-only account burn with a valid assertion succeeds', async ({ request }) => {
    const account = await signupPasskeyOnlyAccount(request);
    const bound = await createTestAddress(request, 'burnpkonly');
    await bindAddress(request, WORKER_URL, account.jwt, bound.jwt);

    const challengeRes = await burnChallenge(request, account.jwt);
    expect(challengeRes.ok(), await challengeRes.text()).toBe(true);
    const options = await challengeRes.json();
    const ownIds = await query(
      request,
      `SELECT passkey_id FROM user_passkeys WHERE user_id = ${account.userId}`,
    );
    expect(options.allowCredentials.map((c: { id: string }) => c.id).sort())
      .toEqual(ownIds.map((r) => r.passkey_id).sort());

    const burnRes = await burnAccount(request, account.jwt, {
      confirm: CONFIRM_PHRASE,
      origin: ORIGIN,
      domain: RP_ID,
      credential: account.credential.assert(options.challenge, ORIGIN),
    });
    expect(burnRes.ok(), await burnRes.text()).toBe(true);
    const body = await burnRes.json();
    expect(body.deleted_addresses).toEqual([bound.address]);
    expect(await query(request, `SELECT id FROM users WHERE id = ${account.userId}`)).toHaveLength(0);
    expect(await query(request, `SELECT id FROM address WHERE name = '${bound.address}'`)).toHaveLength(0);
  });

  test('passkey-only burn with another user\'s passkey assertion fails', async ({ request }) => {
    const victim = await signupPasskeyOnlyAccount(request);
    const other = await signupPasskeyOnlyAccount(request);

    const challengeRes = await burnChallenge(request, victim.jwt);
    expect(challengeRes.ok(), await challengeRes.text()).toBe(true);
    const options = await challengeRes.json();

    const burnRes = await burnAccount(request, victim.jwt, {
      confirm: CONFIRM_PHRASE,
      origin: ORIGIN,
      domain: RP_ID,
      credential: other.credential.assert(options.challenge, ORIGIN),
    });
    expect(burnRes.status()).toBe(401);
    // the victim account is untouched
    const settingsRes = await request.get(`${WORKER_URL}/user_api/settings`, {
      headers: { 'x-user-token': victim.jwt },
    });
    expect(settingsRes.ok()).toBe(true);
  });

  test('password account can burn with a passkey assertion', async ({ request }) => {
    const user = await createUser(request, 'burn-passkey');
    const credential = await registerPasskey(request, user.jwt);

    const challengeRes = await burnChallenge(request, user.jwt);
    expect(challengeRes.ok(), await challengeRes.text()).toBe(true);
    const options = await challengeRes.json();

    const burnRes = await burnAccount(request, user.jwt, {
      confirm: CONFIRM_PHRASE,
      origin: ORIGIN,
      domain: RP_ID,
      credential: credential.assert(options.challenge, ORIGIN),
    });
    expect(burnRes.ok(), await burnRes.text()).toBe(true);
    expect(await query(request, `SELECT id FROM users WHERE id = ${user.userId}`)).toHaveLength(0);
  });

  test('admin deleteUser also removes user_passkeys and user_roles', async ({ request }) => {
    const user = await createUser(request, 'burn-admin');
    const passkeyId = unique('adminpk');
    await insertPasskeyRow(request, user.userId, passkeyId);
    const roleRes = await request.post(`${WORKER_URL}/admin/user_roles`, {
      data: { user_id: user.userId, role_text: 'case-role' },
    });
    expect(roleRes.ok(), await roleRes.text()).toBe(true);

    const deleteRes = await request.delete(`${WORKER_URL}/admin/users/${user.userId}`);
    expect(deleteRes.ok(), await deleteRes.text()).toBe(true);

    expect(await query(request, `SELECT id FROM users WHERE id = ${user.userId}`)).toHaveLength(0);
    expect(await query(request, `SELECT id FROM user_passkeys WHERE user_id = ${user.userId}`)).toHaveLength(0);
    expect(await query(request, `SELECT id FROM user_roles WHERE user_id = ${user.userId}`)).toHaveLength(0);
    // the old token no longer lists passkeys
    const passkeysRes = await request.get(`${WORKER_URL}/user_api/passkey`, {
      headers: { 'x-user-token': user.jwt },
    });
    expect(passkeysRes.ok()).toBe(true);
    expect(await passkeysRes.json()).toEqual([]);
  });
});
