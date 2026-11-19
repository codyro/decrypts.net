<script setup>
import { ref, computed, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { hashPassword } from '../../utils'
import { getRouterPathWithLang } from '../../utils'
import { copyToClipboard } from '../../utils/clipboard'
import { generateKeyPair, publicKeyFromPrivate } from '../../utils/mail-crypto'
import {
    getPrivateKeys, setPrivateKey, buildDecryptionLink
} from '../../utils/mail-key-store'
import { importKeyOrLink } from '../../utils/mail-fragment'

const {
    jwt, settings, showAddressCredential, loading, openSettings
} = useGlobalState()
const router = useRouter()
const message = useMessage()

const showLogout = ref(false)
const showDeleteAccount = ref(false)
const showClearInbox = ref(false)
const showClearSentItems = ref(false)
const showChangePassword = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const { locale, t } = useScopedI18n('views.index.AccountSettings')

// ---- Mail encryption (opt-in per address) ----
const encEnabled = ref(false) // worker feature flag reported by the server
const encServerPublicKey = ref(null)
const encFingerprint = ref('')
const encKeyMatch = ref(null) // null: no local key, true/false: local key matches server key
const encBusy = ref(false)
const showRotateConfirm = ref(false)
const showDisableConfirm = ref(false)
const showExportKeyConfirm = ref(false)
const encImportInput = ref('')

const shortHash = async (value) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

const compareLocalEncryptionKey = async () => {
    encKeyMatch.value = null
    if (!encServerPublicKey.value || !settings.value.address) return
    const localKeys = getPrivateKeys(settings.value.address)
    for (const key of localKeys) {
        try {
            if (await publicKeyFromPrivate(key) === encServerPublicKey.value) {
                encKeyMatch.value = true
                return
            }
        } catch {
            // skip unusable local key material
        }
    }
    if (localKeys.length > 0) encKeyMatch.value = false
}

const refreshEncryptionStatus = async () => {
    if (!openSettings.value.enableMailEncryption || !settings.value.address) return
    try {
        const res = await api.fetch('/api/address_encryption')
        encEnabled.value = !!res.enabled
        encServerPublicKey.value = res.publicKey || null
        encFingerprint.value = encServerPublicKey.value ? await shortHash(encServerPublicKey.value) : ''
        await compareLocalEncryptionKey()
    } catch (error) {
        console.error(error)
    }
}

const uploadNewKeyPair = async () => {
    const keyPair = await generateKeyPair()
    await api.fetch('/api/address_encryption', {
        method: 'POST',
        body: JSON.stringify({ publicKey: keyPair.publicKey })
    })
    // Old private keys are kept (newest first) so mail encrypted under a
    // previous key stays readable on this device.
    setPrivateKey(settings.value.address, keyPair.privateKey)
    await refreshEncryptionStatus()
}

const enableEncryption = async () => {
    if (encBusy.value) return
    encBusy.value = true
    try {
        await uploadNewKeyPair()
        message.success(t('encryptionEnabled'))
    } catch (error) {
        message.error(error.message || 'error')
    } finally {
        encBusy.value = false
    }
}

const rotateEncryption = async () => {
    if (encBusy.value) return
    showRotateConfirm.value = false
    encBusy.value = true
    try {
        await uploadNewKeyPair()
        message.success(t('encryptionEnabled'))
    } catch (error) {
        message.error(error.message || 'error')
    } finally {
        encBusy.value = false
    }
}

const disableEncryption = async () => {
    if (encBusy.value) return
    showDisableConfirm.value = false
    encBusy.value = true
    try {
        await api.fetch('/api/address_encryption', {
            method: 'POST',
            body: JSON.stringify({ publicKey: null })
        })
        // Keep local keys: mails already stored stay encrypted.
        await refreshEncryptionStatus()
        message.success(t('success'))
    } catch (error) {
        message.error(error.message || 'error')
    } finally {
        encBusy.value = false
    }
}

const copyDecryptionLink = async () => {
    try {
        await copyToClipboard(buildDecryptionLink(settings.value.address))
        message.success(t('copySuccess'))
    } catch (error) {
        console.error(error)
        message.error(t('copyFailed'))
    }
}

const copyPrivateKey = async () => {
    try {
        const key = getPrivateKeys(settings.value.address)[0]
        await copyToClipboard(key)
        showExportKeyConfirm.value = false
        message.success(t('copySuccess'))
    } catch (error) {
        console.error(error)
        message.error(t('copyFailed'))
    }
}

const importEncryptionKey = async () => {
    const { ok } = await importKeyOrLink(encImportInput.value, settings.value.address)
    if (!ok) {
        message.error(t('encryptionImportInvalid'))
        return
    }
    encImportInput.value = ''
    await compareLocalEncryptionKey()
    message.success(t('success'))
}

const encryptionLocalKeyCount = computed(() => settings.value.address
    ? getPrivateKeys(settings.value.address).length : 0)

// openSettings may be fetched after this component mounts (lazy tab), so
// watch instead of a one-shot onMounted.
watch(() => openSettings.value.enableMailEncryption, (enabled) => {
    if (enabled) refreshEncryptionStatus()
}, { immediate: true })

const logout = async () => {
    jwt.value = '';
    await router.push(getRouterPathWithLang("/", locale.value))
    location.reload()
}

const deleteAccount = async () => {
    try {
        await api.fetch(`/api/delete_address`, {
            method: 'DELETE'
        });
        jwt.value = '';
        await router.push(getRouterPathWithLang("/", locale.value))
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
    }
};

const clearInbox = async () => {
    try {
        await api.fetch(`/api/clear_inbox`, {
            method: 'DELETE'
        });
        message.success(t("success"));
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showClearInbox.value = false;
    }
};

const clearSentItems = async () => {
    try {
        await api.fetch(`/api/clear_sent_items`, {
            method: 'DELETE'
        });
        message.success(t("success"));
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        showClearSentItems.value = false;
    }
};

const changePassword = async () => {
    if (newPassword.value !== confirmPassword.value) {
        message.error(t("passwordMismatch"));
        return;
    }
    try {
        await api.fetch(`/api/address_change_password`, {
            method: 'POST',
            body: JSON.stringify({
                new_password: await hashPassword(newPassword.value)
            })
        });
        message.success(t("passwordChanged"));
        newPassword.value = '';
        confirmPassword.value = '';
        showChangePassword.value = false;
    } catch (error) {
        message.error(error.message || "error");
    }
};
</script>

<template>
    <div class="center" v-if="settings.address">
        <n-card :bordered="false" embedded class="account-card">
            <n-button @click="showAddressCredential = true" type="primary" secondary block strong>
                {{ t(openSettings.addressPasswordLoginOnly ? 'showSessionToken' : 'showAddressCredential') }}
            </n-button>
            <template v-if="openSettings.enableMailEncryption && settings.address">
                <n-divider />
                <div class="encryption-section">
                    <n-h3 style="margin: 0 0 8px;">{{ t('mailEncryption') }}</n-h3>
                    <template v-if="encEnabled">
                        <n-alert v-if="!encServerPublicKey" type="info" :show-icon="false" :bordered="false">
                            {{ t('encryptionDisabledStatus') }}
                        </n-alert>
                        <template v-else>
                            <n-alert v-if="encKeyMatch === false" type="warning" :show-icon="false" :bordered="false">
                                {{ t('encryptionKeyMismatch') }}
                            </n-alert>
                            <n-alert v-else-if="encKeyMatch === null" type="warning" :show-icon="false" :bordered="false">
                                {{ t('encryptionNoLocalKey') }}
                            </n-alert>
                            <n-text v-if="encFingerprint" depth="3" style="display: block; margin: 4px 0;">
                                {{ t('keyFingerprint') }}: <code>{{ encFingerprint }}</code>
                            </n-text>
                        </template>
                        <n-space style="margin-top: 8px;">
                            <n-button v-if="!encServerPublicKey" size="small" type="primary" tertiary
                                :loading="encBusy" @click="enableEncryption">
                                {{ t('encryptionEnable') }}
                            </n-button>
                            <template v-else>
                                <n-button size="small" tertiary :loading="encBusy" @click="showRotateConfirm = true">
                                    {{ t('encryptionRotate') }}
                                </n-button>
                                <n-button size="small" tertiary type="error" :loading="encBusy"
                                    @click="showDisableConfirm = true">
                                    {{ t('encryptionDisable') }}
                                </n-button>
                            </template>
                            <n-button v-if="encryptionLocalKeyCount > 0" size="small" tertiary @click="copyDecryptionLink">
                                {{ t('copyDecryptionLink') }}
                            </n-button>
                            <n-button v-if="encryptionLocalKeyCount > 0" size="small" tertiary
                                @click="showExportKeyConfirm = true">
                                {{ t('encryptionExportKey') }}
                            </n-button>
                        </n-space>
                        <n-space v-if="encKeyMatch !== true" align="center" style="margin-top: 8px;">
                            <n-input v-model:value="encImportInput" size="small"
                                :placeholder="t('encryptionImportPlaceholder')" style="max-width: 320px;"
                                @keyup.enter="importEncryptionKey" />
                            <n-button size="small" tertiary type="primary" @click="importEncryptionKey">
                                {{ t('encryptionImport') }}
                            </n-button>
                        </n-space>
                    </template>
                    <n-alert v-else type="info" :show-icon="false" :bordered="false">
                        {{ t('encryptionUnavailable') }}
                    </n-alert>
                </div>
            </template>
            <n-button v-if="openSettings?.enableAddressPassword" @click="showChangePassword = true" type="info" secondary block strong>
                {{ t('changePassword') }}
            </n-button>
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showClearInbox = true" type="warning" secondary
                block strong>
                {{ t('clearInbox') }}
            </n-button>
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showClearSentItems = true" type="warning"
                secondary block strong>
                {{ t('clearSentItems') }}
            </n-button>
            <n-button @click="showLogout = true" secondary block strong>
                {{ t('logout') }}
            </n-button>
            <n-divider v-if="openSettings.enableUserDeleteEmail" />
            <n-button v-if="openSettings.enableUserDeleteEmail" @click="showDeleteAccount = true" type="error" secondary
                block strong>
                {{ t('deleteMailbox') }}
            </n-button>
        </n-card>

        <n-modal v-model:show="showLogout" preset="dialog" :title="t('logout')">
            <p>{{ t('logoutConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="logout" size="small" tertiary type="warning">
                    {{ t('logout') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showDeleteAccount" preset="dialog" :title="t('deleteMailbox')">
            <p>{{ t('deleteAccountConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="deleteAccount" size="small" tertiary type="error">
                    {{ t('deleteMailbox') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showClearInbox" preset="dialog" :title="t('clearInbox')">
            <p>{{ t('clearInboxConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="clearInbox" size="small" tertiary type="warning">
                    {{ t('clearInbox') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showClearSentItems" preset="dialog" :title="t('clearSentItems')">
            <p>{{ t('clearSentItemsConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="clearSentItems" size="small" tertiary type="warning">
                    {{ t('clearSentItems') }}
                </n-button>
            </template>
        </n-modal>
        
        <n-modal v-model:show="showChangePassword" preset="dialog" :title="t('changePassword')">
            <n-form :model="{ newPassword, confirmPassword }">
                <n-form-item :label="t('newPassword')">
                    <n-input v-model:value="newPassword" type="password" placeholder="" show-password-on="click"
                        @keyup.enter="changePassword" />
                </n-form-item>
                <n-form-item :label="t('confirmPassword')">
                    <n-input v-model:value="confirmPassword" type="password" placeholder="" show-password-on="click"
                        @keyup.enter="changePassword" />
                </n-form-item>
            </n-form>
            <template #action>
                <n-button :loading="loading" @click="changePassword" size="small" tertiary type="info">
                    {{ t('changePassword') }}
                </n-button>
            </template>
        </n-modal>

        <n-modal v-model:show="showRotateConfirm" preset="dialog" :title="t('encryptionRotate')">
            <p>{{ t('encryptionRotateTip') }}</p>
            <template #action>
                <n-button :loading="encBusy" size="small" tertiary type="warning" @click="rotateEncryption">
                    {{ t('encryptionRotate') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showDisableConfirm" preset="dialog" :title="t('encryptionDisable')">
            <p>{{ t('encryptionDisableTip') }}</p>
            <template #action>
                <n-button :loading="encBusy" size="small" tertiary type="error" @click="disableEncryption">
                    {{ t('encryptionDisable') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showExportKeyConfirm" preset="dialog" :title="t('encryptionExportKey')">
            <p>{{ t('encryptionExportKeyTip') }}</p>
            <template #action>
                <n-button size="small" tertiary type="primary" @click="copyPrivateKey">
                    {{ t('encryptionExportKey') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.center {
    display: flex;
    justify-content: center;
}

.account-card {
    max-width: 800px;
    text-align: left;
}

.encryption-section {
    text-align: left;
}

.n-button {
    margin-top: 14px;
}

</style>
