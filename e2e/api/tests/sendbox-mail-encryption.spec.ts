import { test, expect } from '@playwright/test';
import { generateKeyPair, decryptMail } from '../../../frontend/src/utils/mail-crypto.js';
import { WORKER_URL, TEST_DOMAIN, createTestAddress, deleteAddress, sendTestMail } from '../../fixtures/test-helpers';

/**
 * Sendbox encryption at rest (ENABLE_MAIL_ENCRYPTION=true on the default e2e
 * worker): for addresses with an encryption public key the sendbox raw JSON is
 * stored as a "cfte1." envelope (is_encrypted=1) and decrypts with the mailbox
 * private key; plaintext addresses keep the existing plaintext sendbox rows
 * (is_encrypted=0). The send paths go through /admin/send_mail, which shares
 * the sendMail() workflow with /api/send_mail.
 */

const ENC_PREFIX = 'cfte1.';

async function createAddressWithKey(
  ctx: any,
  name: string,
  encryptionPublicKey: string,
): Promise<{ jwt: string; address: string }> {
  const uniqueName = `${name}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const res = await ctx.post(`${WORKER_URL}/api/new_address`, {
    data: { name: uniqueName, domain: TEST_DOMAIN, encryption_public_key: encryptionPublicKey },
  });
  if (!res.ok()) throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return { jwt: body.jwt, address: body.address };
}

async function getSendbox(ctx: any, jwt: string): Promise<any[]> {
  const res = await ctx.get(`${WORKER_URL}/api/sendbox?limit=20&offset=0`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const { results } = await res.json();
  return results;
}

test.describe('Sendbox encryption at rest', () => {
  test('sendbox raw for an encrypted address is a cfte1. envelope that decrypts to the sent JSON', async ({ request }) => {
    const { publicKey, privateKey } = await generateKeyPair();
    const { jwt, address } = await createAddressWithKey(request, 'enc-sendbox', publicKey);
    const subject = `Sendbox Encrypted ${Date.now()}`;
    try {
      await sendTestMail(request, address, { to_mail: 'receiver@test.example.com', subject });

      const results = await getSendbox(request, jwt);
      expect(results).toHaveLength(1);
      const raw: string = results[0].raw;
      expect(raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(raw).not.toContain(subject);
      expect(results[0].is_encrypted).toBe(1);

      const decrypted = await decryptMail(privateKey, raw);
      const body = JSON.parse(decrypted);
      expect(body.subject).toBe(subject);
      expect(body.to_mail).toBe('receiver@test.example.com');
      expect(body.version).toBe('v2');
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('sendbox raw for a plaintext address stays plaintext with is_encrypted=0', async ({ request }) => {
    const { jwt, address } = await createTestAddress(request, 'plain-sendbox');
    const subject = `Sendbox Plain ${Date.now()}`;
    try {
      await sendTestMail(request, address, { to_mail: 'receiver@test.example.com', subject });

      const results = await getSendbox(request, jwt);
      expect(results).toHaveLength(1);
      expect(results[0].raw.startsWith(ENC_PREFIX)).toBe(false);
      expect(results[0].is_encrypted).toBe(0);
      const body = JSON.parse(results[0].raw);
      expect(body.subject).toBe(subject);
    } finally {
      await deleteAddress(request, jwt);
    }
  });

  test('admin sendbox list exposes the encrypted flag and the stored envelope', async ({ request }) => {
    const { publicKey } = await generateKeyPair();
    const { jwt, address } = await createAddressWithKey(request, 'enc-sba', publicKey);
    try {
      await sendTestMail(request, address, { to_mail: 'receiver@test.example.com', subject: `Admin Sendbox ${Date.now()}` });

      const res = await request.get(`${WORKER_URL}/admin/sendbox?limit=20&offset=0&address=${encodeURIComponent(address)}`);
      expect(res.ok(), await res.text()).toBe(true);
      const { results } = await res.json();
      expect(results.length).toBeGreaterThanOrEqual(1);
      const row = results.find((r: any) => r.address === address);
      expect(row).toBeDefined();
      expect(row.raw.startsWith(ENC_PREFIX)).toBe(true);
      expect(row.is_encrypted).toBe(1);
    } finally {
      await deleteAddress(request, jwt);
    }
  });
});
