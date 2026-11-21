<script setup>
import { computed } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'
import { getKeyRecords, hasWrappedBackup, keyStoreMode } from '../utils/mail-key-store'
import {
    shouldShowBackupReminder, isReminderDismissed, dismissReminderForAddress,
    reminderHiddenForSession, hideReminderForSession, requestKeyBackupSectionFocus,
} from '../utils/key-backup-reminder'

const { t } = useScopedI18n('components.KeyBackupReminder')
const { settings, indexTab } = useGlobalState()

const address = computed(() => settings.value.address || '')

const visible = computed(() => shouldShowBackupReminder({
    address: address.value,
    hasKey: getKeyRecords(address.value).length > 0,
    hasBackup: hasWrappedBackup(address.value),
    memoryMode: keyStoreMode.value === 'memory',
    dismissed: isReminderDismissed(address.value),
    sessionHidden: reminderHiddenForSession.value,
}))

const goToBackup = () => {
    // The backup controls live in Account Settings (mailbox settings tab).
    requestKeyBackupSectionFocus()
    indexTab.value = 'accountSettings'
}

const onSavedLink = () => {
    dismissReminderForAddress(address.value)
}

const onLater = () => {
    hideReminderForSession()
}
</script>

<template>
    <section v-if="visible" class="key-backup-reminder" data-testid="key-backup-reminder">
        <div class="key-backup-reminder__body">
            <p class="key-backup-reminder__title">{{ t('title') }}</p>
            <p class="key-backup-reminder__text">{{ t('body') }}</p>
        </div>
        <div class="key-backup-reminder__actions">
            <n-button size="small" type="primary" data-testid="key-backup-reminder-create"
                @click="goToBackup">
                {{ t('createBackup') }}
            </n-button>
            <n-button size="small" tertiary data-testid="key-backup-reminder-saved"
                @click="onSavedLink">
                {{ t('savedLink') }}
            </n-button>
            <n-button size="small" quaternary data-testid="key-backup-reminder-later"
                @click="onLater">
                {{ t('remindLater') }}
            </n-button>
        </div>
    </section>
</template>

<style scoped>
/* Calm warning edge, same language as the About panels: no loud
   background, just a warning-coloured edge and title. */
.key-backup-reminder {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-left: 2px solid var(--app-warning);
    border-radius: var(--radius-lg);
}

.key-backup-reminder__body { min-width: min(100%, 320px); flex: 1 1 320px; }
.key-backup-reminder__title {
    margin: 0;
    font-weight: 600;
    color: var(--app-warning);
}
.key-backup-reminder__text {
    margin: var(--space-1) 0 0;
    font-size: var(--font-sm);
    line-height: 20px;
    color: var(--app-text-3);
}
.key-backup-reminder__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    flex: 0 0 auto;
}

@media (max-width: 767.98px) {
    .key-backup-reminder__actions { width: 100%; }
    .key-backup-reminder__actions > * { flex: 1 1 auto; }
}
</style>
