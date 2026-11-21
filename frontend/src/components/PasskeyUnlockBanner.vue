<script setup>
/**
 * Inline prompt shown on the mailbox page when this device can open an
 * encrypted mailbox but doesn't have its private key, and the visitor is
 * signed in to a passkey account:
 *
 * - a passkey backup exists  -> "Unlock this mailbox with your passkey":
 *   runs the existing Restore-key-from-passkey flow (PRF unwrap, key stored
 *   as a non-extractable CryptoKey, mail re-parsed).
 * - no passkey backup        -> honest notice: mail stays locked on this
 *   device; restore the key with the saved decryption link or a passphrase
 *   backup (link into Account Settings' backup section).
 *
 * Signed-out visitors get no banner: Account Settings already shows the
 * import UI there, and nagging them to sign in on every locked mailbox would
 * be noise. All checks reuse existing endpoints (/api/address_encryption,
 * /user_api/bind_address, /user_api/key_backups).
 */
import { ref, computed, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'
import { api } from '../api'
import { getKeyRecords, addPrivateKey, getWrappedBackup } from '../utils/mail-key-store'
import {
    unwrapKeyWithPasskey,
    PasskeyPrfUnsupportedError, PasskeyUnwrapError, PasskeyCancelledError,
} from '../utils/passkey-wrap'
import { notifyMailKeysImported } from '../utils/key-backup-prompts'
import { requestKeyBackupSectionFocus } from '../utils/key-backup-reminder'

const { t } = useScopedI18n('components.PasskeyUnlockBanner')
const { settings, userJwt, indexTab, openSettings } = useGlobalState()
const message = useMessage()

const address = computed(() => settings.value.address || '')
const hasLocalKey = computed(() => getKeyRecords(address.value).length > 0)

// '' (probing/hidden) | 'restore' | 'locked'
const variant = ref('')
const backups = ref([])
const serverPublicKey = ref(null)
const restoreBusy = ref(false)
const restoreError = ref('')

let probeSeq = 0

const probe = async () => {
    const seq = ++probeSeq
    variant.value = ''
    backups.value = []
    serverPublicKey.value = null
    restoreError.value = ''
    if (!openSettings.value?.enableMailEncryption || !address.value) return
    if (!userJwt.value) return // see file doc: no banner for signed-out visitors
    if (hasLocalKey.value) return
    try {
        const enc = await api.fetch('/api/address_encryption', { showLoading: false })
        if (seq !== probeSeq) return
        if (!enc?.publicKey) return // not an encrypted mailbox
        serverPublicKey.value = enc.publicKey
        // No `query` filter: it would be rejected for addresses containing
        // `_` or `%`; fetch the list and match the exact name instead.
        const { results } = await api.fetch('/user_api/bind_address?limit=100&offset=0',
            { showLoading: false })
        if (seq !== probeSeq) return
        const bound = (results || []).some((row) => row.name === address.value)
        // Backups can only exist for a mailbox linked to this account; an
        // unlinked mailbox therefore gets the honest "no passkey backup" note.
        const list = bound ? (await api.listKeyBackups(address.value) || []) : []
        if (seq !== probeSeq) return
        backups.value = list
        variant.value = list.length > 0 ? 'restore' : 'locked'
    } catch (error) {
        console.error(error)
    }
}

watch([address, userJwt, hasLocalKey,
    () => openSettings.value?.enableMailEncryption], probe, { immediate: true })

const preferredBackup = computed(() => {
    if (!backups.value.length) return null
    return backups.value.find((backup) => backup.key_id === serverPublicKey.value)
        || backups.value[0]
})

const unlock = async () => {
    const backup = preferredBackup.value
    if (!backup || restoreBusy.value) return
    restoreBusy.value = true
    restoreError.value = ''
    try {
        // Transient raw key: imported as a non-extractable CryptoKey and
        // dropped immediately, same as the Account Settings restore flow.
        let raw = await unwrapKeyWithPasskey({
            blob: backup.blob,
            address: address.value,
            keyId: backup.key_id,
            credentialId: backup.passkey_id,
        })
        try {
            const record = await addPrivateKey(address.value, raw, {
                publicKey: backup.key_id,
                wrappedBackup: getWrappedBackup(address.value) || undefined,
            })
            if (!record) throw new Error(t('restoreFailed'))
        } finally {
            raw = null
        }
        notifyMailKeysImported()
        message.success(t('restored'))
        variant.value = ''
    } catch (error) {
        console.error(error)
        if (error instanceof PasskeyPrfUnsupportedError) {
            restoreError.value = t('prfUnsupported')
        } else if (error instanceof PasskeyCancelledError) {
            message.info(t('cancelled'))
        } else if (error instanceof PasskeyUnwrapError) {
            restoreError.value = t('unwrapFailed')
        } else {
            restoreError.value = error?.message || 'error'
        }
    } finally {
        restoreBusy.value = false
    }
}

const openBackupSettings = () => {
    // The backup controls live in Account Settings (mailbox settings tab).
    requestKeyBackupSectionFocus()
    indexTab.value = 'accountSettings'
}
</script>

<template>
    <section v-if="variant" class="pk-unlock" :data-testid="`passkey-unlock-${variant}`">
        <div class="pk-unlock__body">
            <p class="pk-unlock__title">
                {{ variant === 'restore' ? t('titleRestore') : t('titleLocked') }}
            </p>
            <p class="pk-unlock__text">
                {{ variant === 'restore' ? t('bodyRestore') : t('bodyLocked') }}
            </p>
            <n-alert v-if="restoreError" type="error" :show-icon="false" :bordered="false"
                data-testid="passkey-unlock-error">
                {{ restoreError }}
            </n-alert>
        </div>
        <div class="pk-unlock__actions">
            <n-button v-if="variant === 'restore'" size="small" type="primary" :loading="restoreBusy"
                data-testid="passkey-unlock-button" @click="unlock">
                {{ t('unlock') }}
            </n-button>
            <n-button size="small" tertiary data-testid="passkey-unlock-backup-settings"
                @click="openBackupSettings">
                {{ t('openBackupSettings') }}
            </n-button>
        </div>
    </section>
</template>

<style scoped>
.pk-unlock {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
    padding: var(--space-3) var(--space-4);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-left: 2px solid var(--app-accent);
    border-radius: var(--radius-lg);
}

.pk-unlock__body {
    min-width: min(100%, 320px);
    flex: 1 1 320px;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.pk-unlock__title {
    margin: 0;
    font-weight: 600;
    color: var(--app-text-1);
}

.pk-unlock__text {
    margin: 0;
    font-size: var(--font-sm);
    line-height: 20px;
    color: var(--app-text-3);
}

.pk-unlock__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    flex: 0 0 auto;
}

@media (max-width: 767.98px) {
    .pk-unlock__actions {
        width: 100%;
    }

    .pk-unlock__actions>* {
        flex: 1 1 auto;
    }
}
</style>
