/**
 * UI glue between views / main.js and the global KeyBackupHost:
 * - `keyBackupOffer`: a transient just-created key (creation-time one-time
 *   display). Set by Login.vue right after an encrypted address was created;
 *   the host renders the backup dialog and drops the raw key on close.
 * - `rawImportOffer`: a raw key imported from a `#k=` fragment that the host
 *   offers to protect with a passphrase. main.js registers the capture
 *   BEFORE ingesting the location fragment (ingestion happens before the
 *   app mounts, so component-level registration would be too late).
 * - `legacyBackupPromptRequested`: views (AccountSettings) can ask the host
 *   to re-open the legacy-key migration prompt even when the host already
 *   dismissed it for this session.
 */
import { shallowRef } from 'vue'

import { setRawImportOfferHandler } from './mail-fragment'

/** @type {import('vue').ShallowRef<{address: string, rawKey: string, publicKey: string} | null>} */
export const keyBackupOffer = shallowRef(null)

export const offerKeyBackup = ({ address, rawKey, publicKey } = {}) => {
    if (!address || !rawKey) return
    keyBackupOffer.value = { address, rawKey, publicKey: publicKey || '' }
}

/** Drop the transient raw key (dialog closed). */
export const clearKeyBackupOffer = () => {
    keyBackupOffer.value = null
}

/** @type {import('vue').ShallowRef<{address: string, rawKey: string, publicKey: string} | null>} */
export const rawImportOffer = shallowRef(null)

export const clearRawImportOffer = () => {
    rawImportOffer.value = null
}

/**
 * True when a view explicitly requested the legacy migration prompt to be
 * shown again. The host consumes and clears this flag.
 */
export const legacyBackupPromptRequested = shallowRef(false)

/** Ask the KeyBackupHost to (re-)open the legacy migration prompt. */
export const requestLegacyBackupPrompt = () => {
    legacyBackupPromptRequested.value = true
}

/** Host-side: consume a pending request. */
export const clearLegacyBackupPromptRequest = () => {
    legacyBackupPromptRequested.value = false
}

let rawImportCaptureRegistered = false

/**
 * Register the `#k=` raw-import capture. Idempotent; must be called before
 * `ingestDecryptionFragmentFromLocation()` (main.js bootstrap).
 */
export const registerRawImportOfferCapture = () => {
    if (rawImportCaptureRegistered) return
    rawImportCaptureRegistered = true
    setRawImportOfferHandler(({ address, rawKey, record }) => {
        rawImportOffer.value = { address, rawKey, publicKey: record?.publicKey || '' }
    })
}

// ---- "keys imported" notification -----------------------------------------
// The mailboxes parse/decrypt mail when data loads. When the host imports a
// key AFTER the list rendered (passphrase prompt, raw-offer accept, legacy
// migration), the mailbox re-parses its still-locked rows in place.

export const MAIL_KEYS_IMPORTED_EVENT = 'cfte:mail-keys-imported'

export const notifyMailKeysImported = () => {
    try {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event(MAIL_KEYS_IMPORTED_EVENT))
    } catch (error) {
        console.warn('Failed to notify mail keys import', error)
    }
}
