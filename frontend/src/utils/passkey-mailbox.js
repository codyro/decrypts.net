/**
 * Decision logic for the two mailbox-level passkey flows:
 *
 * - "Log in with passkey" on the mailbox card (sign in to the passkey
 *   account, then open one of its linked mailboxes), and
 * - "Use a passkey for this mailbox" (the guided setup: sign in, link the
 *   mailbox, add a passkey backup).
 *
 * Kept as plain functions so the visibility rule, the 0/1/many linked-
 * mailbox decision and the guided-setup step machine can be unit-tested
 * without WebAuthn or the API. Copy lives in message-registry.ts and must
 * stay honest: a passkey signs you in; only a *passkey backup* (which needs
 * the mailbox key) unlocks encrypted mail on another device.
 */

/**
 * The mailbox-card passkey button mirrors the user-center passkey login:
 * offered only when the user system is enabled (it serves the passkey
 * endpoints) and the browser can do WebAuthn. The user center itself is
 * gated on showUserSystem, hence the same gate here.
 */
export const canOfferPasskeyMailboxLogin = ({ showUserSystem, webAuthnSupported }) => {
    return !!showUserSystem && !!webAuthnSupported
}

/**
 * What should happen after a successful passkey sign-in, given the account's
 * linked mailboxes (rows of /user_api/bind_address):
 * - exactly one  -> open it directly ({ type: 'open', row });
 * - several      -> let the user pick ({ type: 'pick', rows });
 * - none         -> explain and point at the setup flow ({ type: 'none' }).
 */
export const planLinkedMailboxLogin = (rows) => {
    const list = Array.isArray(rows) ? rows : []
    if (list.length === 1) return { type: 'open', row: list[0] }
    if (list.length > 1) return { type: 'pick', rows: list }
    return { type: 'none' }
}

/**
 * Step machine for the guided "Use a passkey for this mailbox" setup.
 * Returns one state per step:
 * - 'done'   : completed (rendered ✓)
 * - 'todo'   : available next (rendered as the active action)
 * - 'locked' : a previous required step is missing (rendered muted –)
 * - 'skipped': encrypted mailbox finished without a backup (rendered –)
 * - 'hidden' : not applicable (step 3 exists only for encrypted mailboxes)
 */
export const setupStepStates = ({ signedIn, linked, encrypted, backupAdded, backupSkipped }) => {
    return {
        signin: signedIn ? 'done' : 'todo',
        link: linked ? 'done' : (signedIn ? 'todo' : 'locked'),
        backup: !encrypted ? 'hidden'
            : backupAdded ? 'done'
            : (linked ? (backupSkipped ? 'skipped' : 'todo') : 'locked'),
    }
}

/**
 * Plain-language outcome of the guided setup, keyed for i18n:
 * - 'plain'         : unencrypted mailbox — passkey opens it, nothing to unlock;
 * - 'with-backup'   : passkey signs in and can unlock the mailbox elsewhere;
 * - 'without-backup': passkey opens the mailbox, but its mail stays locked on
 *                     new devices until a passkey backup is added.
 */
export const setupOutcome = ({ encrypted, backupAdded }) => {
    if (!encrypted) return 'plain'
    return backupAdded ? 'with-backup' : 'without-backup'
}
