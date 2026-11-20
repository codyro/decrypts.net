/**
 * Passkey (WebAuthn PRF) wrapped key backups (browser side).
 *
 * The mailbox private key (base64url PKCS8) is wrapped with an AES-256-GCM
 * key derived from the WebAuthn PRF extension output; the opaque blob is the
 * ONLY thing uploaded to the server (worker/src/user_api/key_backups.ts).
 * The server never sees the PRF output, the wrapping key, or the private
 * key; it validates only the blob shape
 * (worker/src/utils/key_backup.ts: first byte 0x02, 62..4096 bytes).
 *
 * Blob format (base64url on the wire):
 *   version(1B = 0x02) || salt(32B) || iv(12B) || AES-256-GCM(ciphertext || 16B tag)
 *   plaintext = the PKCS8 private key bytes.
 *   KDF: HKDF-SHA256(ikm = PRF output, salt = the blob salt,
 *        info = "cf-temp-email/key-wrap/prf-v1|" + address + "|" + keyId).
 *   AAD = UTF-8 "cfte-kpk1:" + address + "|" + keyId — a blob cannot be
 *   re-labelled to another address/key without failing authentication.
 *
 * The PRF assertion uses a RANDOM LOCAL challenge (nothing is authenticated
 * here; the PRF output is used as key material, not as a signature). An
 * authenticator without PRF support yields no `results.first` — detected at
 * use time and reported as PasskeyPrfUnsupportedError.
 *
 * KEY CONSTRAINT: a non-extractable CryptoKey cannot be wrapped later, so
 * callers must pass the raw PKCS8 string while it is still transiently in
 * memory (creation / rotation / import / paste-your-key-again flows) and
 * drop it immediately afterwards. unwrapKeyWithPasskey returns a transient
 * base64url string — import it into the key store and drop it at once.
 *
 * Plain JS, no deps; runs under Node 20+ (WebCrypto, btoa/atob) so unit
 * tests can import it with a mocked navigator.credentials.
 */
import { bytesToBase64Url, base64UrlToBytes } from './mail-crypto'

export const PASSKEY_BACKUP_VERSION = 0x02
export const PASSKEY_BACKUP_SALT_LENGTH = 32
export const PASSKEY_BACKUP_IV_LENGTH = 12
export const PASSKEY_BACKUP_TAG_LENGTH = 16
export const PASSKEY_BACKUP_HEADER_LENGTH = 1 + PASSKEY_BACKUP_SALT_LENGTH + PASSKEY_BACKUP_IV_LENGTH
// 45 (header) + 16 (GCM tag) + 1 (min plaintext) — matches the worker validator.
export const PASSKEY_BACKUP_MIN_BLOB_BYTES = 62
export const PASSKEY_BACKUP_MAX_BLOB_BYTES = 4096

const HKDF_INFO_PREFIX = 'cf-temp-email/key-wrap/prf-v1|'
const AAD_PREFIX = 'cfte-kpk1:'
const CHALLENGE_LENGTH = 32

/** The passkey/authenticator (or browser) does not support the PRF extension. */
export class PasskeyPrfUnsupportedError extends Error {
    constructor(message = 'This passkey/browser does not support PRF') {
        super(message)
        this.name = 'PasskeyPrfUnsupportedError'
    }
}

/** The blob could not be unwrapped: wrong passkey, tampering or re-labelling. */
export class PasskeyUnwrapError extends Error {
    constructor(message = 'Could not unwrap the backup with this passkey (wrong passkey, tampered backup or different address/key)') {
        super(message)
        this.name = 'PasskeyUnwrapError'
    }
}

/** The user cancelled the passkey prompt (dismissed or aborted). */
export class PasskeyCancelledError extends Error {
    constructor(message = 'Passkey prompt cancelled') {
        super(message)
        this.name = 'PasskeyCancelledError'
    }
}

/**
 * Optimistic feature detection for WebAuthn PRF wrapping. True when the
 * platform has WebAuthn at all; when the browser exposes
 * PublicKeyCredential.getClientCapabilities() the `extension:prf` capability
 * is read from it. Real support is always re-verified at use time: an
 * authenticator without PRF yields no `results.first` and throws
 * PasskeyPrfUnsupportedError.
 */
export const isPasskeyPrfPossible = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    if (!window.PublicKeyCredential || !navigator.credentials) return false
    try {
        const capabilities = await window.PublicKeyCredential.getClientCapabilities?.()
        if (capabilities && 'extension:prf' in capabilities) {
            return capabilities['extension:prf'] === true
        }
    } catch {
        // Fall through to the optimistic answer; real support is detected
        // at assertion time via the missing prf result.
    }
    return true
}

const normalizeError = (err) => {
    if (err instanceof PasskeyPrfUnsupportedError
        || err instanceof PasskeyUnwrapError
        || err instanceof PasskeyCancelledError) {
        throw err
    }
    if (err?.name === 'NotAllowedError' || err?.name === 'AbortError') {
        throw new PasskeyCancelledError()
    }
    throw err
}

/**
 * Run the WebAuthn PRF assertion for `credentialId` with `salt` as the
 * eval input and return the 32-byte PRF output. `rpId` defaults to the
 * current hostname; the challenge is random and purely local (nothing is
 * authenticated by this ceremony). Throws PasskeyPrfUnsupportedError when
 * the authenticator does not return `results.first`, PasskeyCancelledError
 * on dismissal/abort.
 */
