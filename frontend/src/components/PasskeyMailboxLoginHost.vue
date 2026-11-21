<script setup>
/**
 * App-level host for the "Log in with passkey" flow's post-sign-in UI.
 *
 * Lives next to KeyBackupHost in App.vue so it survives the landing page
 * swapping the Login card for the user's address list once the passkey
 * account token is stored. Renders:
 * - the mailbox picker when several mailboxes are linked (with a
 *   "Passkey backup ✓ / No passkey backup" badge for encrypted ones);
 * - the "no linked mailboxes yet" explanation, with a shortcut to the
 *   Create tab (wired by Login.vue via setPasskeyLoginSwitchToCreate).
 */
import { computed } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import {
    passkeyLoginFlow, openBoundMailbox,
    resetPasskeyMailboxLoginFlow, switchPasskeyLoginToCreate,
} from '../utils/passkey-mailbox-login'

const { t } = useScopedI18n('components.PasskeyMailboxLogin')
const message = useMessage()

const showPicker = computed(() => passkeyLoginFlow.value.phase === 'picker')
const showNone = computed(() => passkeyLoginFlow.value.phase === 'none')

const pick = async (row) => {
    await openBoundMailbox({ row, message })
}

const closeNone = () => {
    resetPasskeyMailboxLoginFlow()
}

const switchToCreate = () => {
    switchPasskeyLoginToCreate()
}
</script>

<template>
    <div>
        <n-modal :show="showPicker" @update:show="(show) => { if (!show) resetPasskeyMailboxLoginFlow() }"
            preset="card" :title="t('pickerTitle')" style="max-width: 560px;"
            data-testid="passkey-mailbox-picker">
            <p class="muted pk-login-host__tip">{{ t('pickerTip') }}</p>
            <div class="pk-login-host__rows">
                <div v-for="row in passkeyLoginFlow.pickerRows" :key="row.id" class="pk-login-host__row">
                    <span class="pk-login-host__address mono">{{ row.name }}</span>
                    <n-tag v-if="row.encryption_public_key && passkeyLoginFlow.badges[row.name] === true"
                        size="tiny" type="success" data-testid="picker-badge-yes">
                        {{ t('badgeYes') }}
                    </n-tag>
                    <n-tag v-else-if="row.encryption_public_key && passkeyLoginFlow.badges[row.name] === false"
                        size="tiny" type="warning" data-testid="picker-badge-no">
                        {{ t('badgeNo') }}
                    </n-tag>
                    <n-button size="small" secondary type="primary" @click="pick(row)">
                        {{ t('open') }}
                    </n-button>
                </div>
            </div>
        </n-modal>

        <n-modal :show="showNone" @update:show="(show) => { if (!show) closeNone() }" preset="dialog"
            :title="t('loginWithPasskey')" data-testid="passkey-login-none">
            <p>{{ t('noneMessage') }}</p>
            <template #action>
                <n-button size="small" tertiary @click="closeNone">
                    {{ t('close') }}
                </n-button>
                <n-button size="small" type="primary" data-testid="passkey-login-none-create"
                    @click="switchToCreate">
                    {{ t('createAddress') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.pk-login-host__tip {
    margin: 0 0 var(--space-3);
}

.pk-login-host__rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.pk-login-host__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--app-border);
    border-radius: var(--radius-lg);
    background: var(--app-surface);
}

.pk-login-host__address {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: var(--font-sm);
    color: var(--app-text-1);
}
</style>
