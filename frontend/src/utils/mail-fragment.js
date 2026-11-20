/**
 * Ingestion of private-key material from URL fragments, pasted decryption
 * links or bare keys.
 *
 * Fragment formats:
 *   `#k=<base64url PKCS8 private key>&a=<mail address>` (plaintext import)
 *   `#kp=<wrapped backup blob>&a=<mail address>` (passphrase-protected,
 *     queued for the UI to prompt for the passphrase)
 * Combined with auto-login: `/?jwt=...#k=...&a=...` (the router preserves the
 * hash through its jwt/locale redirects, and main.js ingests the fragment
 * before the router even runs).
 *
 * The private key is validated with publicKeyFromPrivate before it is stored;
 * wrapped backups are only unwrapped after passphrase verification. Malformed
 * input is rejected without ever printing the key material.
 */
import { shallowRef } from 'vue'

import { publicKeyFromPrivate } from './mail-crypto'
import { addPrivateKey } from './mail-key-store'
import {
    parseWrappedFragment, unwrapPrivateKey,
    BackupFormatError,
} from './key-backup'

/**
 * Parse a hash string (with or without leading '#') or a full URL containing
 * a `#k=...&a=...` fragment. Returns { key, address } or null. `#kp=`
 * fragments are NOT returned here (see parseWrappedFragment).
 */
