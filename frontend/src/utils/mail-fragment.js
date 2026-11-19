/**
 * Ingestion of private-key material from URL fragments, pasted decryption
 * links or bare keys.
 *
 * Fragment format: `#k=<base64url PKCS8 private key>&a=<mail address>`.
 * Combined with auto-login: `/?jwt=...#k=...&a=...` (the router preserves the
 * hash through its jwt/locale redirects, and main.js ingests the fragment
 * before the router even runs).
 *
 * The private key is validated with publicKeyFromPrivate before it is stored;
 * malformed input is rejected without ever printing the key material.
 */
import { publicKeyFromPrivate } from './mail-crypto'
import { setPrivateKey } from './mail-key-store'

/**
 * Parse a hash string (with or without leading '#') or a full URL containing
 * a `#k=...&a=...` fragment. Returns { key, address } or null.
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
    if (!(await isValidPrivateKey(privateKey))) return false
    setPrivateKey(address, privateKey)
    return true
}

/**
 * Accepts a pasted decryption link (`...#k=...&a=...`), a bare `#k=...&a=...`
 * fragment, or a bare private key (requires `fallbackAddress`). Validates and
 * stores the key. Returns { ok, address }.
 */
export const importKeyOrLink = async (text, fallbackAddress = '') => {
    const trimmed = (text || '').trim()
    if (!trimmed) return { ok: false, address: '' }
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
 * Remove a `#k=...&a=...` decryption fragment from a hash string or a full
 * path/URL, returning the input unchanged when it carries no decryption
 * fragment. The router uses this so its jwt/locale redirects never re-add
 * the secret key to the address bar: vue-router snapshots the location
 * (hash included) when the history is created, which can be before main.js
 * ingested and stripped the fragment.
 */
export const stripDecryptionFragment = (input) => {
    if (typeof input !== 'string' || input.length === 0) return input
    const hashIndex = input.indexOf('#')
    if (hashIndex === -1) return input
    if (!parseDecryptionFragment(input.slice(hashIndex))) return input
    return input.slice(0, hashIndex)
}

/**
 * Read the current location hash, ingest `#k=...&a=...` when present and strip
 * the fragment from the address bar (preserving path and query, so the
 * `?jwt=` auto-login flow is unaffected). Safe to call when there is nothing
 * to ingest. Returns the address the key was stored for, or null.
 */
export const ingestDecryptionFragmentFromLocation = async () => {
    if (typeof window === 'undefined' || !window.location) return null
    const parsed = parseDecryptionFragment(window.location.hash || '')
    if (!parsed) return null
    let ok = false
    try {
        ok = await importPrivateKeyForAddress(parsed.address, parsed.key)
    } catch {
        ok = false
    }
    if (!ok) {
        // Never log the key material itself.
        console.warn('Ignoring invalid mail decryption key fragment for address:', parsed.address)
    }
    try {
        const { pathname, search } = window.location
        window.history.replaceState(null, '', pathname + search)
    } catch (error) {
        console.warn('Failed to strip decryption fragment from URL', error)
    }
    return ok ? parsed.address : null
}
