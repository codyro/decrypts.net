<script setup>
import { computed, onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { startRegistration } from '@simplewebauthn/browser';
import { NButton, NPopconfirm } from 'naive-ui'
import { useStorage } from '@vueuse/core'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { isPasskeyPseudoEmail } from '../../utils/passkey-account'

const { userJwt, userSettings, jwt } = useGlobalState()
const message = useMessage()

const showLogout = ref(false)
const showCreatePasskey = ref(false)
const passkeyName = ref('')
const showPasskeyList = ref(false)
const showRenamePasskey = ref(false)
const currentPasskeyId = ref(null)
const currentPasskeyName = ref('')

const { t } = useScopedI18n('views.user.UserSettings')

// ---- passkey-only account nudges -------------------------------------------
// Passkey-only accounts have a pk-*@passkey.invalid pseudo-email. While the
// account has a single passkey, nudge to add a second one (losing the only
// passkey locks the account out forever); the dismiss is persisted per user.
const isPasskeyOnly = computed(() => isPasskeyPseudoEmail(userSettings.value.user_email))
const passkeyCount = ref(-1) // -1: unknown
const nudgeDismissed = useStorage(`passkeySecondNudgeDismissed:${userSettings.value.user_id || 0}`, '')
const showSecondPasskeyNudge = computed(() =>
    isPasskeyOnly.value
    && passkeyCount.value === 1
    && !nudgeDismissed.value
)
const dismissSecondPasskeyNudge = () => {
    nudgeDismissed.value = String(userSettings.value.user_id)
}

// If the browser is still logged into a mailbox, offer to bind it to the new
// account with the existing bind-address flow.
const mailboxBound = ref(false)
const bindOfferDismissed = ref(false)
const showBindMailboxOffer = computed(() =>
    isPasskeyOnly.value
    && !!jwt.value
    && !mailboxBound.value
    && !bindOfferDismissed.value
)
const bindCurrentMailbox = async () => {
    try {
        await api.bindUserAddress()
        mailboxBound.value = true
        message.success(t('bindCurrentMailboxDone'));
    } catch (e) {
        console.error(e)
        message.error(e.message)
    }
}


const logout = async () => {
    userJwt.value = '';
    location.reload()
}

const createPasskey = async () => {
    try {
        const options = await api.fetch(`/user_api/passkey/register_request`, {
            method: 'POST',
            body: JSON.stringify({
                domain: location.hostname,
            })
        })
        const credential = await startRegistration({ optionsJSON: options })

        // Send the result to the server and return the promise.
        await api.fetch(`/user_api/passkey/register_response`, {
            method: 'POST',
            body: JSON.stringify({
                origin: location.origin,
                passkey_name: passkeyName.value || (
                    (window.navigator.userAgentData?.platform || "Unknown")
                    + ": " + Math.random().toString(36).substring(7)
                ),
                credential
            })
        })
        message.success(t('passkeyCreated'));
        await refreshPasskeyCount();
    } catch (e) {
        console.error(e)
        message.error(e.message)
    } finally {
        passkeyName.value = ''
        showCreatePasskey.value = false
    }
}

const passkeyColumns = [
    {
        title: "Passkey ID",
        key: "passkey_id"
    },
    {
        title: t('passkey_name'),
        key: "passkey_name"
    },
    {
        title: t('created_at'),
        key: "created_at"
    },
    {
        title: t('updated_at'),
        key: "updated_at"
    },
    {
        title: t('actions'),
        key: 'actions',
        render(row) {
            return h('div', [
                [
                    h(NButton,
                        {
                            tertiary: true,
                            type: "primary",
                            onClick: () => {
                                showRenamePasskey.value = true;
                                currentPasskeyId.value = row.passkey_id;
                            }
                        },
                        { default: () => t('renamePasskey') }
                    ),
                    h(NPopconfirm,
                        {
                            onPositiveClick: async () => {
                                try {
                                    await api.fetch(`/user_api/passkey/${row.passkey_id}`, {
                                        method: 'DELETE'
                                    })
                                    await fetchPasskeyList()
                                } catch (e) {
                                    console.error(e)
                                    message.error(e.message)
                                }
                            }
                        },
                        {
                            trigger: () => h(NButton,
                                {
                                    tertiary: true,
                                    type: "error",
                                },
                                { default: () => t('deletePasskey') }
                            ),
                            default: () => `${t('deletePasskey')}?`
                        }
                    ),
                ]
            ])
        }
    }
]

const passkeyData = ref([])

const fetchPasskeyList = async () => {
    try {
        const data = await api.fetch(`/user_api/passkey`)
        passkeyData.value = data
    } catch (e) {
        console.error(e)
        message.error(e.message)
    }
}

const refreshPasskeyCount = async () => {
    try {
        const data = await api.fetch(`/user_api/passkey`)
        passkeyCount.value = (data || []).length
    } catch (e) {
        console.error(e)
    }
}

onMounted(async () => {
    if (!isPasskeyOnly.value) return;
    await refreshPasskeyCount();
})

const renamePasskey = async () => {
    try {
        await api.fetch(`/user_api/passkey/rename`, {
            method: 'POST',
            body: JSON.stringify({
                passkey_name: currentPasskeyName.value,
                passkey_id: currentPasskeyId.value
            })
        })
        await fetchPasskeyList()
    } catch (e) {
        console.error(e)
        message.error(e.message)
    } finally {
        currentPasskeyName.value = ''
        showRenamePasskey.value = false
    }
}
</script>

<template>
    <div class="user-settings stack" v-if="userSettings.user_email">
        <section class="panel settings-section">
            <h3 class="panel-title settings-section__header">{{ t('passkeySection') }}</h3>
            <n-alert v-if="showSecondPasskeyNudge" type="warning" :show-icon="false" :bordered="false" closable
                class="passkey-nudge" @close="dismissSecondPasskeyNudge">
                <div class="passkey-nudge__body">
                    <span>{{ t('passkeyOnlyNudge') }}</span>
                    <n-button size="small" tertiary type="primary" @click="showCreatePasskey = true">
                        {{ t('createPasskey') }}
                    </n-button>
                </div>
            </n-alert>
            <n-alert v-if="showBindMailboxOffer" type="info" :show-icon="false" :bordered="false" closable
                class="passkey-nudge" @close="bindOfferDismissed = true">
                <div class="passkey-nudge__body">
                    <span>{{ t('bindCurrentMailboxTip') }}</span>
                    <n-button size="small" tertiary type="primary" @click="bindCurrentMailbox">
                        {{ t('bindCurrentMailbox') }}
                    </n-button>
                </div>
            </n-alert>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('passkeyTip') }}</span>
                <div class="settings-row__action toolbar">
                    <n-button @click="showPasskeyList = true; fetchPasskeyList();" secondary>{{ t('showPasskeyList') }}</n-button>
                    <n-button @click="showCreatePasskey = true" type="primary">{{ t('createPasskey') }}</n-button>
                </div>
            </div>
            <p class="muted passkey-backup-tip" data-testid="passkey-backup-tip">{{ t('passkeyBackupTip') }}</p>
        </section>
        <section class="panel settings-section">
            <h3 class="panel-title settings-section__header">{{ t('accountSection') }}</h3>
            <p class="muted account-tip">{{ t('passordTip') }}</p>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('logoutTip') }}</span>
                <div class="settings-row__action"><n-button @click="showLogout = true" secondary>{{ t('logout') }}</n-button></div>
            </div>
        </section>
        <n-modal v-model:show="showCreatePasskey" preset="dialog" :title="t('createPasskey')">
            <n-input v-model:value="passkeyName" :placeholder="t('passkeyNamePlaceholder')" />
            <template #action>
                <n-button :loading="loading" @click="createPasskey" size="small" tertiary type="primary">
                    {{ t('createPasskey') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showRenamePasskey" preset="dialog" :title="t('renamePasskey')">
            <n-input v-model:value="currentPasskeyName" :placeholder="t('renamePasskeyNamePlaceholder')" />
            <template #action>
                <n-button :loading="loading" @click="renamePasskey" size="small" tertiary type="primary">
                    {{ t('renamePasskey') }}
                </n-button>
            </template>
        </n-modal>
        <n-modal v-model:show="showPasskeyList" preset="card" :title="t('showPasskeyList')">
            <n-data-table :columns="passkeyColumns" :data="passkeyData" :bordered="false" embedded />
        </n-modal>
        <n-modal v-model:show="showLogout" preset="dialog" :title="t('logout')">
            <p>{{ t('logoutConfirm') }}</p>
            <template #action>
                <n-button :loading="loading" @click="logout" size="small" tertiary type="warning">
                    {{ t('logout') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.user-settings { max-width: var(--content-form); text-align: left; }
.user-settings > .settings-section + .settings-section { margin-top: 0; }
.account-tip { margin: 0; }
.settings-row__action.toolbar { flex-wrap: nowrap; }
.passkey-nudge { margin-bottom: var(--space-3); }
.passkey-nudge__body { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.passkey-backup-tip { margin: var(--space-2) 0 0; }
@media (max-width: 767.98px) {
    .settings-row__action.toolbar { flex-direction: column; align-items: stretch; }
}
</style>
