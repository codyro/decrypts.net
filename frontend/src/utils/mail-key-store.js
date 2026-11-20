/**
 * Browser-side store for per-mailbox end-to-end encryption private keys.
 *
 * Private keys are held ONLY as non-extractable CryptoKeys (ECDH P-256,
 * usages ['deriveBits'], extractable: false) persisted in IndexedDB
 * (`cf-temp-email-keys` v1, object store `keys`). Records additionally keep
 * the base64url raw public key (65-byte point) so key-matching never needs
 * to touch private key material, and `wrappedBackup` (opaque, reserved for
 * the passphrase-wrapped backup feature). Raw/PKCS8 string copies exist
 * only transiently while generating/importing and are dropped afterwards.
 *
 * A reactive in-memory mirror (address -> records, newest first) keeps the
 * synchronous reads inside `computed`/`watch` working; `getPrivateKeys`
 * returns the CryptoKeys newest first.
 *
 * Migration: a legacy localStorage `mailPrivateKeys` entry (address ->
 * string[] | string of base64url PKCS8 keys) is imported on init. Once every
 * valid key has been durably written to IndexedDB and read back, the
 * plaintext entry is KEPT and `legacyMigrationPending` becomes true: it now
 * awaits the user's one-time choice — wrap each key with a passphrase via
 * `completeLegacyMigration` (which stores a wrapped backup on each record and
 * only then deletes the plaintext) or `discardLegacyPlaintext` (delete
 * without backups). When IndexedDB is unavailable, the plaintext entry is
 * also kept, but `legacyPlaintextKeysRetained` (not `legacyMigrationPending`)
 * exposes it: keys live in the mirror for this session only, so offering to
 * delete the only durable copy would be unsafe.
 */
import { shallowRef } from 'vue'

import { importPrivateKeyNonExtractable, publicKeyFromPrivate } from './mail-crypto'
import { validatePassphrase, wrapPrivateKey } from './key-backup'

export const KEY_STORE_DB_NAME = 'cf-temp-email-keys'
export const KEY_STORE_DB_VERSION = 1
export const KEY_STORE_OBJECT_STORE = 'keys'
const LEGACY_STORAGE_KEY = 'mailPrivateKeys'

/**
 * 'indexeddb' | 'memory'. 'memory' means IndexedDB was unavailable (or a
 * write failed) and keys are kept in the in-memory mirror for this session
 * only.
 */
export const keyStoreMode = shallowRef('indexeddb')

/**
 * True when a legacy plaintext localStorage copy of the keys still exists
 * because it could not be moved into protected storage (IndexedDB
 * unavailable); it is the user's only durable copy in that case.
 */
export const legacyPlaintextKeysRetained = shallowRef(false)

/**
 * True when a legacy plaintext entry was successfully migrated into
 * IndexedDB (keys fully usable there as non-extractable CryptoKeys) but the
 * plaintext copy still exists, awaiting the user's one-time choice between
 * `completeLegacyMigration` (wrap with a passphrase, then delete) and
 * `discardLegacyPlaintext` (delete without backups).
 */
export const legacyMigrationPending = shallowRef(false)

let version = 0
let db = null
let initPromise = null
let lastCreatedAt = 0

/** @type {import('vue').ShallowRef<Map<string, KeyRecord[]>>} address -> records, newest first */
const mirror = shallowRef(new Map())

// Monotonic createdAt so newest-first ordering survives an IndexedDB reload
// even when two keys are imported within the same millisecond.
const nextCreatedAt = () => {
    const now = Date.now()
    lastCreatedAt = Math.max(now, lastCreatedAt + 1)
    return lastCreatedAt
}

// ---- mirror helpers ----------------------------------------------------

const setMirrorRecords = (address, records) => {
    const next = new Map(mirror.value)
    if (records.length > 0) next.set(address, records)
    else next.delete(address)
    mirror.value = next
}

const upsertMirrorRecord = (record) => {
    const existing = mirror.value.get(record.address) || []
    setMirrorRecords(record.address, [record, ...existing.filter((r) => r.publicKey !== record.publicKey)])
}

// ---- IndexedDB helpers --------------------------------------------------

const idbOpen = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_STORE_DB_NAME, KEY_STORE_DB_VERSION)
    request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(KEY_STORE_OBJECT_STORE)) {
            const store = database.createObjectStore(KEY_STORE_OBJECT_STORE, { keyPath: 'id' })
            store.createIndex('by_address', 'address', { unique: false })
        }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
})

const idbTxDone = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'))
})

const idbGetAll = () => new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_OBJECT_STORE, 'readonly')
    const request = tx.objectStore(KEY_STORE_OBJECT_STORE).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error || new Error('IndexedDB read failed'))
})