export const parseDecryptionFragment = (input) => {
    if (typeof input !== 'string' || input.length === 0) return null
    let hash = input
    try {
        // Full URL or path-with-hash input: keep only the fragment part.
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
    const key = params.get('k')
    const address = params.get('a')
    if (!key || !address) return null
    return { key, address }
}

/**
 * Validate a base64url PKCS8 private key (derives its public key).
 * Returns true when the key is usable.
 */
export const isValidPrivateKey = async (privateKey) => {
    if (typeof privateKey !== 'string' || privateKey.length === 0) return false
    try {
        await publicKeyFromPrivate(privateKey)
        return true
    } catch {
        return false
    }
}

/**
 * Store a private key for an address after validation.
 * Returns true on success, false when the key material is invalid.
 */
export const importPrivateKeyForAddress = async (address, privateKey) => {
    if (!address || !privateKey) return false
    return (await addPrivateKey(address, privateKey)) !== null
}

// ---- wrapped-backup (`#kp=`) import ----------------------------------------

/**
 * Reactive queue of wrapped backups found in fragments awaiting a
 * passphrase: entries { address, blob }. The UI drains this queue by
 * prompting for the passphrase and calling importWrappedBackup.
 */
export const pendingWrappedImports = shallowRef([])

/**
 * Unwrap a wrapped backup blob with the passphrase and store the key as a
 * non-extractable CryptoKey, keeping `blob` itself as the record's
 * wrappedBackup. The raw PKCS8 string exists only transiently. Returns the
 * stored/existing key record. Throws BackupPassphraseError (wrong
 * passphrase, tampering, address mismatch) or BackupFormatError (malformed
 * blob) unchanged; when the unwrapped key material is unusable a
 * BackupFormatError is thrown and nothing is stored.
 */
export const importWrappedBackup = async ({ blob, address, passphrase } = {}) => {
    // The raw key only exists transiently in this local variable and is
    // dropped when the function returns.
    const raw = await unwrapPrivateKey({ blob, address, passphrase })
    const record = await addPrivateKey(address, raw, { wrappedBackup: blob })
    if (!record) throw new BackupFormatError('Unwrapped key material is invalid')
    return record
}

/**
 * Accepts a pasted decryption link (`...#k=...&a=...`), a bare `#k=...&a=...`
 * fragment, a wrapped-backup link (`...#kp=...&a=...`), or a bare private key
 * (requires `fallbackAddress`). Validates and stores raw keys; a `#kp=` link
 * is recognised but NOT imported — the caller must prompt for the passphrase
 * and call importWrappedBackup with the returned wrapped blob. Returns
 * { ok, address } or, for `#kp=`,
 * { ok: false, address, needsPassphrase: true, wrapped: { blob, address } }.
 */
export const importKeyOrLink = async (text, fallbackAddress = '') => {
    const trimmed = (text || '').trim()
    if (!trimmed) return { ok: false, address: '' }
    const wrapped = parseWrappedFragment(trimmed)
    if (wrapped) {
        return {
            ok: false,
            address: wrapped.address,
            needsPassphrase: true,
            wrapped: { blob: wrapped.blob, address: wrapped.address },
        }
    }
    const parsed = parseDecryptionFragment(trimmed)
    if (parsed) {
        if (await importPrivateKeyForAddress(parsed.address, parsed.key)) {
            return { ok: true, address: parsed.address }
        }
        return { ok: false, address: parsed.address }
    }
    if (fallbackAddress && (await importPrivateKeyForAddress(fallbackAddress, trimmed))) {
        return { ok: true, address: fallbackAddress }
    }
    return { ok: false, address: '' }
}

/**
 * Remove a `#k=...&a=...` or `#kp=...&a=...` decryption fragment from a hash
 * string or a full path/URL, returning the input unchanged when it carries
 * no decryption fragment. The router uses this so its jwt/locale redirects
 * never re-add the secret key to the address bar: vue-router snapshots the
 * location (hash included) when the history is created, which can be before
 * main.js ingested and stripped the fragment.
 */
export const stripDecryptionFragment = (input) => {
    if (typeof input !== 'string' || input.length === 0) return input
    const hashIndex = input.indexOf('#')
    if (hashIndex === -1) return input
    const hash = input.slice(hashIndex)
    if (!parseDecryptionFragment(hash) && !parseWrappedFragment(hash)) return input
    return input.slice(0, hashIndex)
}

/**
 * Optional hook invoked with { address, rawKey, record } immediately after a
 * `#k=` fragment was imported, so the UI can offer wrapping the raw key with
 * a passphrase. The handler owns the rawKey string and must drop it; when no
 * handler is registered the string is dropped right away. Registering null
 * clears the handler. Returns the previous handler.
 */
export const setRawImportOfferHandler = (handler) => {
    const previous = rawImportOfferHandler
    rawImportOfferHandler = (typeof handler === 'function') ? handler : null
    return previous
}
let rawImportOfferHandler = null

const stripFragmentFromAddressBar = () => {
    try {
        const { pathname, search } = window.location
        window.history.replaceState(null, '', pathname + search)
    } catch (error) {
        console.warn('Failed to strip decryption fragment from URL', error)
    }
}

/**
 * Read the current location hash and ingest it:
 * - `#k=...&a=...` imports the raw key (see importPrivateKeyForAddress) and
 *   exposes it transiently to the raw-import offer handler, if any.
 * - `#kp=...&a=...` queues { address, blob } in `pendingWrappedImports` for
 *   the UI to prompt for the passphrase; it is NOT imported automatically.
 * Either way the fragment is stripped from the address bar (preserving path
 * and query, so the `?jwt=` auto-login flow is unaffected). Safe to call
 * when there is nothing to ingest. Returns the address the key was stored
 * for, or null.
 */
export const ingestDecryptionFragmentFromLocation = async () => {
    if (typeof window === 'undefined' || !window.location) return null
    const hash = window.location.hash || ''

    const wrapped = parseWrappedFragment(hash)
    if (wrapped) {
        pendingWrappedImports.value = [...pendingWrappedImports.value, { address: wrapped.address, blob: wrapped.blob }]
        stripFragmentFromAddressBar()
        return null
    }

    const parsed = parseDecryptionFragment(hash)
    if (!parsed) return null
    let ok = false
    let record = null
    try {
        record = await addPrivateKey(parsed.address, parsed.key)
        ok = record !== null
    } catch {
        ok = false
    }
    if (ok) {
        if (rawImportOfferHandler) {
            try {
                rawImportOfferHandler({ address: parsed.address, rawKey: parsed.key, record })
            } catch (error) {
                console.warn('Raw key import offer handler failed', error)
            }
        }
        // No handler registered: the raw string is dropped here.
    } else {
        // Never log the key material itself.
        console.warn('Ignoring invalid mail decryption key fragment for address:', parsed.address)
    }
    stripFragmentFromAddressBar()
    return ok ? parsed.address : null
}

/** Test helper: reset the queued wrapped imports. */
export const clearPendingWrappedImports = () => {
    pendingWrappedImports.value = []
}
