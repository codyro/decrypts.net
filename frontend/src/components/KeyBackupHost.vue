<script setup>
import {
    ref, computed, watch,
} from 'vue'
import { useRouter } from 'vue-router'
import { useScopedI18n } from '@/i18n/app'

import { getRouterPathWithLang } from '../utils'
import { useGlobalState } from '../store'
import {
    pendingWrappedImports, importWrappedBackup,
} from '../utils/mail-fragment'
import {
    legacyMigrationPending, completeLegacyMigration, discardLegacyPlaintext,
    setWrappedBackup, keyStoreMode,
} from '../utils/mail-key-store'
import {
    wrapPrivateKey, validatePassphrase, BackupPassphraseError, BackupFormatError,
    BACKUP_MIN_PASSPHRASE_LENGTH,
} from '../utils/key-backup'
import {
    keyBackupOffer, clearKeyBackupOffer,
    rawImportOffer, clearRawImportOffer,
    legacyBackupPromptRequested, clearLegacyBackupPromptRequest,
    notifyMailKeysImported,
} from '../utils/key-backup-prompts'
import KeyBackupPanel from './KeyBackupPanel.vue'
import PasskeyWrapControls from './PasskeyWrapControls.vue'

// Global host for passphrase-protected key backup prompts. Mounted once in
// App.vue inside the message provider. Exactly one prompt is active at a
// time; raw key material is dropped on submit/skip/close.
const { t, locale } = useScopedI18n('components.KeyBackupHost')
const message = useMessage()
const router = useRouter()
const { userJwt, showUserSystem } = useGlobalState()

const accountLoggedIn = computed(() => showUserSystem.value && !!userJwt.value)

const goToAccountPage = async () => {
    await router.push(getRouterPathWithLang('/user', locale.value))
}

// ---- prompt arbitration: one at a time -----------------------------------

const legacyDismissed = ref(false) // "Later": dismissed for this session
const legacyStep = ref('choose') // 'choose' | 'passphrase'

const activePrompt = computed(() => {
    if (keyBackupOffer.value) return 'created'
    if (pendingWrappedImports.value.length > 0) return 'wrapped'
    if (rawImportOffer.value) return 'raw'
    if ((legacyMigrationPending.value || legacyBackupPromptRequested.value) && !legacyDismissed.value) return 'legacy'
    return null
})

// ---- (0) just-created key: one-time raw link + backup creation --------------

const createdShow = computed({
    get: () => activePrompt.value === 'created',
    set: (value) => { if (!value) clearKeyBackupOffer() },
})

// ---- (a) pending wrapped imports (`#kp=` queue) ----------------------------

const currentWrapped = computed(() => pendingWrappedImports.value[0] || null)
const wrappedShow = computed({
    get: () => activePrompt.value === 'wrapped',
    set: (value) => { if (!value) cancelWrapped() },
})
const wrappedPassphrase = ref('')
const wrappedError = ref('')
const wrappedBusy = ref(false)

watch(currentWrapped, () => {
    wrappedPassphrase.value = ''
    wrappedError.value = ''
})

const shiftWrappedQueue = () => {
    pendingWrappedImports.value = pendingWrappedImports.value.slice(1)
    wrappedPassphrase.value = ''
    wrappedError.value = ''
}

const errorText = (err) => {
    if (err instanceof BackupPassphraseError) return t('wrongPassphrase')
    if (err instanceof BackupFormatError) return t('invalidBackup')
    return err?.message || String(err)
}

const submitWrapped = async () => {
    const item = currentWrapped.value
    if (!item || wrappedBusy.value) return
    wrappedError.value = ''
    wrappedBusy.value = true
    try {
        await importWrappedBackup({
            blob: item.blob,
            address: item.address,
            passphrase: wrappedPassphrase.value,
        })
        shiftWrappedQueue()
        notifyMailKeysImported()
        message.success(t('importSuccess'))
    } catch (err) {
        console.error(err)
        wrappedError.value = errorText(err)
    } finally {
        wrappedBusy.value = false
    }
}

const cancelWrapped = () => {
    if (wrappedBusy.value) return
    shiftWrappedQueue()
}

// ---- (b) raw-import offer: protect a freshly imported `#k=` key ------------

const rawShow = computed({
    get: () => activePrompt.value === 'raw',
    set: (value) => { if (!value) closeRawOffer() },
})
const rawPassphrase = ref('')
const rawConfirm = ref('')
const rawError = ref('')
const rawBusy = ref(false)

const closeRawOffer = () => {
    // Dropping the ref drops the raw key string.
    clearRawImportOffer()
    rawPassphrase.value = ''
    rawConfirm.value = ''
    rawError.value = ''
}