const idbPut = async (record) => {
    const tx = db.transaction(KEY_STORE_OBJECT_STORE, 'readwrite')
    tx.objectStore(KEY_STORE_OBJECT_STORE).put(record)
    await idbTxDone(tx)
}

const idbDeleteByAddress = async (address) => {
    const tx = db.transaction(KEY_STORE_OBJECT_STORE, 'readwrite')
    const store = tx.objectStore(KEY_STORE_OBJECT_STORE)
    const index = store.index('by_address')
    await new Promise((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.only(address))
        request.onsuccess = () => {
            const cursor = request.result
            if (cursor) {
                cursor.delete()
                cursor.continue()
            } else {
                resolve()
            }
        }
        request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed'))
    })
    await idbTxDone(tx)
}

const switchToMemoryMode = (reason) => {
    if (keyStoreMode.value === 'memory') return
    console.warn('Mail decryption keys will be kept in memory for this session only:', reason)
    keyStoreMode.value = 'memory'
    try {
        db?.close()
    } catch {
        // ignore close failures
    }
    db = null
    if (readLegacyStorageRaw() !== null) legacyPlaintextKeysRetained.value = true
}

// ---- legacy localStorage migration --------------------------------------

const readLegacyStorageRaw = () => {
    try {
        if (typeof localStorage === 'undefined') return null
        return localStorage.getItem(LEGACY_STORAGE_KEY)
    } catch {
        return null
    }
}

const parseLegacyEntries = (raw) => {
    let parsed
    try {
        parsed = JSON.parse(raw)
    } catch {
        console.warn('Ignoring malformed legacy mail key storage entry')
        return []
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        console.warn('Ignoring malformed legacy mail key storage entry')
        return []
    }
    const entries = []
    for (const [address, value] of Object.entries(parsed)) {
        if (!address) continue
        const keys = Array.isArray(value)
            ? value.filter((key) => typeof key === 'string' && key.length > 0)
            : (typeof value === 'string' && value.length > 0 ? [value] : [])
        if (keys.length > 0) entries.push({ address, keys })
    }
    return entries
}

const migrateLegacyKeys = async () => {
    const raw = readLegacyStorageRaw()
    if (raw === null) return
    const entries = parseLegacyEntries(raw)
    const imported = [] // { address, publicKey, privateKey }
    for (const { address, keys } of entries) {
        for (const rawKey of keys) {
            let publicKey
            try {
                publicKey = await publicKeyFromPrivate(rawKey)
            } catch {
                // Never log the key material itself.
                console.warn('Dropping invalid legacy mail decryption key for address:', address)
                continue
            }
            const privateKey = await importPrivateKeyNonExtractable(rawKey)
            imported.push({ address, publicKey, privateKey })
        }
    }
    // Build records in reverse legacy order: createdAt increases per call,
    // so legacy[0] (the newest key) ends up with the largest createdAt and
    // stays first, both in the mirror (built by unshifting below) and after
    // an IndexedDB reload (sorted by createdAt desc).
    const freshReversed = []
    for (let i = imported.length - 1; i >= 0; i--) {
        const { address, publicKey, privateKey } = imported[i]
        if ((mirror.value.get(address) || []).some((record) => record.publicKey === publicKey)) continue
        freshReversed.push(buildRecord(address, publicKey, privateKey, null))
    }
    if (keyStoreMode.value === 'indexeddb' && db) {
        for (const record of freshReversed) {
            await idbPut(record)
        }
        // The plaintext copy is kept until the user answers the one-time
        // backup prompt (completeLegacyMigration / discardLegacyPlaintext);
        // only the durable-write-and-read-back outcome is verified here.
        let verified = true
        try {
            const stored = await idbGetAll()
            const storedKeys = new Set(stored.map((record) => `${record.address}|${record.publicKey}`))
            verified = imported.every((item) => storedKeys.has(`${item.address}|${item.publicKey}`))
        } catch (error) {
            console.warn('Failed to verify migrated mail keys', error)
            verified = false
        }
        if (verified) {
            for (const record of freshReversed) upsertMirrorRecord(record)
            if (readLegacyStorageRaw() !== null) legacyMigrationPending.value = true
        } else {
            console.warn('Mail key migration could not be verified; the legacy plaintext copy was kept')
            legacyPlaintextKeysRetained.value = true
        }
    } else {
        // Memory mode: import into the session mirror but KEEP the plaintext
        // copy — deleting it would strand the user's only copy of the keys.
        for (const record of freshReversed) upsertMirrorRecord(record)
        legacyPlaintextKeysRetained.value = true
        console.warn('Browser storage is unavailable: legacy plaintext decryption keys were kept in localStorage because they could not be moved to protected storage')
    }
}

