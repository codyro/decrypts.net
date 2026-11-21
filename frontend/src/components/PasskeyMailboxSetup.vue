<script setup>
/**
 * Guided "Use a passkey for this mailbox" setup, in three numbered steps:
 *
 *   01 Sign in or create a passkey account.
 *      (Existing session -> ✓ immediately; otherwise offer passkey-only
 *      sign-up when the operator enabled it, or passkey sign-in.)
 *   02 Link this mailbox to that account.
 *      (Existing binding -> ✓; otherwise the existing bind API. Failures —
 *      e.g. the max-address cap — show the server message and the step stays
 *      open, so nothing looks half-done.)
 *   03 Add a passkey backup (encrypted mailboxes only).
 *      Wraps the pasted saved decryption link with a passkey (WebAuthn PRF) —
 *      the same paste logic as "Create protected backup from my key". (A key
 *      that is already stored on this device is non-extractable and cannot be
 *      wrapped, so a backup can only be created while the raw link exists.)
 *      Accounts without any passkey get a "create a passkey" action here
 *      first, since a backup needs one. Skippable: the mailbox still opens
 *      with the passkey, its mail just stays locked on new devices.
 *
 * The step machine (utils/passkey-mailbox.js setupStepStates/setupOutcome) is
 * pure and unit-tested; this component only drives it. The final message
 * states exactly what the passkey can and cannot do now.
 */
