<script setup>
/**
 * Shared "Protect with passkey" control for the key-backup flows that hold
 * the raw PKCS8 key transiently in memory (creation / rotation / raw-import
 * offer / paste-your-key-again). Renders:
 * - the action button + passkey chooser when a logged-in account, an
 *   address bound to that account and WebAuthn PRF are available;
 * - an info hint when logged in but the address is not bound yet;
 * - an info hint for mailbox-only visitors (passphrase backups remain
 *   available independently) — never an error wall.
 *
 * Key material is supplied either directly (rawKey + keyId props) or lazily
 * via the resolveKeyMaterial() prop (AccountSettings paste dialog, where the
 * key only exists inside a textarea until submit). The raw string is used
 * only transiently inside wrapKeyWithPasskey and dropped by the caller.
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'
import { api } from '../api'
import {
    isPasskeyPrfPossible, wrapKeyWithPasskey,
    PasskeyPrfUnsupportedError, PasskeyCancelledError,
} from '../utils/passkey-wrap'

const props = defineProps({
    address: {
        type: String,
        required: true,
    },
    // base64url raw public key of the key being wrapped.
    keyId: {
        type: String,
        default: '',
    },
    // Transient base64url PKCS8 private key. Alternative to resolveKeyMaterial.
    rawKey: {
        type: String,
        default: '',
    },
    // async () => ({ rawKey, keyId }) — for dialogs that parse the key at
    // click time. Must throw when the material is not usable.
    resolveKeyMaterial: {
        type: Function,
        default: null,
    },
})

const emit = defineEmits(['done'])

const { t } = useScopedI18n('components.PasskeyWrapControls')
const { userJwt } = useGlobalState()

const prfPossible = ref(false)
const bound = ref(null) // null: unknown, true/false: binding state
const passkeys = ref([])
const selectedPasskeyId = ref('')
const busy = ref(false)
const hint = ref('') // '' | 'login' | 'bind' | 'noPasskeys' | 'noKeyMaterial' | 'invalidKey'
const error = ref('') // '' | 'prfUnsupported' | 'cancelled' | message text
const success = ref(false)

const loggedIn = computed(() => !!userJwt.value)

const passkeyOptions = computed(() => passkeys.value.map((item) => ({
    label: item.passkey_name || item.passkey_id,
    value: item.passkey_id,
})))

const canProtect = computed(() => (
    prfPossible.value && loggedIn.value && bound.value === true
        && passkeys.value.length > 0
))

/** Fetch binding state and the account's passkeys (bounded pages). */
const refreshAccountContext = async () => {
    if (!loggedIn.value || !props.address) return
    try {
        const params = new URLSearchParams({ query: props.address, limit: '100', offset: '0' })
        const { results } = await api.fetch(`/user_api/bind_address?${params.toString()}`)
        bound.value = (results || []).some((row) => row.name === props.address)
        if (!bound.value) {
            passkeys.value = []
            return
        }
        passkeys.value = await api.listPasskeys()
        if (passkeys.value.length === 1) {
            selectedPasskeyId.value = passkeys.value[0].passkey_id
        } else if (!passkeys.value.some((item) => item.passkey_id === selectedPasskeyId.value)) {
            selectedPasskeyId.value = passkeys.value[0]?.passkey_id || ''
        }
    } catch (err) {
        console.error(err)
        bound.value = false
    }
}

onMounted(async () => {
    prfPossible.value = await isPasskeyPrfPossible()
    if (prfPossible.value && loggedIn.value) await refreshAccountContext()
})

watch(() => [props.address, loggedIn.value], async () => {
    bound.value = null
    success.value = false
    error.value = ''
    hint.value = ''
    if (prfPossible.value && loggedIn.value) await refreshAccountContext()
})

