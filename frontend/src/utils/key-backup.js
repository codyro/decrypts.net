/**
 * Passphrase-protected backup of mail decryption private keys (browser side).
 *
 * The worker never sees private keys, passphrases or wrapped blobs (in this
 * phase nothing is uploaded at all). A wrapped backup can only be produced
 * while the raw PKCS8 key is still in memory — a non-extractable CryptoKey
 * cannot be exported or wrapped — so wrapping happens at creation, rotation,
 * import or legacy-migration time and the resulting blob is stored on the key
 * record (`wrappedBackup`). Later "copy link"/"export" operations just emit
 * that stored blob.
 *
 * Format (all binary, base64url for transport):
 *   version(1B = 0x01) || iterations(4B big-endian uint32) || salt(16B)
 *   || iv(12B) || AES-256-GCM(ciphertext || 16B tag)
 *   KDF: PBKDF2-HMAC-SHA256 -> AES-256-GCM key.
 *   plaintext = the PKCS8 private key bytes.
 *   AAD = UTF-8 "cfte-kp1:" + address  (a blob cannot be re-labelled to
 *   another address without failing authentication).
 *
 * Errors: wrong passphrase / tampering -> BackupPassphraseError;
 * malformed blob or unsupported version -> BackupFormatError. Key material
 * and passphrases are never logged.
 *
 * Plain JS, no deps; runs under Node 20+ (WebCrypto) so unit tests can
 * import it.
 */
import { bytesToBase64Url, base64UrlToBytes } from './mail-crypto'

export const BACKUP_VERSION = 0x01
export const BACKUP_PBKDF2_ITERATIONS = 600000
export const BACKUP_PBKDF2_MIN_ITERATIONS = 100000
export const BACKUP_PBKDF2_MAX_ITERATIONS = 5000000
export const BACKUP_MIN_PASSPHRASE_LENGTH = 10
export const BACKUP_MAX_PASSPHRASE_LENGTH = 1024
const BACKUP_SALT_LENGTH = 16
const BACKUP_IV_LENGTH = 12
const BACKUP_TAG_LENGTH = 16
const BACKUP_HEADER_LENGTH = 1 + 4 + BACKUP_SALT_LENGTH + BACKUP_IV_LENGTH
const BACKUP_AAD_PREFIX = 'cfte-kp1:'
const BACKUP_FILE_FORMAT = 'cf-temp-email-key-backup'
const BACKUP_FILE_VERSION = 1
const BACKUP_FILE_KDF = 'PBKDF2-SHA256'

/** Wrong passphrase, or the blob was tampered with / re-labelled. */
export class BackupPassphraseError extends Error {
    constructor(message = 'Incorrect backup passphrase or tampered backup') {
        super(message)
        this.name = 'BackupPassphraseError'
    }
}

/** Malformed blob, unsupported version, or invalid backup file. */
export class BackupFormatError extends Error {
    constructor(message = 'Invalid key backup format') {
        super(message)
        this.name = 'BackupFormatError'
    }
}

/**
 * Enforce the passphrase policy: a non-empty string of at least
 * BACKUP_MIN_PASSPHRASE_LENGTH chars (and at most
 * BACKUP_MAX_PASSPHRASE_LENGTH). Throws BackupPassphraseError.
 */
export const validatePassphrase = (passphrase) => {
    if (typeof passphrase !== 'string' || passphrase.length === 0) {
        throw new BackupPassphraseError('Backup passphrase must not be empty')
    }
    if (passphrase.length < BACKUP_MIN_PASSPHRASE_LENGTH) {
        throw new BackupPassphraseError(
            `Backup passphrase must be at least ${BACKUP_MIN_PASSPHRASE_LENGTH} characters`
        )
    }
    if (passphrase.length > BACKUP_MAX_PASSPHRASE_LENGTH) {
        throw new BackupPassphraseError(
            `Backup passphrase must be at most ${BACKUP_MAX_PASSPHRASE_LENGTH} characters`
        )
    }
    return passphrase
}

const validateIterations = (iterations) => {
    if (!Number.isInteger(iterations)
        || iterations < BACKUP_PBKDF2_MIN_ITERATIONS
        || iterations > BACKUP_PBKDF2_MAX_ITERATIONS) {
        throw new RangeError(
            `PBKDF2 iterations must be an integer between ${BACKUP_PBKDF2_MIN_ITERATIONS}`
            + ` and ${BACKUP_PBKDF2_MAX_ITERATIONS}`
        )
    }
    return iterations
}

const aadForAddress = (address) => new TextEncoder().encode(BACKUP_AAD_PREFIX + address)

const deriveAesKey = async (passphrase, salt, iterations) => {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        material,
        256
    )
    return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/**
 * Wrap a base64url PKCS8 private key with a passphrase. `iterations`
 * defaults to BACKUP_PBKDF2_ITERATIONS and must be within the supported
 * floor/ceiling (RangeError otherwise). Returns the backup blob as a
 * base64url string. The raw key only exists transiently in memory.
 */
export const wrapPrivateKey = async ({ privateKeyB64u, address, passphrase, iterations } = {}) => {
    if (typeof address !== 'string' || address.length === 0) {
        throw new BackupFormatError('A mail address is required to wrap a key')
    }
    validatePassphrase(passphrase)
    const iterationCount = iterations === undefined
        ? BACKUP_PBKDF2_ITERATIONS
        : validateIterations(iterations)
    let pkcs8
    try {
        pkcs8 = base64UrlToBytes(privateKeyB64u)
    } catch {
        throw new BackupFormatError('Invalid private key encoding')
    }
    if (pkcs8.length === 0) throw new BackupFormatError('Invalid private key encoding')

    const salt = crypto.getRandomValues(new Uint8Array(BACKUP_SALT_LENGTH))
    const iv = crypto.getRandomValues(new Uint8Array(BACKUP_IV_LENGTH))
    const aesKey = await deriveAesKey(passphrase, salt, iterationCount)
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aadForAddress(address) },
        aesKey,
        pkcs8
    ))

    const blob = new Uint8Array(BACKUP_HEADER_LENGTH + ciphertext.length)
    blob[0] = BACKUP_VERSION
    new DataView(blob.buffer).setUint32(1, iterationCount, false)
    blob.set(salt, 5)
    blob.set(iv, 5 + BACKUP_SALT_LENGTH)
    blob.set(ciphertext, BACKUP_HEADER_LENGTH)
    return bytesToBase64Url(blob)
}