import { ref, computed, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { KeyFilled } from '@vicons/material'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

import { useGlobalState } from '../store'
import { api } from '../api'
import { publicKeyFromPrivate } from '../utils/mail-crypto'
import { isWebAuthnSupported } from '../utils/passkey-account'
import {
    wrapKeyWithPasskey,
    PasskeyPrfUnsupportedError, PasskeyCancelledError,
} from '../utils/passkey-wrap'
import { extractRawKeyFromText } from '../utils/key-backup-actions'
import { setupStepStates, setupOutcome } from '../utils/passkey-mailbox'
import PasskeyHowItWorks from './PasskeyHowItWorks.vue'
import Turnstile from './Turnstile.vue'

const props = defineProps({
    show: {
        type: Boolean,
        default: false,
    },
    address: {
        type: String,
        required: true,
    },
    // Whether this mailbox has a server-side encryption public key.
    encrypted: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits(['update:show', 'done'])

const { t } = useScopedI18n('components.PasskeyMailboxSetup')
// Reuse the paste-your-key copy and the Turnstile notice verbatim.
const { t: accountT } = useScopedI18n('views.index.AccountSettings')
const { t: userLoginT } = useScopedI18n('views.user.UserLogin')
const { userJwt, userOpenSettings, openSettings } = useGlobalState()
const message = useMessage()

const signedIn = computed(() => !!userJwt.value)
const passkeySignupEnabled = computed(() => isWebAuthnSupported()
    && !!userOpenSettings.value?.enable && userOpenSettings.value?.enablePasskeySignup === true)

// Per-step runtime state. The machine in setupStepStates turns these into
// 'done' | 'todo' | 'locked' | 'skipped' | 'hidden'.
const linked = ref(null) // null: unknown, true/false
const passkeys = ref([])
const backupAdded = ref(false)
const backupSkipped = ref(false)

const stepStates = computed(() => setupStepStates({
    signedIn: signedIn.value,
    linked: linked.value === true,
    encrypted: props.encrypted,
    backupAdded: backupAdded.value,
    backupSkipped: backupSkipped.value,
}))

const finished = computed(() => {
    if (stepStates.value.link !== 'done') return false
    if (!props.encrypted) return true
    return stepStates.value.backup === 'done' || stepStates.value.backup === 'skipped'
})
const outcomeKey = computed(() => setupOutcome({
    encrypted: props.encrypted,
    backupAdded: backupAdded.value,
}))

// ---- step 1: passkey account ------------------------------------------------

const authBusy = ref(false)
const signupCfToken = ref('')
const signupTurnstileRef = ref(null)

const passkeySignIn = async () => {
    if (authBusy.value) return
    authBusy.value = true
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
        // Same storage as the user-center passkey login; no reload — the
        // dialog updates its own state and keeps guiding.
        userJwt.value = res.jwt
        await refreshAccountContext()
    } catch (error) {
        console.error(error)
        message.error(error.message || 'error')
    } finally {
        authBusy.value = false
    }
}

const passkeySignUp = async () => {
    if (authBusy.value) return
    if (openSettings.value.cfTurnstileSiteKey && !signupCfToken.value) {
        message.error(userLoginT('pleaseCompleteTurnstile'))
        return
    }
    authBusy.value = true
    try {
        const options = await api.fetch('/user_api/passkey/signup_request', {
            method: 'POST',
            body: JSON.stringify({
                domain: location.hostname,
                cf_token: signupCfToken.value,
            }),
        })
        const credential = await startRegistration({ optionsJSON: options })
        const res = await api.fetch('/user_api/passkey/signup_response', {
            method: 'POST',
            body: JSON.stringify({ origin: location.origin, credential }),
        })
        userJwt.value = res.jwt
        // Parity with the user-center flow: the account page nudges a second
        // passkey once, on its next real load.
        sessionStorage.setItem('passkeySignupFresh', '1')
        await refreshAccountContext()
    } catch (error) {
        console.error(error)
        message.error(error.message || 'error')
        signupTurnstileRef.value?.refresh?.()
    } finally {
        authBusy.value = false
    }
}

// ---- step 2: link the mailbox ------------------------------------------------

const linkBusy = ref(false)
const linkError = ref('')

const refreshAccountContext = async () => {
    if (!signedIn.value || !props.address) return
    try {
        // No `query` filter: it would be rejected for addresses containing
        // `_` or `%`; fetch the list and match the exact name instead.
        const { results } = await api.fetch('/user_api/bind_address?limit=100&offset=0')
        linked.value = (results || []).some((row) => row.name === props.address)
        if (linked.value) {
            try {
                passkeys.value = await api.listPasskeys()
            } catch (error) {
                console.error(error)
                passkeys.value = []
            }
        } else {
            passkeys.value = []
        }
    } catch (error) {
        console.error(error)
        linked.value = false
    }
}

const linkMailbox = async () => {
    if (linkBusy.value) return
    linkBusy.value = true
    linkError.value = ''
    try {
        // The existing bind API binds the currently opened mailbox (its JWT
        // is attached automatically) to the signed-in account.
        await api.bindUserAddress()
        linked.value = true
        await refreshAccountContext()
    } catch (error) {
        console.error(error)
        // E.g. the account's max-address count: show the server message and
        // keep the step open — the account part is done, the link is not.
        linkError.value = error.message || 'error'
    } finally {
        linkBusy.value = false
    }
}

// ---- step 3: passkey backup ---------------------------------------------------

const backupBusy = ref(false)
const backupError = ref('') // '' | 'prfUnsupported' | 'cancelled' | message
const backupInput = ref('')
const selectedPasskeyId = ref('')

const passkeyOptions = computed(() => passkeys.value.map((item) => ({
    label: item.passkey_name || item.passkey_id,
    value: item.passkey_id,
})))

// A backup wraps the key with one of the account's passkeys; an account
// without any (e.g. email + password) must create one first.
const createPasskeyBusy = ref(false)
const createPasskeyError = ref('')

const createAccountPasskey = async () => {
    if (createPasskeyBusy.value) return
    createPasskeyBusy.value = true
    createPasskeyError.value = ''
    try {
        // Same registration endpoints as the user center's "Create passkey".
        const options = await api.fetch('/user_api/passkey/register_request', {
            method: 'POST',
            body: JSON.stringify({ domain: location.hostname }),
        })
        const credential = await startRegistration({ optionsJSON: options })
        await api.fetch('/user_api/passkey/register_response', {
            method: 'POST',
            body: JSON.stringify({
                origin: location.origin,
                passkey_name: (window.navigator.userAgentData?.platform || 'Unknown')
                    + ': ' + Math.random().toString(36).substring(7),
                credential,
            }),
        })
        passkeys.value = await api.listPasskeys()
        selectedPasskeyId.value = ''
        message.success(t('passkeyCreated'))
    } catch (error) {
        console.error(error)
        createPasskeyError.value = error?.message || 'error'
    } finally {
        createPasskeyBusy.value = false
    }
}

const resolveKeyMaterial = async () => {
    const rawKey = extractRawKeyFromText(backupInput.value)
    if (!rawKey) throw new Error(accountT('backupKeyInvalid'))
    const keyId = await publicKeyFromPrivate(rawKey)
    return { rawKey, keyId }
}

const addBackup = async () => {
    if (backupBusy.value) return
    backupError.value = ''
    if (!selectedPasskeyId.value && passkeys.value.length > 0) {
        selectedPasskeyId.value = passkeys.value[0].passkey_id
    }
    if (!selectedPasskeyId.value) return
    let material = null
    try {
        material = await resolveKeyMaterial()
    } catch (error) {
        console.error(error)
        backupError.value = accountT('backupKeyInvalid')
        return
    }
    backupBusy.value = true
    try {
        const keyId = material.keyId
        const { blob } = await wrapKeyWithPasskey({
            privateKeyB64u: material.rawKey,
            address: props.address,
            keyId,
            credentialId: selectedPasskeyId.value,
        })
        material = null
        await api.putKeyBackup({
            address: props.address,
            keyId,
            passkeyId: selectedPasskeyId.value,
            blob,
        })
        backupAdded.value = true
        backupInput.value = ''
        emit('done')
    } catch (error) {
        console.error(error)
        if (error instanceof PasskeyPrfUnsupportedError) {
            backupError.value = 'prfUnsupported'
        } else if (error instanceof PasskeyCancelledError) {
            backupError.value = 'cancelled'
        } else {
            backupError.value = error?.message || String(error)
        }
    } finally {
        backupBusy.value = false
    }
}

const skipBackup = () => {
    backupError.value = ''
    backupSkipped.value = true
}

// ---- dialog lifecycle -----------------------------------------------------------

const close = () => {
    emit('update:show', false)
}

watch(() => props.show, async (show) => {
    if (!show) return
    // Fresh state per open; the signed-in step reflects the live session.
    linked.value = null
    backupAdded.value = false
    backupSkipped.value = false
    backupError.value = ''
    linkError.value = ''
    backupInput.value = ''
    selectedPasskeyId.value = ''
    createPasskeyError.value = ''
    // userOpenSettings is normally fetched by the user center; the mailbox
    // page may never have loaded it, so fetch it here to know whether
    // passkey-only sign-up is offered.
    if (!userOpenSettings.value?.fetched) {
        try {
            await api.getUserOpenSettings(message)
        } catch (error) {
            console.error(error)
        }
    }
    if (signedIn.value) await refreshAccountContext()
})
</script>

<template>
    <n-modal :show="props.show" @update:show="emit('update:show', $event)" preset="card"
        :title="t('title')" style="max-width: 620px;" data-testid="passkey-mailbox-setup">
        <div class="pk-setup">
            <PasskeyHowItWorks compact :signed-in="signedIn" :linked="linked === true"
                :has-passkey-backup="backupAdded" :encrypted="encrypted" />

            <ol class="pk-setup__steps">
                <li class="pk-setup__step" data-testid="setup-step-signin">
                    <span class="pk-setup__mark mono" :class="`is-${stepStates.signin}`">
                        {{ stepStates.signin === 'done' ? '✓' : '01' }}</span>
                    <div class="pk-setup__body">
                        <p class="pk-setup__text">
                            <strong>{{ t('step1Title') }}</strong> {{ t('step1Text') }}
                        </p>
                        <div v-if="stepStates.signin === 'todo'" class="pk-setup__actions">
                            <n-button v-if="passkeySignupEnabled" size="small" type="primary"
                                :loading="authBusy" data-testid="setup-passkey-signup" @click="passkeySignUp">
                                <template #icon>
                                    <n-icon :component="KeyFilled" />
                                </template>
                                {{ t('signupWithPasskey') }}
                            </n-button>
                            <n-button size="small" secondary :loading="authBusy"
                                data-testid="setup-passkey-signin" @click="passkeySignIn">
                                {{ t('signinWithPasskey') }}
                            </n-button>
                        </div>
                        <Turnstile v-if="stepStates.signin === 'todo' && passkeySignupEnabled
                            && openSettings.cfTurnstileSiteKey" ref="signupTurnstileRef"
                            v-model:value="signupCfToken" />
                        <p v-if="stepStates.signin === 'done'" class="pk-setup__status is-ok">
                            {{ t('step1Done') }}</p>
                    </div>
                </li>

                <li class="pk-setup__step" data-testid="setup-step-link">
                    <span class="pk-setup__mark mono" :class="`is-${stepStates.link}`">
                        {{ stepStates.link === 'done' ? '✓'
                            : stepStates.link === 'locked' ? '–' : '02' }}</span>
                    <div class="pk-setup__body">
                        <p class="pk-setup__text">
                            <strong>{{ t('step2Title') }}</strong> {{ t('step2Text') }}
                        </p>
                        <div v-if="stepStates.link === 'todo'" class="pk-setup__actions">
                            <n-button size="small" type="primary" :loading="linkBusy"
                                data-testid="setup-link-mailbox" @click="linkMailbox">
                                {{ t('linkMailbox') }}
                            </n-button>
                        </div>
                        <n-alert v-if="linkError" type="error" :show-icon="false" :bordered="false"
                            data-testid="setup-link-error">
                            {{ linkError }}
                        </n-alert>
                        <p v-if="stepStates.link === 'done'" class="pk-setup__status is-ok">
                            {{ t('step2Done') }}</p>
                        <p v-else-if="stepStates.link === 'locked'" class="pk-setup__status">
                            {{ t('lockedSignin') }}</p>
                    </div>
                </li>

                <li v-if="stepStates.backup !== 'hidden'" class="pk-setup__step"
                    data-testid="setup-step-backup">
                    <span class="pk-setup__mark mono" :class="`is-${stepStates.backup}`">
                        {{ stepStates.backup === 'done' ? '✓'
                            : stepStates.backup === 'skipped' ? '–' : '03' }}</span>
                    <div class="pk-setup__body">
                        <p class="pk-setup__text">
                            <strong>{{ t('step3Title') }}</strong> {{ t('step3Text') }}
                        </p>
                        <template v-if="stepStates.backup === 'todo'">
                            <n-alert v-if="passkeys.length === 0" type="warning" :show-icon="false"
                                :bordered="false" data-testid="setup-no-passkeys">
                                <div class="pk-setup__nopasskey">
                                    <span>{{ t('noPasskeyOnAccount') }}</span>
                                    <n-button size="small" secondary type="primary"
                                        :loading="createPasskeyBusy" data-testid="setup-create-passkey"
                                        @click="createAccountPasskey">
                                        {{ t('createPasskeyNow') }}
                                    </n-button>
                                </div>
                            </n-alert>
                            <n-alert v-else-if="createPasskeyError" type="error" :show-icon="false"
                                :bordered="false" data-testid="setup-create-passkey-error">
                                {{ t('createPasskeyFailed', { msg: createPasskeyError }) }}
                            </n-alert>
                            <template v-if="passkeys.length > 0">
                                <p class="muted pk-setup__tip">{{ accountT('createBackupWhyPaste') }}</p>
                                <n-input v-model:value="backupInput" type="textarea" :autosize="{ minRows: 2 }"
                                    :placeholder="accountT('createBackupInputPlaceholder')"
                                    data-testid="setup-backup-input" />
                            </template>
                            <div class="pk-setup__actions">
                                <n-select v-if="passkeys.length > 1" v-model:value="selectedPasskeyId"
                                    :options="passkeyOptions" size="small" style="min-width: 200px;"
                                    data-testid="setup-backup-select" />
                                <n-button size="small" type="primary" :loading="backupBusy"
                                    :disabled="passkeys.length === 0 || !backupInput.trim()"
                                    data-testid="setup-add-backup" @click="addBackup">
                                    {{ t('addBackup') }}
                                </n-button>
                                <n-button size="small" quaternary data-testid="setup-skip-backup"
                                    @click="skipBackup">
                                    {{ t('skipBackup') }}
                                </n-button>
                            </div>
                            <p class="muted pk-setup__tip">{{ t('noLinkFallback') }}</p>
                        </template>
                        <n-alert v-if="backupError === 'prfUnsupported'" type="warning" :show-icon="false"
                            :bordered="false" data-testid="setup-prf-unsupported">
                            {{ t('prfUnsupported') }}
                        </n-alert>
                        <n-alert v-else-if="backupError === 'cancelled'" type="info" :show-icon="false"
                            :bordered="false">
                            {{ t('cancelled') }}
                        </n-alert>
                        <n-alert v-else-if="backupError" type="error" :show-icon="false" :bordered="false"
                            data-testid="setup-backup-error">
                            {{ t('wrapFailed', { msg: backupError }) }}
                        </n-alert>
                        <p v-if="stepStates.backup === 'done'" class="pk-setup__status is-ok">
                            {{ t('step3Done') }}</p>
                        <template v-else-if="stepStates.backup === 'skipped'">
                            <p class="pk-setup__status">{{ t('step3Skipped') }}</p>
                            <p class="muted pk-setup__tip">{{ t('step3SkippedTip') }}</p>
                        </template>
                        <p v-else-if="stepStates.backup === 'locked'" class="pk-setup__status">
                            {{ t('lockedLink') }}</p>
                    </div>
                </li>
            </ol>

            <n-alert v-if="finished" type="success" :show-icon="false" :bordered="false"
                data-testid="setup-outcome">
                {{ t(`outcome${outcomeKey === 'plain' ? 'Plain'
                    : outcomeKey === 'with-backup' ? 'WithBackup' : 'WithoutBackup'}`) }}
            </n-alert>
        </div>
        <template #action>
            <n-button size="small" tertiary @click="close">
                {{ finished ? t('closeDone') : t('closeLater') }}
            </n-button>
        </template>
    </n-modal>
</template>

<style scoped>
.pk-setup {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    text-align: left;
}

.pk-setup__steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.pk-setup__step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
}

.pk-setup__mark {
    flex: 0 0 auto;
    width: 18px;
    text-align: center;
    font-size: var(--font-xs);
    line-height: 20px;
    letter-spacing: 0.08em;
    color: var(--app-accent);
}

.pk-setup__mark.is-done {
    color: var(--app-success);
    letter-spacing: 0;
}

.pk-setup__mark.is-locked {
    color: var(--app-text-3);
    letter-spacing: 0;
}

.pk-setup__mark.is-skipped {
    color: var(--app-text-3);
    letter-spacing: 0;
}

.pk-setup__body {
    min-width: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.pk-setup__text {
    margin: 0;
    font-size: var(--font-sm);
    line-height: 20px;
    color: var(--app-text-3);
}

.pk-setup__text strong {
    color: var(--app-text-1);
    font-weight: 600;
}

.pk-setup__tip {
    margin: 0;
    font-size: var(--font-xs);
    line-height: 18px;
}

.pk-setup__nopasskey {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
}

.pk-setup__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
}

.pk-setup__status {
    margin: 0;
    font-size: var(--font-xs);
    line-height: 18px;
    color: var(--app-text-3);
}

.pk-setup__status.is-ok {
    color: var(--app-success);
}
</style>
