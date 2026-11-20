<script setup>
import { ref, computed, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { publicKeyFromPrivate } from '../utils/mail-crypto'
import { addPrivateKey, getKeyRecords, getWrappedBackup, setWrappedBackup } from '../utils/mail-key-store'
import {
    wrapPrivateKey, validatePassphrase, buildBackupLink, buildBackupFileContent,
    backupFileName, BackupPassphraseError, BACKUP_MIN_PASSPHRASE_LENGTH,
} from '../utils/key-backup'
import { copyToClipboard } from '../utils/clipboard'
import PasskeyWrapControls from './PasskeyWrapControls.vue'

const props = defineProps({
    address: {
        type: String,
        required: true,
    },
    // Transient base64url PKCS8 private key (e.g. just generated or just
    // imported). May be empty, in which case only the stored wrapped backup
    // (when one exists) is offered. Owners must clear their raw-key ref when
    // the surrounding dialog closes.
    rawKey: {
        type: String,
        default: '',
    },
    publicKey: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['done'])

const { t } = useScopedI18n('components.KeyBackupPanel')
const message = useMessage()

// The public key is stored alongside the record; only when the key was never
// stored on this device (admin single-create) and no publicKey prop was
// given do we derive it from the transient raw key.
const derivedPublicKey = ref(props.publicKey || '')
watch(() => props.rawKey, async (rawKey) => {
    if (rawKey && !derivedPublicKey.value) {
        try {
            derivedPublicKey.value = await publicKeyFromPrivate(rawKey)
        } catch {
            derivedPublicKey.value = ''
        }
    }
}, { immediate: true })

// One-time raw `#k=` decryption link, built only from the transient key.
const rawLink = computed(() => {
    if (!props.rawKey || !props.address) return ''
    const origin = window.location.origin
    return `${origin}/#k=${encodeURIComponent(props.rawKey)}&a=${encodeURIComponent(props.address)}`
})

const passphrase = ref('')
const confirmPassphrase = ref('')
const busy = ref(false)
const error = ref('')
const justCreated = ref(false)

// Wrapped backup to offer: the one just created, or an already-stored one.
const wrappedBlob = computed(() => {
    if (!props.address) return null
    if (justCreated.value) {
        const fresh = getWrappedBackup(props.address)
        if (fresh) return fresh
    }
    return getWrappedBackup(props.address)
})

const copyRawLink = async () => {
    if (!rawLink.value) return
    try {
        await copyToClipboard(rawLink.value)
        message.success(t('rawLinkCopied'))
    } catch (err) {
        console.error(err)
        message.error(t('copyFailed'))
    }
}

const createBackup = async () => {
    error.value = ''
    if (!props.rawKey) return
    if (passphrase.value !== confirmPassphrase.value) {
        error.value = t('passphraseMismatch')
        return
    }
    try {
        validatePassphrase(passphrase.value)
    } catch (err) {
        error.value = err instanceof BackupPassphraseError
            ? t('passphraseTooShort', { min: BACKUP_MIN_PASSPHRASE_LENGTH })
            : (err.message || String(err))
        return
    }
    busy.value = true
    try {
        const blob = await wrapPrivateKey({
            privateKeyB64u: props.rawKey,
            address: props.address,
            passphrase: passphrase.value,
        })
        const publicKey = derivedPublicKey.value
        const stored = publicKey
            && (getKeyRecords(props.address) || []).some((record) => record.publicKey === publicKey)
        const record = stored
            ? await setWrappedBackup(props.address, publicKey, blob)
            : await addPrivateKey(props.address, props.rawKey, { publicKey, wrappedBackup: blob })
        if (!record) throw new Error('backup store failed')
        justCreated.value = true
        // Raw material is no longer needed for the backup flow; owners drop
        // their refs when the dialog closes.
        passphrase.value = ''
        confirmPassphrase.value = ''
        emit('done')
    } catch (err) {
        console.error(err)
        error.value = err?.message || String(err)
    } finally {
        busy.value = false
    }
}

const copyProtectedLink = async () => {
    if (!wrappedBlob.value) return
    try {
        await copyToClipboard(buildBackupLink(props.address, wrappedBlob.value))
        message.success(t('protectedLinkCopied'))
    } catch (err) {
        console.error(err)
        message.error(t('copyFailed'))
    }
}

const downloadBackupFile = () => {
    if (!wrappedBlob.value) return
    const content = buildBackupFileContent(props.address, wrappedBlob.value)
    const file = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = backupFileName(props.address)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}
</script>

<template>
    <div class="key-backup-panel" style="text-align: left;">
        <template v-if="rawKey">
            <n-alert type="warning" :show-icon="false" :bordered="false">
                {{ t('rawLinkShownOnceWarning') }}
            </n-alert>
            <n-input :value="rawLink" type="textarea" readonly :autosize="{ minRows: 2 }"
                data-testid="key-backup-raw-link" />
            <div class="key-backup-panel__row">
                <n-button size="small" tertiary type="primary" @click="copyRawLink">
                    {{ t('copyRawLink') }}
                </n-button>
            </div>
        </template>

        <template v-if="rawKey && !justCreated">
            <p class="key-backup-panel__tip">{{ t('createBackupTip') }}</p>
            <n-form label-placement="top" class="key-backup-panel__form">
                <n-form-item :label="t('passphrase')">
                    <n-input v-model:value="passphrase" type="password" show-password-on="click"
                        data-testid="key-backup-passphrase" @keyup.enter="createBackup" />
                </n-form-item>
                <n-form-item :label="t('confirmPassphrase')">
                    <n-input v-model:value="confirmPassphrase" type="password" show-password-on="click"
                        data-testid="key-backup-confirm" @keyup.enter="createBackup" />
                </n-form-item>
            </n-form>
            <n-alert v-if="error" type="error" :show-icon="false" :bordered="false" data-testid="key-backup-error">
                {{ error }}
            </n-alert>
            <div class="key-backup-panel__row">
                <n-button size="small" type="primary" :loading="busy" :disabled="!passphrase || !confirmPassphrase"
                    data-testid="key-backup-create" @click="createBackup">
                    {{ t('createBackup') }}
                </n-button>
            </div>
            <!-- Independent alternative/complement: a passkey (WebAuthn PRF)
                wrapped backup uploaded to the account (logged-in users with a
                bound address only; others see an info hint). -->
            <PasskeyWrapControls :address="props.address" :key-id="derivedPublicKey" :raw-key="props.rawKey" />
        </template>

        <template v-if="wrappedBlob">
            <n-alert type="success" :show-icon="false" :bordered="false">
                {{ t('backupCreated') }}
            </n-alert>
            <div class="key-backup-panel__row">
                <n-button size="small" tertiary type="primary" data-testid="key-backup-copy-link"
                    @click="copyProtectedLink">
                    {{ t('copyProtectedLink') }}
                </n-button>
                <n-button size="small" secondary data-testid="key-backup-download" @click="downloadBackupFile">
                    {{ t('downloadBackupFile') }}
                </n-button>
            </div>
        </template>
    </div>
</template>

<style scoped>
.key-backup-panel {
    display: grid;
    gap: 10px;
}
.key-backup-panel__tip {
    margin: 0;
    line-height: 1.6;
}
.key-backup-panel__row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.key-backup-panel__form :deep(.n-form-item) {
    margin-bottom: 8px;
}
.key-backup-panel__form :deep(.n-form-item:last-child) {
    margin-bottom: 0;
}
</style>
