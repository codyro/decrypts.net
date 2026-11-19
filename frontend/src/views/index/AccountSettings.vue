<script setup>
import { ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { hashPassword } from '../../utils'
import { getRouterPathWithLang } from '../../utils'

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
    <div class="account-settings stack" v-if="settings.address">
        <section class="panel settings-section">
            <h3 class="panel-title settings-section__header">{{ t('accessSection') }}</h3>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('credentialTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showAddressCredential = true" secondary>
                        {{ t(openSettings.addressPasswordLoginOnly ? 'showSessionToken' : 'showAddressCredential') }}
                    </n-button>
                </div>
            </div>
            <div v-if="openSettings?.enableAddressPassword" class="settings-row">
                <span class="settings-row__text">{{ t('passwordTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showChangePassword = true" secondary>{{ t('changePassword') }}</n-button>
                </div>
            </div>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('logoutTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showLogout = true" secondary>{{ t('logout') }}</n-button>
                </div>
            </div>
        </section>
        <slot name="extra" />
        <section v-if="openSettings.enableUserDeleteEmail" class="panel panel--danger settings-section">
            <h3 class="panel-title settings-section__header danger-title">{{ t('dangerSection') }}</h3>
            <p class="muted danger-tip">{{ t('dangerSectionTip') }}</p>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('clearInboxTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showClearInbox = true" secondary type="error">{{ t('clearInbox') }}</n-button>
                </div>
            </div>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('clearSentItemsTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showClearSentItems = true" secondary type="error">{{ t('clearSentItems') }}</n-button>
                </div>
            </div>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('deleteMailboxTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showDeleteAccount = true" secondary type="error">{{ t('deleteMailbox') }}</n-button>
                </div>
            </div>
        </section>

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
    </div>
</template>

<style scoped>
.account-settings { max-width: var(--content-form); text-align: left; }
.account-settings > .settings-section + .settings-section { margin-top: 0; }
.danger-title { color: var(--app-danger); }
.danger-tip { margin: 0 0 var(--space-2); }
</style>