const getPrfOutput = async ({ credentialId, salt, rpId, signal } = {}) => {
    const challenge = crypto.getRandomValues(new Uint8Array(CHALLENGE_LENGTH))
    let assertion
    try {
        assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                rpId: rpId || (typeof window !== 'undefined' ? window.location.hostname : undefined),
                allowCredentials: [{ type: 'public-key', id: base64UrlToBytes(credentialId) }],
                userVerification: 'required',
                extensions: { prf: { eval: { first: salt } } },
            },
            signal,
        })
    } catch (err) {
        normalizeError(err)
    }
    const results = assertion?.getClientExtensionResults?.()?.prf?.results
    const first = results?.first
    if (!(first instanceof ArrayBuffer) && !ArrayBuffer.isView(first)) {
        throw new PasskeyPrfUnsupportedError()
    }
    return new Uint8Array(first.buffer ?? first, first.byteOffset ?? 0, first.byteLength)
}

const deriveAesKey = async (prfOutput, salt, info, usages) => {
    const ikm = await crypto.subtle.importKey('raw', prfOutput, { name: 'HKDF' }, false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits(
        { name: 'HKDF', salt, info, hash: 'SHA-256' },
        ikm,
        256
    )
    return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, usages)
}

const kdfInfoFor = (address, keyId) => new TextEncoder().encode(`${HKDF_INFO_PREFIX}${address}|${keyId}`)
const aadFor = (address, keyId) => new TextEncoder().encode(`${AAD_PREFIX}${address}|${keyId}`)

const requireString = (value, name) => {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${name} is required`)
    }
}

/**
 * Wrap a base64url PKCS8 private key with a passkey (WebAuthn PRF) and
 * return { blob, credentialId }. `address` is the mailbox address and
 * `keyId` the mailbox key's base64url raw public key (65-byte point); both
 * bind the blob so it cannot be re-labelled. The raw key exists only
 * transiently in memory. Throws PasskeyPrfUnsupportedError /
 * PasskeyCancelledError; plain Error for invalid input.
 */
export const wrapKeyWithPasskey = async ({
    privateKeyB64u, address, keyId, credentialId, rpId, signal,
} = {}) => {
    requireString(address, 'address')
    requireString(keyId, 'keyId')
    requireString(credentialId, 'credentialId')
    let pkcs8
    try {
        pkcs8 = base64UrlToBytes(privateKeyB64u)
    } catch {
        throw new Error('Invalid private key encoding')
    }
    if (pkcs8.length === 0) throw new Error('Invalid private key encoding')

    const salt = crypto.getRandomValues(new Uint8Array(PASSKEY_BACKUP_SALT_LENGTH))
    const iv = crypto.getRandomValues(new Uint8Array(PASSKEY_BACKUP_IV_LENGTH))
    const prfOutput = await getPrfOutput({ credentialId, salt, rpId, signal })
    if (prfOutput.length === 0) throw new PasskeyPrfUnsupportedError()
    const aesKey = await deriveAesKey(prfOutput, salt, kdfInfoFor(address, keyId), ['encrypt'])
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aadFor(address, keyId) },
        aesKey,
        pkcs8
    ))

    const blob = new Uint8Array(PASSKEY_BACKUP_HEADER_LENGTH + ciphertext.length)
    blob[0] = PASSKEY_BACKUP_VERSION
    blob.set(salt, 1)
    blob.set(iv, 1 + PASSKEY_BACKUP_SALT_LENGTH)
    blob.set(ciphertext, PASSKEY_BACKUP_HEADER_LENGTH)
    return { blob: bytesToBase64Url(blob), credentialId }
}

/**
 * Unwrap a passkey backup blob (base64url) and return the base64url PKCS8
 * private key as a TRANSIENT string — the caller must import it into the
 * key store (addPrivateKey) and drop the string immediately. The PRF salt
 * is read from the blob itself; `credentialId` selects the passkey.
 * Throws PasskeyPrfUnsupportedError / PasskeyCancelledError; PasskeyUnwrapError
 * on a wrong passkey, tampering or an address/keyId mismatch; Error on a
 * malformed blob or unsupported version.
 */
export const unwrapKeyWithPasskey = async ({
    blob, address, keyId, credentialId, rpId, signal,
} = {}) => {
    requireString(address, 'address')
    requireString(keyId, 'keyId')
    requireString(credentialId, 'credentialId')
    let bytes
    try {
        bytes = base64UrlToBytes(blob)
    } catch {
        throw new Error('Invalid passkey backup encoding')
    }
    if (bytes.length < PASSKEY_BACKUP_MIN_BLOB_BYTES
        || bytes.length > PASSKEY_BACKUP_MAX_BLOB_BYTES) {
        throw new Error('Invalid passkey backup length')
    }
    if (bytes[0] !== PASSKEY_BACKUP_VERSION) {
        throw new Error('Unsupported passkey backup version')
    }
    const salt = bytes.slice(1, 1 + PASSKEY_BACKUP_SALT_LENGTH)
    const iv = bytes.slice(1 + PASSKEY_BACKUP_SALT_LENGTH, PASSKEY_BACKUP_HEADER_LENGTH)
    const ciphertext = bytes.slice(PASSKEY_BACKUP_HEADER_LENGTH)

    const prfOutput = await getPrfOutput({ credentialId, salt, rpId, signal })
    if (prfOutput.length === 0) throw new PasskeyPrfUnsupportedError()
    const aesKey = await deriveAesKey(prfOutput, salt, kdfInfoFor(address, keyId), ['decrypt'])
    let plaintext
    try {
        plaintext = new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: aadFor(address, keyId) },
            aesKey,
            ciphertext
        ))
    } catch {
        throw new PasskeyUnwrapError()
    }
    if (plaintext.length === 0) throw new PasskeyUnwrapError()
    return bytesToBase64Url(plaintext)
}
