/**
 * Flow state and runner for "Log in with passkey" on the mailbox card.
 *
 * The state lives in a module (not in the Login component) because a
 * successful passkey sign-in sets userJwt, which switches the landing page
 * from the Login card to the user's address list — unmounting any component
 * inside the card. The picker / "no linked mailboxes" UI therefore renders
 * in PasskeyMailboxLoginHost at app level, reading this shared state.
 *
 * Flow: run the existing account passkey authentication, store the user
 * token exactly like the user-center passkey login, then decide via
 * planLinkedMailboxLogin(): open the single linked mailbox, show the picker
 * for several, or explain the empty state.
 */
import { ref } from 'vue'
import { startAuthentication } from '@simplewebauthn/browser'

import { useGlobalState } from '../store'
import { api } from '../api'
import { getRouterPathWithLang } from './index'
import { planLinkedMailboxLogin } from './passkey-mailbox'
import i18n from '../i18n'

export const passkeyLoginFlow = ref({
    busy: false,
    // '' | 'picker' | 'none' — what the app-level host renders after sign-in.
    phase: '',
    pickerRows: [],
    // address -> true | false | 'error' (picker badge cache, per open).
    badges: {},
})

let switchToCreateHandler = null

/** Login.vue registers its "switch to the Create tab" action here. */
export const setPasskeyLoginSwitchToCreate = (handler) => {
    switchToCreateHandler = handler
}

/**
 * Offer the Create flow from the "no linked mailboxes" dialog.
 *
 * When a Login card is mounted (the dialog was opened from one), it switches
 * that card to the Create tab. When none is mounted — a successful sign-in
 * swaps the landing for the user's address list, unmounting the card — the
 * user lands on the user center instead, where the "Add Mailbox" tab holds
 * the same creation card (and a created mailbox binds to the signed-in
 * account automatically).
 */
export const switchPasskeyLoginToCreate = () => {
    const handler = switchToCreateHandler
    resetPasskeyMailboxLoginFlow()
    if (typeof handler === 'function') {
        handler()
        return
    }
    location.assign(getRouterPathWithLang('/user', i18n.global.locale.value))
}

export const resetPasskeyMailboxLoginFlow = () => {
    passkeyLoginFlow.value = { busy: false, phase: '', pickerRows: [], badges: {} }
}

const loadBackupBadges = async (rows) => {
    const { openSettings } = useGlobalState()
    if (!openSettings.value?.enableMailEncryption) return
    const targets = rows.filter((row) => row.encryption_public_key)
    await Promise.all(targets.map(async (row) => {
        try {
            const backups = await api.listKeyBackups(row.name)
            passkeyLoginFlow.value = {
                ...passkeyLoginFlow.value,
                badges: { ...passkeyLoginFlow.value.badges, [row.name]: (backups || []).length > 0 },
            }
        } catch (error) {
            console.error(error)
            passkeyLoginFlow.value = {
                ...passkeyLoginFlow.value,
                badges: { ...passkeyLoginFlow.value.badges, [row.name]: 'error' },
            }
        }
    }))
}

/** Open a linked mailbox exactly like the user center's "Open Mailbox". */
export const openBoundMailbox = async ({ row, message }) => {
    const { jwt } = useGlobalState()
    try {
        const res = await api.fetch(`/user_api/bind_address_jwt/${row.id}`)
        if (!res.jwt) {
            message.error('jwt not found')
            return
        }
        // Set the mailbox JWT and navigate: the fresh page boots with the
        // new session, same end result as the user center's push + reload.
        jwt.value = res.jwt
        location.assign(getRouterPathWithLang('/', i18n.global.locale.value))
    } catch (error) {
        console.error(error)
        message.error(error.message || 'error')
    }
}

export const startPasskeyMailboxLogin = async ({ message }) => {
    if (passkeyLoginFlow.value.busy) return
    const { userJwt } = useGlobalState()
    passkeyLoginFlow.value = { ...passkeyLoginFlow.value, busy: true, phase: '' }
    try {
        const options = await api.fetch('/user_api/passkey/authenticate_request', {
            method: 'POST',
            body: JSON.stringify({ domain: location.hostname }),
        })
        const credential = await startAuthentication({ optionsJSON: options })
        const res = await api.fetch('/user_api/passkey/authenticate_response', {
            method: 'POST',
            body: JSON.stringify({
                origin: location.origin,
                domain: location.hostname,
                credential,
            }),
        })
        // Stored exactly like the user-center passkey login. From here the
        // app-level host takes over the UI; the Login card may unmount.
        userJwt.value = res.jwt
        const { results } = await api.fetch('/user_api/bind_address?limit=100&offset=0')
        const rows = Array.isArray(results) ? results : []
        const plan = planLinkedMailboxLogin(rows)
        if (plan.type === 'open') {
            await openBoundMailbox({ row: plan.row, message })
            return
        }
        if (plan.type === 'pick') {
            passkeyLoginFlow.value = { ...passkeyLoginFlow.value, pickerRows: plan.rows }
            await loadBackupBadges(plan.rows)
            // Loading badges may take a moment; only then show the picker so
            // the badges don't pop in afterwards.
            passkeyLoginFlow.value = { ...passkeyLoginFlow.value, phase: 'picker' }
            return
        }
        passkeyLoginFlow.value = { ...passkeyLoginFlow.value, phase: 'none' }
    } catch (error) {
        console.error(error)
        message.error(error.message || 'error')
        passkeyLoginFlow.value = { ...passkeyLoginFlow.value, phase: '' }
    } finally {
        passkeyLoginFlow.value = { ...passkeyLoginFlow.value, busy: false }
    }
}