const acceptRawOffer = async () => {
    const offer = rawImportOffer.value
    if (!offer || rawBusy.value) return
    rawError.value = ''
    if (rawPassphrase.value !== rawConfirm.value) {
        rawError.value = t('passphraseMismatch')
        return
    }
    try {
        validatePassphrase(rawPassphrase.value)
    } catch (err) {
        rawError.value = err instanceof BackupPassphraseError
            ? t('passphraseTooShort', { min: BACKUP_MIN_PASSPHRASE_LENGTH })
            : (err.message || String(err))
        return
    }
    rawBusy.value = true
    try {
        const blob = await wrapPrivateKey({
            privateKeyB64u: offer.rawKey,
            address: offer.address,
            passphrase: rawPassphrase.value,
        })
        const record = await setWrappedBackup(offer.address, offer.publicKey, blob)
        if (!record) throw new Error('backup store failed')
        message.success(t('backupCreated'))
        notifyMailKeysImported()
        closeRawOffer()
    } catch (err) {
        console.error(err)
        rawError.value = errorText(err)
    } finally {
        rawBusy.value = false
    }
}

// ---- (c) legacy plaintext migration: one-time choice -----------------------

const legacyShow = computed({
    get: () => activePrompt.value === 'legacy',
    set: (value) => { if (!value) dismissLegacy() },
})
const legacyPassphrase = ref('')
const legacyConfirm = ref('')
const legacyError = ref('')
const legacyBusy = ref(false)

watch(activePrompt, (prompt) => {
    if (prompt === 'legacy') legacyStep.value = 'choose'
})

const resetLegacyFields = () => {
    legacyPassphrase.value = ''
    legacyConfirm.value = ''
    legacyError.value = ''
}

const dismissLegacy = () => {
    // "Later": the plaintext copy stays until the user answers; only this
    // session's prompt is dismissed.
    legacyDismissed.value = true
    clearLegacyBackupPromptRequest()
    resetLegacyFields()
}

const submitLegacy = async () => {
    if (legacyBusy.value) return
    legacyError.value = ''
    if (legacyPassphrase.value !== legacyConfirm.value) {
        legacyError.value = t('passphraseMismatch')
        return
    }
    try {
        validatePassphrase(legacyPassphrase.value)
    } catch (err) {
        legacyError.value = err instanceof BackupPassphraseError
            ? t('passphraseTooShort', { min: BACKUP_MIN_PASSPHRASE_LENGTH })
            : (err.message || String(err))
        return
    }
    legacyBusy.value = true
    try {
        await completeLegacyMigration({ passphrase: legacyPassphrase.value })
        message.success(t('legacyProtected'))
        notifyMailKeysImported()
        dismissLegacy()
    } catch (err) {
        console.error(err)
        legacyError.value = errorText(err)
    } finally {
        legacyBusy.value = false
    }
}

const skipAndDeleteLegacy = () => {
    discardLegacyPlaintext()
    message.success(t('legacyDeleted'))
    dismissLegacy()
}
</script>

