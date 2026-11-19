/**
 * Per-mailbox end-to-end encryption of stored mail (browser side).
 *
 * The private key (base64url PKCS8) lives only in the browser (URL fragment +
 * localStorage) and is never sent to the server. Envelope format and KDF
 * match the worker implementation in worker/src/utils/mail_crypto.ts:
 *   "cfte1." + base64url( ephPubRaw(65B, P-256 uncompressed) || iv(12B) || AES-GCM(ciphertext||tag) )
 *   KDF: ECDH(eph priv, recipient pub) -> HKDF-SHA256(salt = ephPubRaw,
 *        info = "cf-temp-email/mail-encryption/v1") -> AES-256-GCM key; AAD = "cfte1".
 *   Plaintext = 1 flag byte (0 = raw UTF-8 MIME, 1 = gzip(UTF-8 MIME)) || bytes.
 *
 * Plain JS, no deps; also runs under Node 20+ (WebCrypto, btoa/atob,
 * DecompressionStream are available there) so e2e unit tests can import it.
 */

export const MAIL_ENCRYPTION_PREFIX = 'cfte1.'
const HKDF_INFO = 'cf-temp-email/mail-encryption/v1'
const ENVELOPE_AAD = 'cfte1'
const FLAG_RAW = 0
const FLAG_GZIP = 1
const EPHEMERAL_PUBLIC_KEY_LENGTH = 65
const IV_LENGTH = 12
const EC_PUBLIC_KEY_RAW_LENGTH = 65
const EC_PRIVATE_KEY_BYTES_LENGTH = 32

export const isEncryptedRaw = (raw) => {
    return typeof raw === 'string' && raw.startsWith(MAIL_ENCRYPTION_PREFIX)
}

/**
 * Decide whether a raw_mails/sendbox row holds an encrypted envelope.
 *
 * On a migrated database the explicit `is_encrypted` column is authoritative:
 * a sender-controlled plaintext starting with "cfte1." must NOT be treated
 * as encrypted. Only when the row carries no `is_encrypted` property
 * (un-migrated database) do we fall back to the envelope prefix check so
 * those deployments keep working.
 */
export const isEncryptedRow = (row) => {
    if (!row) return false
    if (row.is_encrypted !== undefined) {
        return Number(row.is_encrypted) === 1
    }
    return isEncryptedRaw(typeof row.raw === 'string' ? row.raw : null)
}

export const bytesToBase64Url = (bytes) => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const base64UrlToBytes = (value) => {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

const importPrivateKey = async (privateKeyB64u) => {
    const pkcs8 = base64UrlToBytes(privateKeyB64u)
    return crypto.subtle.importKey(
        'pkcs8',
        pkcs8,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    )
}

/**
 * Generate a new P-256 key pair for mail encryption.
 * Returns { publicKey, privateKey } as base64url strings:
 * publicKey = raw 65-byte uncompressed point, privateKey = PKCS8.
 */
export const generateKeyPair = async () => {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    )
    const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))
    const privateKeyPkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
    return {
        publicKey: bytesToBase64Url(publicKeyRaw),
        privateKey: bytesToBase64Url(privateKeyPkcs8),
    }
}

/**
 * Derive the base64url raw public key (65-byte uncompressed point) from a
 * base64url PKCS8 private key, via an extractable import + JWK x/y.
 */
export const publicKeyFromPrivate = async (privateKeyB64u) => {
    const privateKey = await importPrivateKey(privateKeyB64u)
    const jwk = await crypto.subtle.exportKey('jwk', privateKey)
    const x = base64UrlToBytes(jwk.x)
    const y = base64UrlToBytes(jwk.y)
    if (x.length !== EC_PRIVATE_KEY_BYTES_LENGTH || y.length !== EC_PRIVATE_KEY_BYTES_LENGTH) {
        throw new Error('Invalid private key: unexpected JWK coordinates')
    }
    const raw = new Uint8Array(EC_PUBLIC_KEY_RAW_LENGTH)
    raw[0] = 0x04
    raw.set(x, 1)
    raw.set(y, 1 + EC_PRIVATE_KEY_BYTES_LENGTH)
    return bytesToBase64Url(raw)
}

const gunzip = async (bytes) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).text()
}

