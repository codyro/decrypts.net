// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
    canOfferPasskeyMailboxLogin,
    planLinkedMailboxLogin,
    setupStepStates,
    setupOutcome,
} from '../passkey-mailbox'

describe('canOfferPasskeyMailboxLogin', () => {
    it('is offered only with the user system on and WebAuthn available', () => {
        expect(canOfferPasskeyMailboxLogin({ showUserSystem: true, webAuthnSupported: true }))
            .toBe(true)
        // User system disabled (or open settings not fetched yet).
        expect(canOfferPasskeyMailboxLogin({ showUserSystem: false, webAuthnSupported: true }))
            .toBe(false)
        // Browser without WebAuthn (jsdom, old browsers).
        expect(canOfferPasskeyMailboxLogin({ showUserSystem: true, webAuthnSupported: false }))
            .toBe(false)
        expect(canOfferPasskeyMailboxLogin({ showUserSystem: false, webAuthnSupported: false }))
            .toBe(false)
    })
})

describe('planLinkedMailboxLogin', () => {
    it('opens the single linked mailbox directly', () => {
        const rows = [{ id: 1, name: 'a@b.c' }]
        expect(planLinkedMailboxLogin(rows)).toEqual({ type: 'open', row: rows[0] })
    })

    it('offers a picker when several mailboxes are linked', () => {
        const rows = [{ id: 1, name: 'a@b.c' }, { id: 2, name: 'd@e.f' }, { id: 3, name: 'g@h.i' }]
        expect(planLinkedMailboxLogin(rows)).toEqual({ type: 'pick', rows })
    })

    it('explains the empty state when nothing is linked', () => {
        expect(planLinkedMailboxLogin([])).toEqual({ type: 'none' })
        expect(planLinkedMailboxLogin(null)).toEqual({ type: 'none' })
        expect(planLinkedMailboxLogin(undefined)).toEqual({ type: 'none' })
    })
})

describe('setupStepStates', () => {
    it('locks steps 2 and 3 before sign-in', () => {
        expect(setupStepStates({
            signedIn: false, linked: false, encrypted: true,
            backupAdded: false, backupSkipped: false,
        })).toEqual({ signin: 'todo', link: 'locked', backup: 'locked' })
    })

    it('unlocks the link step after sign-in and marks done states', () => {
        expect(setupStepStates({
            signedIn: true, linked: false, encrypted: true,
            backupAdded: false, backupSkipped: false,
        })).toEqual({ signin: 'done', link: 'todo', backup: 'locked' })
        expect(setupStepStates({
            signedIn: true, linked: true, encrypted: true,
            backupAdded: false, backupSkipped: false,
        })).toEqual({ signin: 'done', link: 'done', backup: 'todo' })
        expect(setupStepStates({
            signedIn: true, linked: true, encrypted: true,
            backupAdded: true, backupSkipped: false,
        })).toEqual({ signin: 'done', link: 'done', backup: 'done' })
    })

    it('hides step 3 for unencrypted mailboxes', () => {
        expect(setupStepStates({
            signedIn: true, linked: true, encrypted: false,
            backupAdded: false, backupSkipped: false,
        })).toEqual({ signin: 'done', link: 'done', backup: 'hidden' })
    })

    it('marks a skipped backup explicitly (partial completion without a key)', () => {
        expect(setupStepStates({
            signedIn: true, linked: true, encrypted: true,
            backupAdded: false, backupSkipped: true,
        })).toEqual({ signin: 'done', link: 'done', backup: 'skipped' })
    })
})

describe('setupOutcome', () => {
    it('plain for unencrypted mailboxes', () => {
        expect(setupOutcome({ encrypted: false, backupAdded: false })).toBe('plain')
        expect(setupOutcome({ encrypted: false, backupAdded: true })).toBe('plain')
    })

    it('with-backup only when a backup was actually added', () => {
        expect(setupOutcome({ encrypted: true, backupAdded: true })).toBe('with-backup')
        expect(setupOutcome({ encrypted: true, backupAdded: false })).toBe('without-backup')
    })
})
