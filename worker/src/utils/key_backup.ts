/**
 * Server-side validation of passkey (WebAuthn PRF) wrapped key backups
 * (worker storage side).
 *
 * The browser derives an AES-GCM wrapping key from the WebAuthn PRF output
 * (via HKDF) and wraps the mailbox private key with it. The server stores
 * ONLY the opaque wrapped blob and must never be able to unwrap it: it never
 * sees the PRF output, the passkey secret, or the private key.
 *
 * Wrapped blob format (browser side):
 *   version(1B, 0x02 = PRF wrap format) || salt(32B) || iv(12B)
 *   || AES-GCM(ciphertext || 16B tag, at least 1B of plaintext)
 *   KDF: HKDF-SHA256(ikm = PRF output, salt = the blob salt,
 *        info = "cf-temp-email/key-wrap/prf-v1|" + address + "|" + keyId).
 *   AAD = UTF-8 "cfte-kpk1:" + address + "|" + keyId.
 * Only the shape is validated here — the server cannot and must not verify
 * the cryptographic content.
 */

// Version byte identifying the PRF wrap format.
export const KEY_BACKUP_BLOB_VERSION = 0x02;
// 1 (version) + 32 (salt) + 12 (iv) + 16 (GCM tag) + 1 (min plaintext)
export const KEY_BACKUP_MIN_BLOB_BYTES = 62;
// Backups wrap a single private key (hundreds of bytes at most); anything
// larger cannot be a legitimate wrapped key.
export const KEY_BACKUP_MAX_BLOB_BYTES = 4096;

// Caps so a single address (or account) cannot fill the table.
export const KEY_BACKUP_MAX_PER_ADDRESS = 20;
export const KEY_BACKUP_MAX_PER_USER = 200;

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

const base64UrlToBytes = (value: string): Uint8Array => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * Strictly validate an opaque wrapped key backup blob before storing it:
 * unpadded base64url charset, decoded first byte is the PRF wrap format
 * version (0x02), decoded size within [62, 4096] bytes. Nothing else is
 * interpreted — the server cannot verify the content and must not try to.
 */
export const validateKeyBackupBlob = (blob: unknown): boolean => {
    if (typeof blob !== "string") return false;
    if (blob.length === 0) return false;
    if (!BASE64URL_RE.test(blob)) return false;
    let bytes: Uint8Array;
    try {
        bytes = base64UrlToBytes(blob);
    } catch {
        return false;
    }
    if (bytes.length < KEY_BACKUP_MIN_BLOB_BYTES) return false;
    if (bytes.length > KEY_BACKUP_MAX_BLOB_BYTES) return false;
    if (bytes[0] !== KEY_BACKUP_BLOB_VERSION) return false;
    return true;
}