const protect = async () => {
    if (busy.value) return
    error.value = ''
    hint.value = ''
    success.value = false
    let material = null
    try {
        material = typeof props.resolveKeyMaterial === 'function'
            ? await props.resolveKeyMaterial()
            : { rawKey: props.rawKey, keyId: props.keyId }
    } catch (err) {
        console.error(err)
        hint.value = 'invalidKey'
        return
    }
    if (!material?.rawKey || !material?.keyId) {
        hint.value = 'noKeyMaterial'
        return
    }
    busy.value = true
    try {
        // Re-check binding at click time: right after address creation the
        // auto-bind may not have landed yet when the dialog opened.
        await refreshAccountContext()
        if (bound.value !== true) {
            hint.value = 'bind'
            return
        }
        if (!selectedPasskeyId.value) {
            hint.value = 'noPasskeys'
            return
        }
        const { blob } = await wrapKeyWithPasskey({
            privateKeyB64u: material.rawKey,
            address: props.address,
            keyId: material.keyId,
            credentialId: selectedPasskeyId.value,
        })
        await api.putKeyBackup({
            address: props.address,
            keyId: material.keyId,
            passkeyId: selectedPasskeyId.value,
            blob,
        })
        success.value = true
        emit('done')
    } catch (err) {
        console.error(err)
        if (err instanceof PasskeyPrfUnsupportedError) {
            error.value = 'prfUnsupported'
        } else if (err instanceof PasskeyCancelledError) {
            error.value = 'cancelled'
        } else {
            error.value = err?.message || String(err)
        }
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <div v-if="prfPossible" class="passkey-wrap" data-testid="passkey-wrap-controls">
        <template v-if="loggedIn && bound">
            <div class="passkey-wrap__row">
                <n-select v-if="passkeys.length > 1" v-model:value="selectedPasskeyId"
                    :options="passkeyOptions" size="small" style="min-width: 200px;"
                    data-testid="passkey-backup-select" />
                <n-button size="small" secondary type="primary" :loading="busy"
                    :disabled="!canProtect" data-testid="passkey-backup-protect" @click="protect">
                    {{ t('protectWithPasskey') }}
                </n-button>
            </div>
        </template>
        <n-alert v-else-if="loggedIn && bound === false" type="info" :show-icon="false" :bordered="false"
            data-testid="passkey-backup-bind-hint">
            {{ t('bindHint') }}
        </n-alert>
        <n-alert v-else-if="!loggedIn" type="info" :show-icon="false" :bordered="false"
            data-testid="passkey-backup-login-hint">
            {{ t('loginHint') }}
        </n-alert>

        <n-alert v-if="hint === 'bind'" type="info" :show-icon="false" :bordered="false">
            {{ t('bindHint') }}
        </n-alert>
        <n-alert v-else-if="hint === 'noPasskeys'" type="info" :show-icon="false" :bordered="false"
            data-testid="passkey-backup-no-passkeys">
            {{ t('noPasskeys') }}
        </n-alert>
        <n-alert v-else-if="hint === 'noKeyMaterial'" type="warning" :show-icon="false" :bordered="false">
            {{ t('noKeyMaterial') }}
        </n-alert>
        <n-alert v-else-if="hint === 'invalidKey'" type="error" :show-icon="false" :bordered="false">
            {{ t('invalidKey') }}
        </n-alert>
        <n-alert v-if="error === 'prfUnsupported'" type="warning" :show-icon="false" :bordered="false"
            data-testid="passkey-prf-unsupported">
            {{ t('prfUnsupported') }}
        </n-alert>
        <n-alert v-else-if="error === 'cancelled'" type="info" :show-icon="false" :bordered="false">
            {{ t('cancelled') }}
        </n-alert>
        <n-alert v-else-if="error" type="error" :show-icon="false" :bordered="false">
            {{ t('wrapFailed', { msg: error }) }}
        </n-alert>
        <n-alert v-if="success" type="success" :show-icon="false" :bordered="false"
            data-testid="passkey-backup-success">
            {{ t('success') }}
        </n-alert>
    </div>
</template>

<style scoped>
.passkey-wrap {
    display: grid;
    gap: 8px;
}
.passkey-wrap__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
</style>
