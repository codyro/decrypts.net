/**
 * Browser-side store for per-mailbox end-to-end encryption private keys.
 *
 * Keys are persisted in localStorage (never sent to the server) as a map of
 * address -> array of base64url PKCS8 private keys, newest first. Multiple
 * keys per address are kept so mail encrypted under a rotated key stays
 * readable as long as any of its private keys is still stored.
 *
 * Plain module (no Vue component required): `processItem` in email-parser.js
 * and the fragment ingestion in main.js use it directly. `mailPrivateKeys` is
 * a VueUse storage ref, so reads inside `computed`/`watch` are reactive as
 * long as mutations go through the setters below (they always replace the
 * whole map to trigger reactivity).
 */
import { useStorage } from '@vueuse/core'

const memoryStorageData = new Map()
const memoryStorage = {
    getItem: (key) => (memoryStorageData.has(key) ? memoryStorageData.get(key) : null),
    setItem: (key, value) => { memoryStorageData.set(key, String(value)) },
    removeItem: (key) => { memoryStorageData.delete(key) },
    clear: () => { memoryStorageData.clear() },
}

const storage = typeof localStorage !== 'undefined' ? localStorage : memoryStorage

/** @type {import('vue').Ref<Record<string, string[]>>} */
export const mailPrivateKeys = useStorage('mailPrivateKeys', {}, storage)

// Bumped on every mutation so non-reactive callers (and tests) can observe changes.
let version = 0

const readKeys = (address) => {
    const value = mailPrivateKeys.value?.[address]
    if (Array.isArray(value)) return value.filter((key) => typeof key === 'string' && key.length > 0)
    // Backward compatibility with a single string per address.
    if (typeof value === 'string' && value.length > 0) return [value]
    return []
}

const writeKeys = (address, keys) => {
    mailPrivateKeys.value = { ...mailPrivateKeys.value, [address]: keys }
    version++
}

/** All private keys for an address, newest first. Never logged or sent anywhere. */
export const getPrivateKeys = (address) => {
    if (!address) return []
    return readKeys(address)
}

/** Newest private key for an address, or null. */
export const getPrivateKey = (address) => {
    const keys = readKeys(address)
    return keys.length > 0 ? keys[0] : null
}

/** True when at least one private key is stored for the address. */
export const hasPrivateKey = (address) => readKeys(address).length > 0

/**
 * Store a new private key for an address (newest first, deduplicated).
 * Existing keys are kept so previously encrypted mail stays readable.
 */
export const setPrivateKey = (address, privateKey) => {
    if (!address || typeof privateKey !== 'string' || privateKey.length === 0) return
    writeKeys(address, [privateKey, ...readKeys(address).filter((key) => key !== privateKey)])
}

/** Remove all stored private keys for an address. */
export const removePrivateKey = (address) => {
    if (!address || !(address in (mailPrivateKeys.value || {}))) return
    const next = { ...mailPrivateKeys.value }
    delete next[address]
    mailPrivateKeys.value = next
    version++
}

/** Monotonic mutation counter for non-reactive observers. */
export const getKeyStoreVersion = () => version

/** `${origin}/#k=<key>&a=<address>` — importing this link stores the key on any device. */
export const buildDecryptionLink = (address, baseUrl) => {
    const key = getPrivateKey(address)
    if (!key) return ''
    const origin = baseUrl
        || (typeof window !== 'undefined' && window.location ? window.location.origin : '')
    return `${origin}/#k=${encodeURIComponent(key)}&a=${encodeURIComponent(address)}`
}
