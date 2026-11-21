import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
    shouldShowBackupReminder, isReminderDismissed, dismissReminderForAddress,
    readDismissedAddresses, reminderHiddenForSession, hideReminderForSession,
    resetReminderSessionState, BACKUP_REMINDER_DISMISSES_KEY,
} from '../key-backup-reminder';

const storageMap = new Map();
const localStorageStub = {
    getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
    setItem: (key, value) => { storageMap.set(key, String(value)); },
    removeItem: (key) => { storageMap.delete(key); },
    clear: () => { storageMap.clear(); },
};

beforeEach(() => {
    storageMap.clear();
    resetReminderSessionState();
    vi.stubGlobal('localStorage', localStorageStub);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const baseFacts = {
    address: 'remind@example.com',
    hasKey: true,
    hasBackup: false,
    memoryMode: false,
    dismissed: false,
    sessionHidden: false,
};

describe('shouldShowBackupReminder', () => {
    it('shows for an encrypted address with a key, no backup, not dismissed', () => {
        expect(shouldShowBackupReminder(baseFacts)).toBe(true);
    });

    it('hides without an address', () => {
        expect(shouldShowBackupReminder({ ...baseFacts, address: '' })).toBe(false);
    });

    it('hides for unencrypted mailboxes (no local key)', () => {
        expect(shouldShowBackupReminder({ ...baseFacts, hasKey: false })).toBe(false);
    });

    it('hides when a protected backup exists', () => {
        expect(shouldShowBackupReminder({ ...baseFacts, hasBackup: true })).toBe(false);
    });

    it('hides in memory-only key store mode (that mode has its own warning)', () => {
        expect(shouldShowBackupReminder({ ...baseFacts, memoryMode: true })).toBe(false);
    });

    it('hides when dismissed for this address', () => {
        expect(shouldShowBackupReminder({ ...baseFacts, dismissed: true })).toBe(false);
    });

    it('hides after "remind me later" for the session', () => {
        expect(shouldShowBackupReminder({ ...baseFacts, sessionHidden: true })).toBe(false);
    });
});

describe('per-address dismissal persistence', () => {
    it('is dismissed only for the addressed mailbox', () => {
        dismissReminderForAddress('a@example.com');
        expect(isReminderDismissed('a@example.com')).toBe(true);
        expect(isReminderDismissed('b@example.com')).toBe(false);
    });

    it('keeps other addresses when dismissing a new one', () => {
        dismissReminderForAddress('a@example.com');
        dismissReminderForAddress('b@example.com');
        expect(readDismissedAddresses()).toEqual(['a@example.com', 'b@example.com']);
        expect(isReminderDismissed('a@example.com')).toBe(true);
    });

    it('ignores malformed storage content', () => {
        storageMap.set(BACKUP_REMINDER_DISMISSES_KEY, '{not json');
        expect(readDismissedAddresses()).toEqual([]);
        expect(isReminderDismissed('a@example.com')).toBe(false);
    });

    it('session hide is not persisted', () => {
        hideReminderForSession();
        expect(reminderHiddenForSession.value).toBe(true);
        expect(storageMap.size).toBe(0);
        resetReminderSessionState();
        expect(reminderHiddenForSession.value).toBe(false);
    });
});

describe('deep-link focus session flag', () => {
    beforeEach(() => {
        vi.stubGlobal('sessionStorage', localStorageStub);
    });

    it('is consumed exactly once', async () => {
        const {
            requestKeyBackupSectionFocusForNextLoad,
            consumeKeyBackupSectionFocusForNextLoad,
            KEY_BACKUP_FOCUS_SESSION_KEY,
        } = await import('../key-backup-reminder');
        expect(consumeKeyBackupSectionFocusForNextLoad()).toBe(false);
        requestKeyBackupSectionFocusForNextLoad();
        expect(storageMap.get(KEY_BACKUP_FOCUS_SESSION_KEY)).toBe('1');
        expect(consumeKeyBackupSectionFocusForNextLoad()).toBe(true);
        expect(consumeKeyBackupSectionFocusForNextLoad()).toBe(false);
    });

    it('does not throw when session storage is unavailable', async () => {
        vi.stubGlobal('sessionStorage', undefined);
        const {
            requestKeyBackupSectionFocusForNextLoad,
            consumeKeyBackupSectionFocusForNextLoad,
        } = await import('../key-backup-reminder');
        expect(() => requestKeyBackupSectionFocusForNextLoad()).not.toThrow();
        expect(consumeKeyBackupSectionFocusForNextLoad()).toBe(false);
    });
});
