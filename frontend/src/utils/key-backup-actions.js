/**
 * Shared logic for creating a passphrase-wrapped key backup from raw key
 * material pasted by the user (AccountSettings "Create protected backup from
 * my key"). Kept out of the Vue component so it can be unit-tested.
 *
 * Security notes:
 * - The pasted raw key string exists only transiently inside
 *   createBackupFromPastedKey and is dropped when the function returns;
 *   callers must clear their input refs.
 * - Only the wrapped blob is persisted (on the matching key record); the
 *   server never sees the key, the passphrase or the blob.
 */
import { publicKeyFromPrivate } from './mail-crypto'
import { getKeyRecords, setWrappedBackup } from './mail-key-store'
import { validatePassphrase, wrapPrivateKey } from './key-backup'
import { parseDecryptionFragment } from './mail-fragment'

/** The pasted text is not a usable private key / decryption link. */
export class BackupKeyInvalidError extends Error {
    constructor(message = 'The pasted key is not a valid private key or decryption link') {
        super(message)
        this.name = 'BackupKeyInvalidError'
    }
}

/** The key is valid but does not match any key stored for this address. */
export class BackupKeyMismatchError extends Error {
    constructor(message = 'The pasted key does not match any key stored for this address on this device') {
        super(message)
        this.name = 'BackupKeyMismatchError'
    }
}

/** Extract the raw base64url PKCS8 key from a pasted decryption link or bare
 * key. Returns the key string, or null when nothing usable was pasted. */
export const extractRawKeyFromText = (text) => {
    const trimmed = (text || '').trim()
    if (!trimmed) return null
    const parsed = parseDecryptionFragment(trimmed)
    if (parsed) return parsed.key
    // Bare base64url private keys contain no '#'; treat the whole input as
    // the key and let publicKeyFromPrivate validate it.
    if (!trimmed.includes('#')) return trimmed
    return null
}

/**
 * Verify that `rawKey` belongs to `address` on this device (its public key
 * must match a stored key record), wrap it with `passphrase` and attach the
 * blob to that record. Returns the updated record.
 *
 * Throws:
 * - BackupKeyInvalidError: unusable key material;
 * - BackupKeyMismatchError: no stored record matches the key's public key;
 * - BackupPassphraseError (from key-backup): passphrase policy violation;
 * - Error: the wrapped blob could not be stored.
 */
export const createBackupFromPastedKey = async ({ text, address, passphrase } = {}) => {
    if (!address) throw new BackupKeyInvalidError('A mail address is required')
    const rawKey = extractRawKeyFromText(text)
    if (!rawKey) throw new BackupKeyInvalidError()
    let publicKey
    try {
        publicKey = await publicKeyFromPrivate(rawKey)
    } catch {
        // Never log the key material itself.
        throw new BackupKeyInvalidError()
    }
    const record = (getKeyRecords(address) || []).find((item) => item.publicKey === publicKey)
    if (!record) throw new BackupKeyMismatchError()
    validatePassphrase(passphrase)
    const blob = await wrapPrivateKey({ privateKeyB64u: rawKey, address, passphrase })
    const updated = await setWrappedBackup(address, publicKey, blob)
    if (!updated) throw new Error('The wrapped backup could not be stored')
    return updated
}
