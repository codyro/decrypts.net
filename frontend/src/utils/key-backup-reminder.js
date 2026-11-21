/**
 * "Back up your key" reminder logic (mailbox page banner).
 *
 * The banner nags calmly while ALL of these hold for the current address:
 * - the address is encrypted on this device (at least one key record);
 * - no stored key record holds a protected (wrapped) backup;
 * - the user has not dismissed the reminder for this address;
 * - "remind me later" was not chosen this session;
 * - the key store is not in memory-only mode (that mode shows its own,
 *   stronger warning, so the banner must not double up).
 *
 * Dismissals ("I saved my decryption link") persist per address in
 * localStorage. This module is store-free so the visibility rules are
 * unit-testable; components read the key store and pass the facts in.
 */
import { shallowRef } from 'vue'

export const BACKUP_REMINDER_DISMISSES_KEY = 'keyBackupReminderDismissed'

/** Session-only hide flag ("Remind me later"). */
export const reminderHiddenForSession = shallowRef(false)

export const hideReminderForSession = () => {
    reminderHiddenForSession.value = true
}

/** Test helper: reset the session-only hide flag. */
export const resetReminderSessionState = () => {
    reminderHiddenForSession.value = false
}

/** Addresses whose reminder was dismissed via "I saved my decryption link". */
export const readDismissedAddresses = () => {
    try {
        if (typeof localStorage === 'undefined') return []
        const raw = localStorage.getItem(BACKUP_REMINDER_DISMISSES_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter((item) => typeof item === 'string' && item.length > 0)
    } catch {
        return []
    }
}

/** True when the reminder was dismissed for this address. */
export const isReminderDismissed = (address) => {
    if (!address) return false
    return readDismissedAddresses().includes(address)
}

/** Persist a per-address dismissal. */
export const dismissReminderForAddress = (address) => {
    if (!address) return
    const dismissed = new Set(readDismissedAddresses())
    dismissed.add(address)
    try {
        if (typeof localStorage === 'undefined') return
        localStorage.setItem(BACKUP_REMINDER_DISMISSES_KEY, JSON.stringify([...dismissed]))
    } catch {
        // ignore: the reminder simply stays visible
    }
}

/**
 * Pure visibility rule for the banner. `facts` carries the key-store
 * state so this stays free of IndexedDB / storage dependencies:
 * { address, hasKey, hasBackup, memoryMode, dismissed, sessionHidden }.
 */
export const shouldShowBackupReminder = (facts = {}) => {
    const {
        address = '',
        hasKey = false,
        hasBackup = false,
        memoryMode = false,
        dismissed = false,
        sessionHidden = false,
    } = facts
    if (!address) return false
    if (!hasKey) return false
    if (hasBackup) return false
    if (memoryMode) return false
    if (dismissed) return false
    if (sessionHidden) return false
    return true
}

// ---- "scroll to the backup section" signal ---------------------------------
// Raised by the banner / QR panel; Account Settings consumes it (also on
// mount, because its tab pane may not be mounted yet when the request fires).

export const keyBackupSectionFocusRequests = shallowRef(0)

export const requestKeyBackupSectionFocus = () => {
    keyBackupSectionFocusRequests.value++
}

// ---- deep link across a full-page reload ------------------------------------
// The user-center mailbox list links into this mailbox's Account Settings
// backup section by navigating like "Open Mailbox" (which reloads the page),
// so the request survives the reload as a session flag.

export const KEY_BACKUP_FOCUS_SESSION_KEY = 'keyBackupSectionFocus'

export const requestKeyBackupSectionFocusForNextLoad = () => {
    try {
        if (typeof sessionStorage === 'undefined') return
        sessionStorage.setItem(KEY_BACKUP_FOCUS_SESSION_KEY, '1')
    } catch {
        // ignore: the section simply won't be focused
    }
}

export const consumeKeyBackupSectionFocusForNextLoad = () => {
    try {
        if (typeof sessionStorage === 'undefined') return false
        if (sessionStorage.getItem(KEY_BACKUP_FOCUS_SESSION_KEY) !== '1') return false
        sessionStorage.removeItem(KEY_BACKUP_FOCUS_SESSION_KEY)
        return true
    } catch {
        return false
    }
}