const gzip = async (text) => {
    const stream = new Blob([new TextEncoder().encode(text)]).stream()
        .pipeThrough(new CompressionStream('gzip'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Decrypt a "cfte1." envelope with the base64url PKCS8 private key.
 * Throws on bad key, corrupt envelope or tampered ciphertext.
 */
export const decryptMail = async (privateKeyB64u, envelope) => {
    if (!isEncryptedRaw(envelope)) {
        throw new Error('Not an encrypted mail envelope')
    }
    const privateKey = await importPrivateKey(privateKeyB64u)

    let envelopeBytes
    try {
        envelopeBytes = base64UrlToBytes(envelope.slice(MAIL_ENCRYPTION_PREFIX.length))
    } catch {
        throw new Error('Invalid encrypted mail envelope encoding')
    }
    const minLength = EPHEMERAL_PUBLIC_KEY_LENGTH + IV_LENGTH + 16
    if (envelopeBytes.length <= minLength) {
        throw new Error('Invalid encrypted mail envelope length')
    }

    const ephemeralPublicKeyRaw = envelopeBytes.slice(0, EPHEMERAL_PUBLIC_KEY_LENGTH)
    const iv = envelopeBytes.slice(
        EPHEMERAL_PUBLIC_KEY_LENGTH,
        EPHEMERAL_PUBLIC_KEY_LENGTH + IV_LENGTH
    )
    const ciphertext = envelopeBytes.slice(EPHEMERAL_PUBLIC_KEY_LENGTH + IV_LENGTH)

    let ephemeralPublicKey
    try {
        ephemeralPublicKey = await crypto.subtle.importKey(
            'raw',
            ephemeralPublicKeyRaw,
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        )
    } catch {
        throw new Error('Invalid ephemeral public key in envelope')
    }

    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: ephemeralPublicKey },
        privateKey,
        256
    )
    const hkdfKey = await crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'HKDF' },
        false,
        ['deriveBits']
    )
    const aesKeyBits = await crypto.subtle.deriveBits(
        { name: 'HKDF', salt: ephemeralPublicKeyRaw, info: new TextEncoder().encode(HKDF_INFO), hash: 'SHA-256' },
        hkdfKey,
        256
    )
    const aesKey = await crypto.subtle.importKey(
        'raw',
        aesKeyBits,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
    )

    let plaintext
    try {
        plaintext = new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ENVELOPE_AAD) },
            aesKey,
            ciphertext
        ))
    } catch {
        throw new Error('Failed to decrypt mail: wrong key or tampered content')
    }

    const flag = plaintext[0]
    const content = plaintext.slice(1)
    if (flag === FLAG_RAW) {
        return new TextDecoder().decode(content)
    }
    if (flag === FLAG_GZIP) {
        try {
            return await gunzip(content)
        } catch {
            throw new Error('Failed to decompress decrypted mail')
        }
    }
    throw new Error(`Unknown encrypted mail content flag: ${flag}`)
}

/**
 * Encrypt a raw string (MIME mail or sendbox JSON) into a "cfte1." envelope
 * for the given base64url raw P-256 public key. Identical algorithm and
 * format to the worker-side encryptor (worker/src/utils/mail_crypto.ts):
 * ECDH with an ephemeral key, HKDF-SHA256(salt = ephPubRaw,
 * info = "cf-temp-email/mail-encryption/v1"), AES-256-GCM with AAD "cfte1",
 * plaintext = 1 flag byte (0 raw UTF-8, 1 gzip) || content.
 *
 * Used by the "encrypt existing mail" flow: the browser encrypts plaintext
 * rows fetched from the server and uploads only the envelope, so the server
 * never sees the private key nor any plaintext. Throws on any failure.
 */
export const encryptMail = async (publicKeyB64u, raw, opts = {}) => {
    const recipientKey = await crypto.subtle.importKey(
        'raw',
        base64UrlToBytes(publicKeyB64u),
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    )

    const ephemeralKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    )
    const ephemeralPublicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey)
    )

    const sharedSecret = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: recipientKey },
        ephemeralKeyPair.privateKey,
        256
    )
    const hkdfKey = await crypto.subtle.importKey(
        'raw',
        sharedSecret,
        { name: 'HKDF' },
        false,
        ['deriveBits']
    )
    const aesKeyBits = await crypto.subtle.deriveBits(
        { name: 'HKDF', salt: ephemeralPublicKeyRaw, info: new TextEncoder().encode(HKDF_INFO), hash: 'SHA-256' },
        hkdfKey,
        256
    )
    const aesKey = await crypto.subtle.importKey(
        'raw',
        aesKeyBits,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
    )

    const useGzip = opts?.gzip === true
    const content = useGzip
        ? await gzip(raw)
        : new TextEncoder().encode(raw)
    const plaintext = new Uint8Array(1 + content.length)
    plaintext[0] = useGzip ? FLAG_GZIP : FLAG_RAW
    plaintext.set(content, 1)

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ENVELOPE_AAD) },
        aesKey,
        plaintext
    ))

    const envelope = new Uint8Array(
        ephemeralPublicKeyRaw.length + iv.length + ciphertext.length
    )
    envelope.set(ephemeralPublicKeyRaw, 0)
    envelope.set(iv, ephemeralPublicKeyRaw.length)
    envelope.set(ciphertext, ephemeralPublicKeyRaw.length + iv.length)

    return MAIL_ENCRYPTION_PREFIX + bytesToBase64Url(envelope)
}