const buildRecord = (address, publicKey, privateKey, wrappedBackup) => ({
    id: (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    address,
    createdAt: nextCreatedAt(),
    publicKey,
    privateKey,
    wrappedBackup: wrappedBackup ?? null,
})

const doInit = async () => {
    const hasIdb = typeof indexedDB !== 'undefined' && indexedDB !== null
    if (hasIdb) {
        try {
            db = await idbOpen()
        } catch (error) {
            switchToMemoryMode(error)
        }
    } else {
        switchToMemoryMode('IndexedDB is not available')
    }
    if (db) {
        try {
            const records = await idbGetAll()
            const grouped = new Map()
            for (const record of records) {
                if (!record?.address || !record?.privateKey) continue
                const list = grouped.get(record.address) || []
                list.push(record)
                grouped.set(record.address, list)
            }
            for (const list of grouped.values()) {
                list.sort((a, b) => b.createdAt - a.createdAt)
                for (const record of list) {
                    lastCreatedAt = Math.max(lastCreatedAt, record.createdAt || 0)
                }
            }
            mirror.value = grouped
        } catch (error) {
            switchToMemoryMode(error)
        }
    }
    await migrateLegacyKeys()
}

/**
 * Open IndexedDB, load all records into the in-memory mirror and run the
 * legacy localStorage migration. Idempotent; must be awaited before
 * ingesting `#k=`/`#kp=` fragments or mounting the app.
 */
export const initKeyStore = () => {
    if (!initPromise) {
        initPromise = doInit().catch((error) => {
            console.warn('Mail key store initialization failed', error)
            switchToMemoryMode(error)
        })
    }
    return initPromise
}

/**
 * Resolve a verified-but-not-yet-completed legacy migration by wrapping every
 * valid key from the legacy plaintext entry with `passphrase` and storing
 * each blob on the matching key record via `setWrappedBackup`. The plaintext
 * localStorage entry is deleted ONLY after every blob was durably written
 * and read back. No-op when no migration is pending or the entry is already
 * gone. Throws when a blob cannot be stored/verified (the plaintext copy is
 * kept in that case) or when the passphrase violates the policy.
 */
export const completeLegacyMigration = async ({ passphrase } = {}) => {
    if (!legacyMigrationPending.value) return
    validatePassphrase(passphrase)
    const raw = readLegacyStorageRaw()
    if (raw === null) {
        legacyMigrationPending.value = false
        return
    }
    const entries = parseLegacyEntries(raw)
    const wrapped = [] // { address, publicKey, blob }
    for (const { address, keys } of entries) {
        for (const rawKey of keys) {
            let publicKey
            try {
                publicKey = await publicKeyFromPrivate(rawKey)
            } catch {
                // Never log the key material itself. Unusable entries are
                // dropped, same as during the initial migration.
                console.warn('Skipping invalid legacy mail decryption key for address:', address)
                continue
            }
            const blob = await wrapPrivateKey({ privateKeyB64u: rawKey, address, passphrase })
            const record = await setWrappedBackup(address, publicKey, blob)
            if (!record) {
                throw new Error('No key record found for a migrated address: ' + address)
            }
            wrapped.push({ address, publicKey, blob })
        }
    }
    if (keyStoreMode.value !== 'indexeddb' || !db) {
        // The blobs would only live in the session mirror; deleting the
        // plaintext copy now could strand the user's only durable backup.
        throw new Error('Cannot complete legacy key migration while browser storage is unavailable')
    }
    const stored = await idbGetAll()
    for (const { address, publicKey, blob } of wrapped) {
        const record = stored.find((item) => item.address === address && item.publicKey === publicKey)
        if (!record || record.wrappedBackup !== blob) {
            throw new Error('Wrapped key backup could not be verified; the legacy plaintext copy was kept')
        }
    }
    try {
        localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
        // Verified durable backups exist on the records; the plaintext copy
        // will be offered again on the next session.
        console.warn('Failed to delete the legacy plaintext key entry after wrapping')
    }
    legacyMigrationPending.value = false
}

/**
 * Delete the legacy plaintext localStorage entry without creating wrapped
 * backups, and clear `legacyMigrationPending`. No-op when no migration is
 * pending or the entry is already gone.
 */
export const discardLegacyPlaintext = () => {
    legacyMigrationPending.value = false
    try {
        if (typeof localStorage === 'undefined') return
        localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
        // ignore: flag is already cleared
    }
}

// ---- public API ----------------------------------------------------------

/** Key records for an address, newest first. */
export const getKeyRecords = (address) => {
    if (!address) return []
    return [...(mirror.value.get(address) || [])]
}

/** All private keys (non-extractable CryptoKeys) for an address, newest first. */
export const getPrivateKeys = (address) => {
    if (!address) return []
    return getKeyRecords(address).map((record) => record.privateKey)
}

/** Newest private key (CryptoKey) for an address, or null. */
export const getPrivateKey = (address) => {
    const keys = getPrivateKeys(address)
    return keys.length > 0 ? keys[0] : null
}

/** True when at least one private key is stored for the address. */
export const hasPrivateKey = (address) => getKeyRecords(address).length > 0

/**
 * Store a new private key for an address (newest first, deduplicated by
 * public key). Accepts a base64url PKCS8 string (validated and imported as
 * a non-extractable CryptoKey, with the public key derived from the same
 * bytes) or an existing non-extractable CryptoKey (requires the
 * `publicKey` option, since public material cannot be derived from a
 * non-extractable key). Existing keys are kept so previously encrypted
 * mail stays readable. Returns the stored/existing record, or null when
 * the key material is invalid.
 */
export const addPrivateKey = async (address, privateKey, { publicKey, wrappedBackup } = {}) => {
    if (!address) return null
    let recordPublicKey = publicKey || null
    let cryptoKey = null
    if (typeof privateKey === 'string') {
        if (privateKey.length === 0) return null
        try {
            recordPublicKey = recordPublicKey || await publicKeyFromPrivate(privateKey)
            cryptoKey = await importPrivateKeyNonExtractable(privateKey)
        } catch {
            // Never log the key material itself.
            console.warn('Ignoring invalid mail private key for address:', address)
            return null
        }
    } else if (typeof CryptoKey !== 'undefined' && privateKey instanceof CryptoKey) {
        cryptoKey = privateKey
        if (!recordPublicKey) {
            console.warn('addPrivateKey with a CryptoKey requires the publicKey option')
            return null
        }
    } else {
        return null
    }
    const existing = mirror.value.get(address) || []
    const duplicate = existing.find((record) => record.publicKey === recordPublicKey)
    if (duplicate) {
        // Keep the stored record, but attach a supplied wrapped backup when
        // the existing record has none.
        if (wrappedBackup && !duplicate.wrappedBackup) {
            return await setWrappedBackup(address, recordPublicKey, wrappedBackup)
        }
        return duplicate
    }
    const record = buildRecord(address, recordPublicKey, cryptoKey, wrappedBackup)
    if (keyStoreMode.value === 'indexeddb' && db) {
        try {
            await idbPut(record)
        } catch (error) {
            switchToMemoryMode(error)
        }
    }
    upsertMirrorRecord(record)
    version++
    return record
}

/** Remove all stored private keys for an address. */
export const removePrivateKeys = async (address) => {
    if (!address || !mirror.value.has(address)) return
    setMirrorRecords(address, [])
    version++
    if (keyStoreMode.value === 'indexeddb' && db) {
        try {
            await idbDeleteByAddress(address)
        } catch (error) {
            console.warn('Failed to delete mail keys from IndexedDB', error)
        }
    }
}

/** Monotonic mutation counter for non-reactive observers. */
export const getKeyStoreVersion = () => version

// ---- wrapped (passphrase-protected) backups --------------------------------

/**
 * Attach a wrapped backup blob to the key record matching `address` +
 * `publicKey`, persisting it to IndexedDB (memory mode: mirror only).
 * Returns the updated record, or null when no matching record exists or the
 * blob is invalid.
 */
export const setWrappedBackup = async (address, publicKey, blob) => {
    if (!address || !publicKey || typeof blob !== 'string' || blob.length === 0) return null
    const records = mirror.value.get(address) || []
    const record = records.find((item) => item.publicKey === publicKey)
    if (!record) return null
    const updated = { ...record, wrappedBackup: blob }
    if (keyStoreMode.value === 'indexeddb' && db) {
        try {
            await idbPut(updated)
        } catch (error) {
            switchToMemoryMode(error)
        }
    }
    upsertMirrorRecord(updated)
    version++
    return updated
}

/** The wrapped backup blob of the newest record holding one, or null. */
export const getWrappedBackup = (address) => {
    if (!address) return null
    const record = (mirror.value.get(address) || []).find((item) => typeof item.wrappedBackup === 'string')
    return record ? record.wrappedBackup : null
}

/** True when at least one stored key record holds a wrapped backup. */
export const hasWrappedBackup = (address) => {
    if (!address) return false
    return (mirror.value.get(address) || []).some((item) => typeof item.wrappedBackup === 'string')
}