<template>
    <!-- (0) Just-created encrypted mailbox: one-time raw link + backup -->
    <n-modal :show="createdShow" @update:show="createdShow = $event" preset="dialog"
        :title="t('createdTitle')" data-testid="key-backup-created">
        <p>{{ t('createdTip') }}</p>
        <ol class="key-backup-host__steps">
            <li>{{ t('createdStep1') }}</li>
            <li>{{ t('createdStep2') }}</li>
        </ol>
        <KeyBackupPanel v-if="keyBackupOffer" :address="keyBackupOffer.address"
            :raw-key="keyBackupOffer.rawKey" :public-key="keyBackupOffer.publicKey" />
        <n-alert v-if="keyStoreMode === 'memory'" type="warning" :show-icon="false" :bordered="false"
            style="margin-top: 8px;">
            {{ t('keyStoreMemoryWarning') }}
        </n-alert>
        <p style="margin-top: 8px;">{{ t('encryptMailKeyLostWarning') }}</p>
        <p v-if="!accountLoggedIn" class="muted key-backup-host__signin-hint"
            data-testid="key-backup-created-signin-hint">
            {{ t('createdSignInHint') }}
            <n-button text size="tiny" type="primary" data-testid="key-backup-created-open-account"
                @click="goToAccountPage">
                {{ t('openAccount') }}
            </n-button>
        </p>
    </n-modal>

    <!-- (a) Passphrase prompt for queued `#kp=` wrapped backups -->
    <n-modal :show="wrappedShow" @update:show="wrappedShow = $event" preset="dialog"
        :title="t('wrappedImportTitle')" data-testid="key-backup-wrapped-import">
        <p>{{ t('wrappedImportTip', { address: currentWrapped?.address || '' }) }}</p>
        <n-input v-model:value="wrappedPassphrase" type="password" show-password-on="click"
            data-testid="wrapped-import-passphrase" @keyup.enter="submitWrapped" />
        <n-alert v-if="wrappedError" type="error" :show-icon="false" :bordered="false" style="margin-top: 8px;"
            data-testid="wrapped-import-error">
            {{ wrappedError }}
        </n-alert>
        <template #action>
            <n-button size="small" tertiary @click="cancelWrapped">
                {{ t('cancel') }}
            </n-button>
            <n-button size="small" type="primary" :loading="wrappedBusy" :disabled="!wrappedPassphrase"
                data-testid="wrapped-import-submit" @click="submitWrapped">
                {{ t('import') }}
            </n-button>
        </template>
    </n-modal>

    <!-- (b) Offer to protect a freshly imported raw `#k=` key -->
    <n-modal :show="rawShow" @update:show="rawShow = $event" preset="dialog" :title="t('rawOfferTitle')"
        data-testid="key-backup-raw-offer">
        <p>{{ t('rawOfferTip', { address: rawImportOffer?.address || '' }) }}</p>
        <n-form label-placement="top">
            <n-form-item :label="t('passphrase')">
                <n-input v-model:value="rawPassphrase" type="password" show-password-on="click"
                    data-testid="raw-offer-passphrase" />
            </n-form-item>
            <n-form-item :label="t('confirmPassphrase')">
                <n-input v-model:value="rawConfirm" type="password" show-password-on="click"
                    data-testid="raw-offer-confirm" @keyup.enter="acceptRawOffer" />
            </n-form-item>
        </n-form>
        <n-alert v-if="rawError" type="error" :show-icon="false" :bordered="false" data-testid="raw-offer-error">
            {{ rawError }}
        </n-alert>
        <!-- Independent passkey alternative: wrap + upload with a passkey. -->
        <PasskeyWrapControls v-if="rawImportOffer" :address="rawImportOffer.address"
            :key-id="rawImportOffer.publicKey" :raw-key="rawImportOffer.rawKey" @done="closeRawOffer" />
        <template #action>
            <n-button size="small" tertiary data-testid="raw-offer-skip" @click="closeRawOffer">
                {{ t('skip') }}
            </n-button>
            <n-button size="small" type="primary" :loading="rawBusy" data-testid="raw-offer-create"
                @click="acceptRawOffer">
                {{ t('createBackup') }}
            </n-button>
        </template>
    </n-modal>

    <!-- (c) One-time legacy plaintext migration choice -->
    <n-modal :show="legacyShow && legacyStep === 'choose'" @update:show="(v) => { if (!v) dismissLegacy() }"
        preset="dialog" :title="t('legacyTitle')" data-testid="key-backup-legacy-migration">
        <p>{{ t('legacyTip') }}</p>
        <n-space vertical :size="8" style="width: 100%;">
            <n-button block type="primary" data-testid="legacy-choose-passphrase"
                @click="legacyStep = 'passphrase'; legacyError = ''">
                {{ t('legacyChoosePassphrase') }}
            </n-button>
            <n-popconfirm @positive-click="skipAndDeleteLegacy">
                <template #trigger>
                    <n-button block tertiary type="error" data-testid="legacy-choose-delete">
                        {{ t('legacyChooseDelete') }}
                    </n-button>
                </template>
                {{ t('legacyDeleteConfirm') }}
            </n-popconfirm>
            <n-button block tertiary data-testid="legacy-choose-later" @click="dismissLegacy">
                {{ t('legacyChooseLater') }}
            </n-button>
        </n-space>
    </n-modal>

    <n-modal :show="legacyShow && legacyStep === 'passphrase'" @update:show="(v) => { if (!v) dismissLegacy() }"
        preset="dialog" :title="t('legacyTitle')" data-testid="key-backup-legacy-passphrase">
        <p>{{ t('legacyTip') }}</p>
        <n-form label-placement="top">
            <n-form-item :label="t('passphrase')">
                <n-input v-model:value="legacyPassphrase" type="password" show-password-on="click"
                    data-testid="legacy-passphrase" />
            </n-form-item>
            <n-form-item :label="t('confirmPassphrase')">
                <n-input v-model:value="legacyConfirm" type="password" show-password-on="click"
                    data-testid="legacy-confirm" @keyup.enter="submitLegacy" />
            </n-form-item>
        </n-form>
        <n-alert v-if="legacyError" type="error" :show-icon="false" :bordered="false" data-testid="legacy-error">
            {{ legacyError }}
        </n-alert>
        <template #action>
            <n-button size="small" tertiary :disabled="legacyBusy"
                @click="legacyStep = 'choose'; legacyError = ''">
                {{ t('back') }}
            </n-button>
            <n-button size="small" type="primary" :loading="legacyBusy" data-testid="legacy-submit"
                @click="submitLegacy">
                {{ t('legacyChoosePassphrase') }}
            </n-button>
        </template>
    </n-modal>
</template>

<style scoped>
.key-backup-host__steps {
    margin: 8px 0 0;
    padding-left: 20px;
    display: grid;
    gap: 4px;
    color: var(--app-text-2);
    font-size: var(--font-sm);
    line-height: 20px;
}
.key-backup-host__signin-hint {
    margin: 8px 0 0;
}
</style>
