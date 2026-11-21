/**
 * Minimal software WebAuthn authenticator for API-level tests.
 *
 * The browser tests use Chrome's CDP virtual authenticator; these helpers
 * let API tests complete a real WebAuthn ceremony over HTTP by crafting
 * "none" attestations and signed assertions with a Node-generated P-256
 * key, accepted by @simplewebauthn/server the same way a real
 * authenticator's output is.
 */
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

function cborTypeLen(major: number, length: number): Buffer {
  const prefix = major << 5;
  if (length < 24) return Buffer.from([prefix | length]);
  if (length < 0x100) return Buffer.from([prefix | 24, length]);
  if (length < 0x10000) {
    const buf = Buffer.alloc(3);
    buf[0] = prefix | 25;
    buf.writeUInt16BE(length, 1);
    return buf;
  }
  const buf = Buffer.alloc(5);
  buf[0] = prefix | 26;
  buf.writeUInt32BE(length, 1);
  return buf;
}

/** Encode a value as definite-length CBOR (ints, bytes, strings, arrays, Maps). */
export function cborEncode(value: unknown): Buffer {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const buf = Buffer.from(value);
    return Buffer.concat([cborTypeLen(2, buf.length), buf]);
  }
  if (typeof value === 'string') {
    const buf = Buffer.from(value, 'utf8');
    return Buffer.concat([cborTypeLen(3, buf.length), buf]);
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 0) return cborTypeLen(0, value);
    if (value >= -24) return Buffer.from([0x20 | (-1 - value)]);
    throw new Error(`cborEncode: unsupported negative int ${value}`);
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => cborEncode(item));
    return Buffer.concat([cborTypeLen(4, parts.length), ...parts]);
  }
  if (value instanceof Map) {
    const parts: Buffer[] = [];
    for (const [key, item] of value.entries()) {
      parts.push(cborEncode(key), cborEncode(item));
    }
    return Buffer.concat([cborTypeLen(5, value.size), ...parts]);
  }
  if (value && typeof value === 'object') {
    return cborEncode(new Map(Object.entries(value as Record<string, unknown>)));
  }
  throw new Error(`cborEncode: unsupported type ${typeof value}`);
}

export interface SoftCredential {
  /** base64url credential id */
  credentialId: string;
  privateKey: KeyObject;
  /** body for /user_api/passkey/signup_response and register_response */
  attest: (challenge: string, origin: string) => Record<string, unknown>;
  /** body for /user_api/passkey/authenticate_response */
  assert: (challenge: string, origin: string) => Record<string, unknown>;
}

export function createSoftCredential(rpId: string): SoftCredential {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  // The last 65 bytes of the SPKI DER are the uncompressed point 0x04 || x || y
  const point = spki.subarray(spki.length - 65);
  const x = point.subarray(1, 33);
  const y = point.subarray(33, 65);
  const credentialIdBytes = createHash('sha256').update(spki).digest().subarray(0, 32);
  const credentialId = credentialIdBytes.toString('base64url');
  const coseKey = cborEncode(
    new Map<number, unknown>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, Buffer.from(x)],
      [-3, Buffer.from(y)],
    ]),
  );
  const rpIdHash = createHash('sha256').update(rpId).digest();

  const buildAuthData = (flags: number, includeAttested: boolean, counter: number): Buffer => {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(counter);
    const head = Buffer.concat([rpIdHash, Buffer.from([flags]), counterBuf]);
    if (!includeAttested) return head;
    const aaguid = Buffer.alloc(16);
    const credLen = Buffer.alloc(2);
    credLen.writeUInt16BE(credentialIdBytes.length);
    return Buffer.concat([head, aaguid, credLen, credentialIdBytes, coseKey]);
  };

  const clientData = (type: string, challenge: string, origin: string): Buffer =>
    Buffer.from(JSON.stringify({ type, challenge, origin }));

  return {
    credentialId,
    privateKey,
    attest: (challenge, origin) => {
      const attestationObject = cborEncode(
        new Map<string, unknown>([
          ['fmt', 'none'],
          ['attStmt', new Map()],
          ['authData', buildAuthData(0x41, true, 0)], // UP | AT
        ]),
      );
      const clientDataJSON = clientData('webauthn.create', challenge, origin);
      return {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          attestationObject: attestationObject.toString('base64url'),
          clientDataJSON: clientDataJSON.toString('base64url'),
        },
      };
    },
    assert: (challenge, origin) => {
      const clientDataJSON = clientData('webauthn.get', challenge, origin);
      const authenticatorData = buildAuthData(0x01, false, 0); // UP only
      const signed = Buffer.concat([
        authenticatorData,
        createHash('sha256').update(clientDataJSON).digest(),
      ]);
      const signature = createSign('SHA256').update(signed).sign(privateKey);
      return {
        id: credentialId,
        rawId: credentialId,
        type: 'public-key',
        response: {
          authenticatorData: authenticatorData.toString('base64url'),
          clientDataJSON: clientDataJSON.toString('base64url'),
          signature: signature.toString('base64url'),
        },
      };
    },
  };
}
