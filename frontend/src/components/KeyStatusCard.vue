<script setup>
/**
 * Per-mailbox key status summary for the Account Settings encryption section.
 * Three rows — key on this device, passphrase backup, passkey backup — each
 * marked present (✓) or missing (–). A missing row carries one action button
 * leading to the existing flow (import, create backup, add passkey backup,
 * sign in, or link the mailbox). Data is supplied by the host; this component
 * stays presentational so the state combinations are easy to test.
 */
import { useScopedI18n } from '@/i18n/app'

defineProps({
    hasKey: {
        type: Boolean,
        default: false,
    },
    hasPassphraseBackup: {
        type: Boolean,
        default: false,
    },
    // 'yes' | 'no' | 'not-logged-in' | 'not-bound'
    passkeyBackupState: {
        type: String,
        default: 'no',
    },
})

const emit = defineEmits(['import-key', 'create-backup', 'add-passkey-backup', 'sign-in', 'link-mailbox'])

const { t } = useScopedI18n('components.KeyStatusCard')
</script>

<template>
    <div class="key-status-card" data-testid="key-status-card">
        <p class="key-status-card__title">{{ t('title') }}</p>
        <ul class="key-status-card__list">
            <li class="key-status-card__row" data-testid="key-status-row-key">
                <span class="key-status-card__mark" :class="hasKey ? 'is-ok' : 'is-missing'">
                    {{ hasKey ? '✓' : '–' }}</span>
                <span class="key-status-card__label">{{ t('rowKey') }}</span>
                <n-button v-if="!hasKey" size="tiny" tertiary type="primary" data-testid="key-status-import-key"
                    @click="emit('import-key')">
                    {{ t('actionImportKey') }}
                </n-button>
            </li>
            <li class="key-status-card__row" data-testid="key-status-row-passphrase">
                <span class="key-status-card__mark" :class="hasPassphraseBackup ? 'is-ok' : 'is-missing'">
                    {{ hasPassphraseBackup ? '✓' : '–' }}</span>
                <span class="key-status-card__label">{{ t('rowPassphrase') }}</span>
                <n-button v-if="!hasPassphraseBackup" size="tiny" tertiary type="primary"
                    data-testid="key-status-create-backup" @click="emit('create-backup')">
                    {{ t('actionCreateBackup') }}
                </n-button>
            </li>
            <li class="key-status-card__row" data-testid="key-status-row-passkey">
                <span class="key-status-card__mark" :class="passkeyBackupState === 'yes' ? 'is-ok' : 'is-missing'">
                    {{ passkeyBackupState === 'yes' ? '✓' : '–' }}</span>
                <span class="key-status-card__label">{{ t('rowPasskey') }}</span>
                <span v-if="passkeyBackupState === 'not-logged-in'" class="muted">{{ t('passkeyNotLoggedIn') }}</span>
                <span v-else-if="passkeyBackupState === 'not-bound'" class="muted">{{ t('passkeyNotBound') }}</span>
                <n-button v-if="passkeyBackupState === 'no'" size="tiny" tertiary type="primary"
                    data-testid="key-status-add-passkey-backup" @click="emit('add-passkey-backup')">
                    {{ t('actionAddPasskeyBackup') }}
                </n-button>
                <n-button v-else-if="passkeyBackupState === 'not-logged-in'" size="tiny" tertiary type="primary"
                    data-testid="key-status-sign-in" @click="emit('sign-in')">
                    {{ t('actionSignIn') }}
                </n-button>
                <n-button v-else-if="passkeyBackupState === 'not-bound'" size="tiny" tertiary type="primary"
                    data-testid="key-status-link-mailbox" @click="emit('link-mailbox')">
                    {{ t('actionLinkMailbox') }}
                </n-button>
            </li>
        </ul>
        <p class="muted key-status-card__explainer">{{ t('explainer') }}</p>
    </div>
</template>

<style scoped>
.key-status-card {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--app-border);
    border-radius: var(--radius-lg);
    background: var(--app-surface);
}
.key-status-card__title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--font-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--app-text-3);
}
.key-status-card__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--space-2);
}
.key-status-card__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
}
.key-status-card__mark {
    flex: 0 0 auto;
    width: 14px;
    text-align: center;
    font-weight: 600;
}
.key-status-card__mark.is-ok {
    color: var(--app-success);
}
.key-status-card__mark.is-missing {
    color: var(--app-text-3);
}
.key-status-card__label {
    flex: 1 1 auto;
    font-size: var(--font-sm);
    line-height: 20px;
    color: var(--app-text-1);
}
.key-status-card__explainer {
    margin: 0;
    border-top: 1px solid var(--app-divider);
    padding-top: var(--space-2);
}
</style>