/**
 * Unwrap a backup blob (base64url). Returns the base64url PKCS8 private key
 * as a transient string — the caller must import it into the key store and
 * drop the string immediately. Throws BackupFormatError for malformed blobs
 * or unsupported versions, and BackupPassphraseError for a wrong passphrase,
 * tampering, or an address mismatch (AAD is bound to `address`).
 */
export const unwrapPrivateKey = async ({ blob, address, passphrase } = {}) => {
    if (typeof address !== 'string' || address.length === 0) {
        throw new BackupFormatError('A mail address is required to unwrap a key')
    }
    validatePassphrase(passphrase)
    let bytes
    try {
        bytes = base64UrlToBytes(blob)
    } catch {
        throw new BackupFormatError('Invalid key backup encoding')
    }
    if (bytes.length < BACKUP_HEADER_LENGTH + BACKUP_TAG_LENGTH) {
        throw new BackupFormatError('Invalid key backup length')
    }
    if (bytes[0] !== BACKUP_VERSION) {
        throw new BackupFormatError('Unsupported key backup version')
    }
    const iterations = new DataView(bytes.buffer, bytes.byteOffset).getUint32(1, false)
    if (iterations < BACKUP_PBKDF2_MIN_ITERATIONS || iterations > BACKUP_PBKDF2_MAX_ITERATIONS) {
        throw new BackupFormatError('Key backup iteration count out of supported range')
    }
    const salt = bytes.slice(5, 5 + BACKUP_SALT_LENGTH)
    const iv = bytes.slice(5 + BACKUP_SALT_LENGTH, BACKUP_HEADER_LENGTH)
    const ciphertext = bytes.slice(BACKUP_HEADER_LENGTH)

    const aesKey = await deriveAesKey(passphrase, salt, iterations)
    let plaintext
    try {
        plaintext = new Uint8Array(await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: aadForAddress(address) },
            aesKey,
            ciphertext
        ))
    } catch {
        throw new BackupPassphraseError()
    }
    return bytesToBase64Url(plaintext)
}

/**
 * Build a `#kp=` decryption link for a wrapped backup blob:
 * `${origin}/#kp=<blob>&a=<address>`.
 */
export const buildBackupLink = (address, blob, baseUrl) => {
    const origin = baseUrl !== undefined
        ? baseUrl
        : (typeof window !== 'undefined' && window.location ? window.location.origin : '')
    return `${origin}/#kp=${blob}&a=${encodeURIComponent(address)}`
}

/** Suggested download file name for a backup file. */
export const backupFileName = (address) => {
    const safe = String(address || '').replace(/[^\w@.-]/g, '_')
    return `${BACKUP_FILE_FORMAT}-${safe}.json`
}

/**
 * Build the JSON backup file content:
 * { format, version, address, createdAt, kdf, blob }.
 */
export const buildBackupFileContent = (address, blob, { createdAt } = {}) => {
    return JSON.stringify({
        format: BACKUP_FILE_FORMAT,
        version: BACKUP_FILE_VERSION,
        address,
        createdAt: createdAt || new Date().toISOString(),
        kdf: BACKUP_FILE_KDF,
        blob,
    }, null, 2)
}

/**
 * Strictly parse a backup file produced by buildBackupFileContent.
 * Returns { address, blob }. Throws BackupFormatError.
 */
export const parseBackupFile = (text) => {
    let parsed
    try {
        parsed = JSON.parse(text)
    } catch {
        throw new BackupFormatError('Key backup file is not valid JSON')
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new BackupFormatError('Key backup file has an invalid structure')
    }
    if (parsed.format !== BACKUP_FILE_FORMAT) throw new BackupFormatError('Unknown key backup file format')
    if (parsed.version !== BACKUP_FILE_VERSION) throw new BackupFormatError('Unsupported key backup file version')
    if (typeof parsed.address !== 'string' || parsed.address.length === 0) {
        throw new BackupFormatError('Key backup file has no address')
    }
    if (parsed.kdf !== BACKUP_FILE_KDF) throw new BackupFormatError('Unsupported key backup KDF')
    if (typeof parsed.blob !== 'string' || parsed.blob.length === 0) {
        throw new BackupFormatError('Key backup file has no blob')
    }
    return { address: parsed.address, blob: parsed.blob }
}

/**
 * Parse a hash string (with or without leading '#') or a full URL containing
 * a `#kp=<blob>&a=<address>` wrapped-backup fragment. Returns
 * { blob, address } or null.
 */
export const parseWrappedFragment = (input) => {
    if (typeof input !== 'string' || input.length === 0) return null
    let hash = input
    try {
        if (!input.startsWith('#') && input.includes('#')) {
            hash = input.slice(input.indexOf('#'))
        }
    } catch {
        return null
    }
    if (!hash.startsWith('#')) return null
    let params
    try {
        params = new URLSearchParams(hash.slice(1))
    } catch {
        return null
    }
    const blob = params.get('kp')
    const address = params.get('a')
    if (!blob || !address) return null
    return { blob, address }
}
