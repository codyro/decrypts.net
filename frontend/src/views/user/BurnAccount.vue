<script setup>
import { computed, ref, watch } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'
import { startAuthentication } from '@simplewebauthn/browser'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { hashPassword, getRouterPathWithLang } from '../../utils'
import { isPasskeyPseudoEmail, isWebAuthnSupported } from '../../utils/passkey-account'
import { removePrivateKeys } from '../../utils/mail-key-store'
import { burnAccount } from '../../utils/burn-account'

const {
    userOpenSettings, userSettings, userJwt, jwt, settings, locale,
} = useGlobalState()
const router = useRouter()
const message = useMessage()
const { t } = useScopedI18n('views.user.BurnAccount')

const showBurn = ref(false)
const burnBusy = ref(false)
const burnError = ref('')
const confirmInput = ref('')
const passwordInput = ref('')
const boundAddresses = ref([])
// Same localStorage key as AddressSelect/LocalAddress: the saved local
// addresses are the JWTs of mailboxes used on this browser.
const localAddressCache = useLocalStorage("LocalAddressCache", [])

const visible = computed(() => !!userOpenSettings.value.enableBurnAccount)
const isPasskeyOnly = computed(() => isPasskeyPseudoEmail(userSettings.value.user_email))
const confirmPhrase = computed(() => t('confirmPhrase'))
const phraseMatched = computed(() => confirmInput.value === confirmPhrase.value)
const canUsePasskey = computed(() => isWebAuthnSupported() && !isPasskeyOnly.value)
// Password accounts burn with their password; leaving it empty and picking
// "Confirm with passkey" burns with a passkey instead.
const canSubmit = computed(() =>
    phraseMatched.value && (isPasskeyOnly.value || passwordInput.value.length > 0)
)

const fetchBoundAddresses = async () => {
    try {
        const data = await api.fetch(`/user_api/bind_address?limit=100&offset=0`)
        boundAddresses.value = (data?.results || []).map((row) => row.name || row.address).filter(Boolean)
    } catch (e) {
        console.error(e)
        boundAddresses.value = []
    }
}

watch(showBurn, (open) => {
    if (open) {
        confirmInput.value = ''
        passwordInput.value = ''
        burnError.value = ''
        fetchBoundAddresses()
    }
})

const deleteAccountApi = async (method) => {
    const body = { origin: location.origin }
    if (method === 'password') {
        body.password = await hashPassword(passwordInput.value)
    } else {
        const options = await api.fetch(`/user_api/burn_account/challenge`, {
            method: 'POST',
            body: JSON.stringify({ domain: location.hostname }),
        })
        body.credential = await startAuthentication({ optionsJSON: options })
        body.domain = location.hostname
    }
    body.confirm = confirmInput.value
    return await api.fetch(`/user_api/burn_account`, {
        method: 'POST',
        body: JSON.stringify(body),
    })
}

const burnAccountNow = async (method) => {
    if (burnBusy.value) return
    burnBusy.value = true
    burnError.value = ''
    try {
        await burnAccount({
            deleteAccountApi: () => deleteAccountApi(method),
            removeKeys: removePrivateKeys,
            localAddressTokens: localAddressCache.value,
            setLocalAddressTokens: (tokens) => { localAddressCache.value = tokens },
            currentAddress: settings.value.address,
            clearCurrentMailbox: () => {
                jwt.value = ''
                settings.value.address = ''
            },
            clearUserToken: () => { userJwt.value = '' },
        })
        showBurn.value = false
        message.success(t('burnDone'))
        await router.push(getRouterPathWithLang("/", locale.value))
    } catch (e) {
        console.error(e)
        // The server call failed: nothing was deleted or removed locally.
        burnError.value = e.message || "error"
        message.error(e.message || "error")
    } finally {
        burnBusy.value = false
    }
}
</script>

<template>
    <section v-if="visible" class="panel panel--danger settings-section">
        <h3 class="panel-title settings-section__header danger-title">{{ t('dangerSection') }}</h3>
        <p class="muted danger-tip">{{ t('burnTip') }}</p>
        <div class="settings-row">
            <span class="settings-row__text">{{ t('burnRowTip') }}</span>
            <div class="settings-row__action">
                <n-button @click="showBurn = true" secondary type="error" data-testid="burn-account-open">
                    {{ t('burnAccount') }}
                </n-button>
            </div>
        </div>
        <n-modal v-model:show="showBurn" preset="dialog" :title="t('burnAccount')"
            data-testid="burn-account-dialog">
            <p>{{ t('burnConfirm') }}</p>
            <ul v-if="boundAddresses.length" class="burn-account__addresses mono" data-testid="burn-account-addresses">
                <li v-for="address in boundAddresses" :key="address">{{ address }}</li>
            </ul>
            <p v-else class="muted">{{ t('burnNoAddresses') }}</p>
            <p class="muted">{{ t('burnReauthTip') }}</p>
            <n-input v-model:value="confirmInput" class="burn-account__input"
                :placeholder="t('typePhrase', { phrase: confirmPhrase })"
                data-testid="burn-account-input" @keyup.enter="burnAccountNow(isPasskeyOnly ? 'passkey' : 'password')" />
            <n-input v-if="!isPasskeyOnly" v-model:value="passwordInput" class="burn-account__input" type="password"
                show-password-on="click" :placeholder="t('passwordPlaceholder')"
                data-testid="burn-account-password" @keyup.enter="burnAccountNow('password')" />
            <n-alert v-if="burnError" type="error" :show-icon="false" :bordered="false" class="burn-account__input"
                data-testid="burn-account-error">
                {{ burnError }}
            </n-alert>
            <template #action>
                <n-button size="small" tertiary @click="showBurn = false">{{ t('cancel') }}</n-button>
                <n-button v-if="canUsePasskey" size="small" tertiary :disabled="!phraseMatched" :loading="burnBusy"
                    data-testid="burn-account-passkey" @click="burnAccountNow('passkey')">
                    {{ t('confirmWithPasskey') }}
                </n-button>
                <n-button v-if="!isPasskeyOnly" size="small" type="error" :disabled="!canSubmit" :loading="burnBusy"
                    data-testid="burn-account-submit" @click="burnAccountNow('password')">
                    {{ t('burnAccount') }}
                </n-button>
            </template>
        </n-modal>
    </section>
</template>

<style scoped>
.danger-title { color: var(--app-danger); }
.danger-title::before { color: var(--app-danger); }
.danger-tip { margin: 0 0 var(--space-2); }
.burn-account__addresses {
    margin: var(--space-2) 0;
    padding-left: var(--space-4);
    max-height: 10rem;
    overflow-y: auto;
}
.burn-account__input { margin-top: var(--space-2); width: 100%; }
</style>
