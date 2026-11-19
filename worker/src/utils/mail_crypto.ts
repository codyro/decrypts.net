/**
 * Per-mailbox end-to-end encryption of stored mail (worker side).
 *
 * Envelope format (see vitepress-docs guide/feature/mail-encryption.md):
 *   "cfte1." + base64url( ephPubRaw(65B, P-256 uncompressed) || iv(12B) || AES-GCM(ciphertext||tag) )
 *   KDF: ECDH(eph priv, recipient pub) -> HKDF-SHA256(salt = ephPubRaw,
 *        info = "cf-temp-email/mail-encryption/v1") -> AES-256-GCM key; AAD = "cfte1".
 *   Plaintext = 1 flag byte (0 = raw UTF-8 MIME, 1 = gzip(UTF-8 MIME)) || bytes.
 *
 * The worker only ever holds the address public key (base64url of the raw
 * 65-byte uncompressed P-256 point). The private key never leaves the browser.
 */

import { compressText } from "../gzip";

export const MAIL_ENCRYPTION_PREFIX = "cfte1.";
const HKDF_INFO = "cf-temp-email/mail-encryption/v1";
const ENVELOPE_AAD = "cfte1";
const FLAG_RAW = 0;
const FLAG_GZIP = 1;
const EPHEMERAL_PUBLIC_KEY_LENGTH = 65;
const IV_LENGTH = 12;

export const isEncryptedRaw = (raw: string | null | undefined): boolean => {
    return typeof raw === "string" && raw.startsWith(MAIL_ENCRYPTION_PREFIX);
}

const bytesToBase64Url = (bytes: Uint8Array): string => {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const base64UrlToBytes = (value: string): Uint8Array => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

const importRecipientPublicKey = async (publicKeyB64u: string): Promise<CryptoKey> => {
    const raw = base64UrlToBytes(publicKeyB64u);
    return crypto.subtle.importKey(
        "raw", raw as BufferSource,
        { name: "ECDH", namedCurve: "P-256" },
        false, []
    );
}

/**
 * Validate a stored/transported public key: must be a base64url encoded
 * 65-byte uncompressed P-256 point that WebCrypto can import.
 */
export const validatePublicKey = async (publicKeyB64u: unknown): Promise<boolean> => {
    if (typeof publicKeyB64u !== "string" || publicKeyB64u.length === 0) return false;
    let raw: Uint8Array;
    try {
        raw = base64UrlToBytes(publicKeyB64u);
    } catch {
        return false;
    }
    if (raw.length !== EPHEMERAL_PUBLIC_KEY_LENGTH || raw[0] !== 0x04) return false;
    try {
        await importRecipientPublicKey(publicKeyB64u);
        return true;
    } catch {
        return false;
    }
}

/**
 * Encrypt a whole raw MIME mail for the given address public key.
 * When gzip is requested the MIME is gzipped before encryption and the
 * envelope flag byte is set to 1, otherwise the flag byte is 0.
 * Throws on any failure: callers must NOT fall back to plaintext storage.
 */
export const encryptMail = async (
    publicKeyB64u: string,
    raw: string,
    opts: { gzip: boolean }
): Promise<string> => {
    const recipientKey = await importRecipientPublicKey(publicKeyB64u);

    const ephemeralKeyPair = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
    );
    const ephemeralPublicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey("raw", ephemeralKeyPair.publicKey)
    );

    const sharedSecret = await crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientKey },
        ephemeralKeyPair.privateKey,
        256
    );
    const hkdfKey = await crypto.subtle.importKey(
        "raw",
        sharedSecret,
        { name: "HKDF" },
        false,
        ["deriveBits"]
    );
    const aesKeyBits = await crypto.subtle.deriveBits(
        { name: "HKDF", salt: ephemeralPublicKeyRaw as BufferSource, info: new TextEncoder().encode(HKDF_INFO), hash: "SHA-256" },
        hkdfKey,
        256
    );
    const aesKey = await crypto.subtle.importKey(
        "raw",
        aesKeyBits,
        { name: "AES-GCM" },
        false,
        ["encrypt"]
    );

    const gzip = opts.gzip === true;
    const content = gzip
        ? new Uint8Array(await compressText(raw))
        : new TextEncoder().encode(raw);
    const plaintext = new Uint8Array(1 + content.length);
    plaintext[0] = gzip ? FLAG_GZIP : FLAG_RAW;
    plaintext.set(content, 1);

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv as BufferSource, additionalData: new TextEncoder().encode(ENVELOPE_AAD) },
        aesKey,
        plaintext as BufferSource
    ));

    const envelope = new Uint8Array(
        ephemeralPublicKeyRaw.length + iv.length + ciphertext.length
    );
    envelope.set(ephemeralPublicKeyRaw, 0);
    envelope.set(iv, ephemeralPublicKeyRaw.length);
    envelope.set(ciphertext, ephemeralPublicKeyRaw.length + iv.length);

    return MAIL_ENCRYPTION_PREFIX + bytesToBase64Url(envelope);
}
