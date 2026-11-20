import { test, expect, type APIRequestContext } from '@playwright/test';
import { generateKeyPair } from '../../../frontend/src/utils/mail-crypto.js';
import {
  WORKER_URL,
  WORKER_URL_ENV_OFF,
  TEST_DOMAIN,
  createTestAddress,
  deleteAddress,
  hashPassword,
} from '../../fixtures/test-helpers';

/**
 * Passkey (WebAuthn PRF) wrapped key backups (Phase 3a, worker storage API).
 *
 * Runs against the default worker (ENABLE_MAIL_ENCRYPTION=true) and the
 * env-off worker (WORKER_URL_ENV_OFF) for the feature-disabled case. The
 * worker only ever stores the opaque wrapped blob; these tests verify the
 * API contract, validation, caps and cleanup hooks.
 */

const BLOB_VERSION = 0x02;
const MIN_BLOB_BYTES = 62;

/** base64url blob with the given version byte and decoded length */
function makeBlob(version = BLOB_VERSION, length = MIN_BLOB_BYTES): string {
  const bytes = Buffer.alloc(length, 1);
  bytes[0] = version;
  return bytes.toString('base64url');
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function createUser(request: APIRequestContext, tag: string) {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.example.com`;
  const password = hashPassword('test-password-123');

  const registerRes = await request.post(`${WORKER_URL}/user_api/register`, {
    data: { email, password },
  });
  expect(registerRes.ok(), await registerRes.text()).toBe(true);

  const loginRes = await request.post(`${WORKER_URL}/user_api/login`, {
    data: { email, password },
  });
  expect(loginRes.ok()).toBe(true);
  const { jwt } = await loginRes.json();
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
  return { jwt, userId: payload.user_id as number };
}

/** Create an address with an encryption public key and bind it to the user. */
async function createBoundEncryptedAddress(
  request: APIRequestContext,
  userJwt: string,
  name: string,
): Promise<{ jwt: string; address: string; address_id: number; publicKey: string }> {
  const { publicKey } = await generateKeyPair();
  const uniqueName = `${name}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post(`${WORKER_URL}/api/new_address`, {
    data: { name: uniqueName, domain: TEST_DOMAIN, encryption_public_key: publicKey },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const body = await res.json();
  const bindRes = await request.post(`${WORKER_URL}/user_api/bind_address`, {
    headers: { Authorization: `Bearer ${body.jwt}`, 'x-user-token': userJwt },
  });
  expect(bindRes.ok(), await bindRes.text()).toBe(true);
  return { jwt: body.jwt, address: body.address, address_id: body.address_id, publicKey };
}

async function createBoundPlainAddress(
  request: APIRequestContext,
  userJwt: string,
  name: string,
): Promise<{ jwt: string; address: string; address_id: number }> {
  const created = await createTestAddress(request, name);
  const bindRes = await request.post(`${WORKER_URL}/user_api/bind_address`, {
    headers: { Authorization: `Bearer ${created.jwt}`, 'x-user-token': userJwt },
  });
  expect(bindRes.ok(), await bindRes.text()).toBe(true);
  return created;
}

/** Register a passkey row for the user via the test-only fixture helper. */
async function insertPasskey(request: APIRequestContext, userId: number, passkeyId: string): Promise<void> {
  const res = await request.post(`${WORKER_URL}/__test/insert_passkey`, {
    data: { user_id: userId, passkey_id: passkeyId },
  });
  expect(res.ok(), await res.text()).toBe(true);
}

async function getBackups(request: APIRequestContext, userJwt: string, address: string) {
  const res = await request.get(`${WORKER_URL}/user_api/key_backups`, {
    headers: { 'x-user-token': userJwt },
    params: { address },
  });
  return res;
}

async function putBackup(
  request: APIRequestContext,
  userJwt: string,
  data: { address: string; key_id: string; passkey_id: string; blob: string },
) {
  return request.put(`${WORKER_URL}/user_api/key_backups`, {
    headers: { 'x-user-token': userJwt },
    data,
  });
}

test.describe('Passkey wrapped key backups', () => {
  test.describe.configure({ mode: 'serial' });

  let userA: { jwt: string; userId: number };
  let userB: { jwt: string; userId: number };
  let backupsA: { address: string; address_id: number; publicKey: string; jwt: string };

  test.beforeAll(async ({ request }) => {
    // Make sure user registration is enabled (idempotent KV setting).
    const settingsRes = await request.get(`${WORKER_URL}/admin/user_settings`);
    expect(settingsRes.ok()).toBe(true);
    await request.post(`${WORKER_URL}/admin/user_settings`, {
      data: { ...(await settingsRes.json()), enable: true, enableMailVerify: false, maxAddressCount: 0 },
    });

    userA = await createUser(request, 'keybak-a');
    userB = await createUser(request, 'keybak-b');
    backupsA = await createBoundEncryptedAddress(request, userA.jwt, 'kb-main');
  });

  test('requires a valid user token on all endpoints', async ({ request }) => {
    const noTokenGet = await request.get(`${WORKER_URL}/user_api/key_backups`, {
      params: { address: backupsA.address },
    });
    expect(noTokenGet.status()).toBe(401);

    const badTokenGet = await request.get(`${WORKER_URL}/user_api/key_backups`, {
      headers: { 'x-user-token': 'bogus-token' },
      params: { address: backupsA.address },
    });
    expect(badTokenGet.status()).toBe(401);

    const noTokenPut = await request.put(`${WORKER_URL}/user_api/key_backups`, {
      data: { address: backupsA.address, key_id: 'x', passkey_id: 'y', blob: 'z' },
    });
    expect(noTokenPut.status()).toBe(401);

    const noTokenDelete = await request.delete(`${WORKER_URL}/user_api/key_backups/1`);
    expect(noTokenDelete.status()).toBe(401);
  });

  test('returns 400 when mail encryption is disabled', async ({ request }) => {
    test.skip(!WORKER_URL_ENV_OFF, 'env-off worker not configured');
    // the env-off worker has its own JWT secret and database: create a user
    // directly against it so the request reaches the endpoint logic
    const settingsRes = await request.get(`${WORKER_URL_ENV_OFF}/admin/user_settings`);
    expect(settingsRes.ok()).toBe(true);
    await request.post(`${WORKER_URL_ENV_OFF}/admin/user_settings`, {
      data: { ...(await settingsRes.json()), enable: true, enableMailVerify: false },
    });
    const email = `keybak-envoff-${Date.now()}@test.example.com`;
    const password = hashPassword('test-password-123');
    const registerRes = await request.post(`${WORKER_URL_ENV_OFF}/user_api/register`, {
      data: { email, password },
    });
    expect(registerRes.ok(), await registerRes.text()).toBe(true);
    const loginRes = await request.post(`${WORKER_URL_ENV_OFF}/user_api/login`, {
      data: { email, password },
    });
    expect(loginRes.ok()).toBe(true);
    const { jwt } = await loginRes.json();

    const getRes = await request.get(`${WORKER_URL_ENV_OFF}/user_api/key_backups`, {
      headers: { 'x-user-token': jwt },
      params: { address: 'any@test.example.com' },
    });
    expect(getRes.status()).toBe(400);

    const putRes = await request.put(`${WORKER_URL_ENV_OFF}/user_api/key_backups`, {
      headers: { 'x-user-token': jwt },
      data: { address: 'any@test.example.com', key_id: 'x', passkey_id: 'y', blob: makeBlob() },
    });
    expect(putRes.status()).toBe(400);
  });

  test('rejects an address that is not bound to the user', async ({ request }) => {
    const foreign = await createTestAddress(request, 'keybak-foreign');
    try {
      const putRes = await putBackup(request, userA.jwt, {
        address: foreign.address,
        key_id: backupsA.publicKey,
        passkey_id: 'any-passkey',
        blob: makeBlob(),
      });
      expect(putRes.status()).toBe(400);

      const getRes = await getBackups(request, userA.jwt, foreign.address);
      expect(getRes.status()).toBe(400);
    } finally {
      await deleteAddress(request, foreign.jwt);
    }

    // A bound address of user B is also rejected for user A.
    const putRes = await putBackup(request, userA.jwt, {
      address: 'someone-else@test.example.com',
      key_id: backupsA.publicKey,
      passkey_id: 'any-passkey',
      blob: makeBlob(),
    });
    expect(putRes.status()).toBe(400);
  });

  test('rejects an address without an encryption public key', async ({ request }) => {
    const plain = await createBoundPlainAddress(request, userA.jwt, 'kb-plain');
    try {
      const putRes = await putBackup(request, userA.jwt, {
        address: plain.address,
        key_id: backupsA.publicKey,
        passkey_id: 'any-passkey',
        blob: makeBlob(),
      });
      expect(putRes.status()).toBe(400);
    } finally {
      await deleteAddress(request, plain.jwt);
    }
  });

  test('rejects invalid key_id, foreign passkey_id and malformed blobs', async ({ request }) => {
    const passkeyId = uniqueId('pk-invalid');
    await insertPasskey(request, userA.userId, passkeyId);

    const cases: { data: any; name: string }[] = [
      { name: 'invalid key_id', data: { address: backupsA.address, key_id: 'not-a-key', passkey_id: passkeyId, blob: makeBlob() } },
      { name: 'passkey not owned by user', data: { address: backupsA.address, key_id: backupsA.publicKey, passkey_id: uniqueId('pk-other-user'), blob: makeBlob() } },
      { name: 'wrong version byte', data: { address: backupsA.address, key_id: backupsA.publicKey, passkey_id: passkeyId, blob: makeBlob(0x01) } },
      { name: 'blob too short', data: { address: backupsA.address, key_id: backupsA.publicKey, passkey_id: passkeyId, blob: makeBlob(BLOB_VERSION, MIN_BLOB_BYTES - 1) } },
      { name: 'blob too long', data: { address: backupsA.address, key_id: backupsA.publicKey, passkey_id: passkeyId, blob: makeBlob(BLOB_VERSION, 4097) } },
      { name: 'non-base64url blob', data: { address: backupsA.address, key_id: backupsA.publicKey, passkey_id: passkeyId, blob: `${makeBlob().slice(0, -1)}+` } },
      { name: 'non-string blob', data: { address: backupsA.address, key_id: backupsA.publicKey, passkey_id: passkeyId, blob: 12345 } },
      { name: 'missing fields', data: { address: backupsA.address, key_id: backupsA.publicKey } },
    ];
    for (const { name, data } of cases) {
      const res = await putBackup(request, userA.jwt, data);
      expect(res.status(), name).toBe(400);
    }

    // nothing was stored
    const getRes = await getBackups(request, userA.jwt, backupsA.address);
    expect(getRes.ok()).toBe(true);
    expect(await getRes.json()).toEqual([]);
  });

  test('stores a valid backup, returns it unchanged, and a second PUT replaces it', async ({ request }) => {
    const passkeyId = uniqueId('pk-roundtrip');
    await insertPasskey(request, userA.userId, passkeyId);
    const blob = makeBlob(BLOB_VERSION, 200);

    const putRes = await putBackup(request, userA.jwt, {
      address: backupsA.address,
      key_id: backupsA.publicKey,
      passkey_id: passkeyId,
      blob,
    });
    expect(putRes.ok(), await putRes.text()).toBe(true);

    const getRes = await getBackups(request, userA.jwt, backupsA.address);
    expect(getRes.ok()).toBe(true);
    const rows = await getRes.json();
    expect(rows).toHaveLength(1);
    // opaque round trip: the blob comes back byte-for-byte identical
    expect(rows[0]).toEqual({
      id: expect.any(Number),
      address: backupsA.address,
      key_id: backupsA.publicKey,
      passkey_id: passkeyId,
      blob,
      created_at: expect.any(String),
      updated_at: expect.any(String),
    });

    // upsert the same tuple with a new blob: count stays 1, blob is replaced
    const replacement = makeBlob(BLOB_VERSION, 300);
    await new Promise(resolve => setTimeout(resolve, 1100)); // ensure updated_at advances (1s resolution)
    const putRes2 = await putBackup(request, userA.jwt, {
      address: backupsA.address,
      key_id: backupsA.publicKey,
      passkey_id: passkeyId,
      blob: replacement,
    });
    expect(putRes2.ok(), await putRes2.text()).toBe(true);

    const rows2 = await (await getBackups(request, userA.jwt, backupsA.address)).json();
    expect(rows2).toHaveLength(1);
    expect(rows2[0].blob).toBe(replacement);
    expect(rows2[0].id).toBe(rows[0].id);
    expect(rows2[0].created_at).toBe(rows[0].created_at);
    expect(rows2[0].updated_at).not.toBe(rows[0].updated_at);
  });

  test('enforces the per-address cap of 20 backups', async ({ request }) => {
    const bound = await createBoundEncryptedAddress(request, userA.jwt, 'kb-cap');
    const passkeyId = uniqueId('pk-cap');
    await insertPasskey(request, userA.userId, passkeyId);
    try {
      // 20 distinct key_ids wrapped with the same passkey fill the address
      for (let i = 0; i < 20; i++) {
        const { publicKey } = await generateKeyPair();
        const res = await putBackup(request, userA.jwt, {
          address: bound.address,
          key_id: publicKey,
          passkey_id: passkeyId,
          blob: makeBlob(),
        });
        expect(res.ok(), `backup ${i}`).toBe(true);
      }
      const rows = await (await getBackups(request, userA.jwt, bound.address)).json();
      expect(rows).toHaveLength(20);

      // upserting an existing tuple is still allowed over the cap
      const upsertRes = await putBackup(request, userA.jwt, {
        address: bound.address,
        key_id: rows[0].key_id,
        passkey_id: rows[0].passkey_id,
        blob: makeBlob(BLOB_VERSION, 128),
      });
      expect(upsertRes.ok()).toBe(true);
      expect(await (await getBackups(request, userA.jwt, bound.address)).json()).toHaveLength(20);

      // a brand-new tuple is rejected
      const { publicKey } = await generateKeyPair();
      const overRes = await putBackup(request, userA.jwt, {
        address: bound.address,
        key_id: publicKey,
        passkey_id: passkeyId,
        blob: makeBlob(),
      });
      expect(overRes.status()).toBe(409);
    } finally {
      await deleteAddress(request, bound.jwt);
    }
  });

  test('enforces the per-user cap of 200 backups', async ({ request }) => {
    const capUser = await createUser(request, 'keybak-capuser');
    const passkeyId = uniqueId('pk-usercap');
    await insertPasskey(request, capUser.userId, passkeyId);
    const addresses: Awaited<ReturnType<typeof createBoundEncryptedAddress>>[] = [];
    try {
      // 10 addresses x 20 backups (distinct key_ids, same passkey) = 200 rows;
      // the addresses stay bound because deleting an address removes its rows
      for (let a = 0; a < 10; a++) {
        const bound = await createBoundEncryptedAddress(request, capUser.jwt, `keybak-cap${a}`);
        addresses.push(bound);
        for (let i = 0; i < 20; i++) {
          const { publicKey: realKey } = await generateKeyPair();
          const res = await putBackup(request, capUser.jwt, {
            address: bound.address,
            key_id: realKey,
            passkey_id: passkeyId,
            blob: makeBlob(),
          });
          expect(res.ok(), `backup ${a}/${i}`).toBe(true);
        }
      }
      const countRes = await request.get(`${WORKER_URL}/__test/query`, {
        params: { sql: `SELECT COUNT(*) AS count FROM user_key_backups WHERE user_id = ${capUser.userId}` },
      });
      expect((await countRes.json()).results[0].count).toBe(200);

      // the 201st backup (new address, new key) is rejected
      const extra = await createBoundEncryptedAddress(request, capUser.jwt, 'kb-over');
      addresses.push(extra);
      const { publicKey: extraKey } = await generateKeyPair();
      const overRes = await putBackup(request, capUser.jwt, {
        address: extra.address,
        key_id: extraKey,
        passkey_id: passkeyId,
        blob: makeBlob(),
      });
      expect(overRes.status()).toBe(409);
    } finally {
      for (const bound of addresses) {
        await deleteAddress(request, bound.jwt);
      }
    }
  });

  test('isolated between users', async ({ request }) => {
    const passkeyId = uniqueId('pk-iso');
    await insertPasskey(request, userA.userId, passkeyId);
    const putRes = await putBackup(request, userA.jwt, {
      address: backupsA.address,
      key_id: backupsA.publicKey,
      passkey_id: passkeyId,
      blob: makeBlob(BLOB_VERSION, 400),
    });
    expect(putRes.ok()).toBe(true);
    const rows = await (await getBackups(request, userA.jwt, backupsA.address)).json();
    const rowId = rows.find((r: any) => r.passkey_id === passkeyId).id;
    const beforeCount = rows.length;

    // user B cannot read user A's rows (address not bound to B either)
    const getRes = await getBackups(request, userB.jwt, backupsA.address);
    expect(getRes.status()).toBe(400);

    // user B cannot delete user A's row (DELETE is scoped by user)
    const delRes = await request.delete(`${WORKER_URL}/user_api/key_backups/${rowId}`, {
      headers: { 'x-user-token': userB.jwt },
    });
    expect(delRes.ok()).toBe(true); // mirrors deletePassKey silent success
    const rowsAfter = await (await getBackups(request, userA.jwt, backupsA.address)).json();
    expect(rowsAfter).toHaveLength(beforeCount);
    expect(rowsAfter.find((r: any) => r.id === rowId)).toBeDefined();

    // user A can delete their own row
    const ownDel = await request.delete(`${WORKER_URL}/user_api/key_backups/${rowId}`, {
      headers: { 'x-user-token': userA.jwt },
    });
    expect(ownDel.ok()).toBe(true);
    const rowsFinal = await (await getBackups(request, userA.jwt, backupsA.address)).json();
    expect(rowsFinal.find((r: any) => r.id === rowId)).toBeUndefined();
  });

  test('register_request asks for the WebAuthn PRF extension without touching login', async ({ request }) => {
    const res = await request.post(`${WORKER_URL}/user_api/passkey/register_request`, {
      headers: { 'x-user-token': userA.jwt },
      data: { domain: 'localhost' },
    });
    expect(res.ok()).toBe(true);
    const options = await res.json();
    expect(options.extensions?.prf).toBeDefined();
    // credProps from SimpleWebAuthn is preserved
    expect(options.extensions?.credProps).toBe(true);

    // authentication options are unchanged (no PRF requested at login)
    const authRes = await request.post(`${WORKER_URL}/user_api/passkey/authenticate_request`, {
      data: { domain: 'localhost' },
    });
    expect(authRes.ok()).toBe(true);
    const authOptions = await authRes.json();
    expect(authOptions.rpId).toBe('localhost');
    expect(authOptions.extensions?.prf).toBeUndefined();
  });

  test('deleting the passkey removes its backups', async ({ request }) => {
    const passkeyId = uniqueId('pk-cleanup');
    await insertPasskey(request, userA.userId, passkeyId);
    await putBackup(request, userA.jwt, {
      address: backupsA.address,
      key_id: backupsA.publicKey,
      passkey_id: passkeyId,
      blob: makeBlob(BLOB_VERSION, 500),
    });
    let rows = await (await getBackups(request, userA.jwt, backupsA.address)).json();
    expect(rows.find((r: any) => r.passkey_id === passkeyId)).toBeDefined();

    const delRes = await request.delete(`${WORKER_URL}/user_api/passkey/${encodeURIComponent(passkeyId)}`, {
      headers: { 'x-user-token': userA.jwt },
    });
    expect(delRes.ok()).toBe(true);

    rows = await (await getBackups(request, userA.jwt, backupsA.address)).json();
    expect(rows.find((r: any) => r.passkey_id === passkeyId)).toBeUndefined();
  });

  test('unbinding the address removes the backups', async ({ request }) => {
    const bound = await createBoundEncryptedAddress(request, userA.jwt, 'kb-unbind');
    const passkeyId = uniqueId('pk-unbind');
    await insertPasskey(request, userA.userId, passkeyId);
    await putBackup(request, userA.jwt, {
      address: bound.address,
      key_id: bound.publicKey,
      passkey_id: passkeyId,
      blob: makeBlob(BLOB_VERSION, 600),
    });

    const unbindRes = await request.post(`${WORKER_URL}/user_api/unbind_address`, {
      headers: { 'x-user-token': userA.jwt },
      data: { address_id: bound.address_id },
    });
    expect(unbindRes.ok(), await unbindRes.text()).toBe(true);

    // the user lost access; their rows for this address are gone
    const getRes = await getBackups(request, userA.jwt, bound.address);
    expect(getRes.status()).toBe(400);
    const queryRes = await request.get(`${WORKER_URL}/__test/query`, {
      params: { sql: `SELECT COUNT(*) AS count FROM user_key_backups WHERE user_id = ${userA.userId} AND address = '${bound.address}'` },
    });
    const { results } = await queryRes.json();
    expect(results[0].count).toBe(0);

    await deleteAddress(request, bound.jwt);
  });

  test('deleting the address removes the backups', async ({ request }) => {
    const bound = await createBoundEncryptedAddress(request, userA.jwt, 'kb-deladdr');
    const passkeyId = uniqueId('pk-deladdr');
    await insertPasskey(request, userA.userId, passkeyId);
    await putBackup(request, userA.jwt, {
      address: bound.address,
      key_id: bound.publicKey,
      passkey_id: passkeyId,
      blob: makeBlob(BLOB_VERSION, 700),
    });

    await deleteAddress(request, bound.jwt);

    const queryRes = await request.get(`${WORKER_URL}/__test/query`, {
      params: { sql: `SELECT COUNT(*) AS count FROM user_key_backups WHERE address = '${bound.address}'` },
    });
    const { results } = await queryRes.json();
    expect(results[0].count).toBe(0);
  });

  test('deleting the user removes the backups', async ({ request }) => {
    const user = await createUser(request, 'keybak-deluser');
    // users.id is a SQLite rowid without AUTOINCREMENT: keep `user` from
    // being the last users row so deleting them cannot recycle their id for
    // a user created by a later test.
    await createUser(request, 'keybak-rowid-gap');
    const bound = await createBoundEncryptedAddress(request, user.jwt, 'kb-delusr');
    const passkeyId = uniqueId('pk-deluser');
    await insertPasskey(request, user.userId, passkeyId);
    await putBackup(request, user.jwt, {
      address: bound.address,
      key_id: bound.publicKey,
      passkey_id: passkeyId,
      blob: makeBlob(BLOB_VERSION, 800),
    });

    const delRes = await request.delete(`${WORKER_URL}/admin/users/${user.userId}`);
    expect(delRes.ok(), await delRes.text()).toBe(true);

    const queryRes = await request.get(`${WORKER_URL}/__test/query`, {
      params: { sql: `SELECT COUNT(*) AS count FROM user_key_backups WHERE user_id = ${user.userId}` },
    });
    const { results } = await queryRes.json();
    expect(results[0].count).toBe(0);

    await deleteAddress(request, bound.jwt);
  });
});
