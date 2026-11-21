<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { hashPassword } from '../../utils'
import { getRouterPathWithLang } from '../../utils'
import { generateKeyPair, publicKeyFromPrivate } from '../../utils/mail-crypto'
import {
    unwrapKeyWithPasskey,
    PasskeyPrfUnsupportedError, PasskeyUnwrapError, PasskeyCancelledError,
} from '../../utils/passkey-wrap'
import {
    addPrivateKey, getKeyRecords, getWrappedBackup, hasWrappedBackup, keyStoreMode,
    legacyMigrationPending, legacyPlaintextKeysRetained, removePrivateKeys,
} from '../../utils/mail-key-store'
import { importKeyOrLink, pendingWrappedImports } from '../../utils/mail-fragment'
import {
    buildBackupLink, buildBackupFileContent, backupFileName, parseBackupFile,
    parseWrappedFragment, BackupPassphraseError, BACKUP_MIN_PASSPHRASE_LENGTH,
} from '../../utils/key-backup'
import {
    createBackupFromPastedKey, BackupKeyInvalidError, BackupKeyMismatchError,
    extractRawKeyFromText,
} from '../../utils/key-backup-actions'
import { requestLegacyBackupPrompt, notifyMailKeysImported } from '../../utils/key-backup-prompts'
import { copyToClipboard } from '../../utils/clipboard'
import { encryptExistingMail, EncryptExistingKeyMismatchError } from '../../utils/encrypt-existing'
import {
    keyBackupSectionFocusRequests, consumeKeyBackupSectionFocusForNextLoad,
    requestKeyBackupSectionFocus,
} from '../../utils/key-backup-reminder'
import { burnMailbox, filterAddressTokens } from '../../utils/burn-mailbox'
import KeyBackupPanel from '../../components/KeyBackupPanel.vue'
import PasskeyWrapControls from '../../components/PasskeyWrapControls.vue'
import KeyStatusCard from '../../components/KeyStatusCard.vue'
import OpenDeviceQrPanel from '../../components/OpenDeviceQrPanel.vue'
import PasskeyHowItWorks from '../../components/PasskeyHowItWorks.vue'
import PasskeyMailboxSetup from '../../components/PasskeyMailboxSetup.vue'

const {
    jwt, settings, showAddressCredential, loading, openSettings,
    userJwt, showUserSystem, indexTab,
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
const showEncryptExistingConfirm = ref(false)
const encExistingRunning = ref(false)
const encExistingProgress = ref(null) // { done, remaining }
const encExistingResult = ref(null) // { encrypted, skipped } final summary
const encExistingError = ref('')
const encExistingAbort = ref(null)
const encImportInput = ref('')

const shortHash = async (value) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

const compareLocalEncryptionKey = () => {
    encKeyMatch.value = null
    if (!encServerPublicKey.value || !settings.value.address) return
    // Stored records keep the public key alongside the non-extractable
    // private key, so no private key material is ever touched here.
    const localRecords = getKeyRecords(settings.value.address)
    if (localRecords.some((record) => record.publicKey === encServerPublicKey.value)) {
        encKeyMatch.value = true
        return
    }
    if (localRecords.length > 0) encKeyMatch.value = false
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
    // Key-match labels of the passkey backup list depend on the local key
    // records, so refresh the list alongside the encryption status.
    if (accountLoggedIn.value) await refreshPasskeyBackups()
}

const uploadNewKeyPair = async () => {
    const keyPair = await generateKeyPair()
    await api.fetch('/api/address_encryption', {
        method: 'POST',
        body: JSON.stringify({ publicKey: keyPair.publicKey })
    })
    // Old private keys are kept (newest first) so mail encrypted under a
    // previous key stays readable on this device. The raw key string is
    // imported as a non-extractable CryptoKey and dropped afterwards.
    await addPrivateKey(settings.value.address, keyPair.privateKey)
    encNewKeyPair.value = keyPair
    await refreshEncryptionStatus()
}

// True when the address still has plaintext rows in inbox or sendbox.
const hasPlaintextMailLeft = async () => {
    try {
        const sum = async (box) => {
            const res = await api.fetch(`/api/encrypt_existing/pending?box=${box}&limit=1`, { showLoading: false })
            return res.remaining ?? 0
        }
        return (await sum('inbox')) + (await sum('sendbox')) > 0
    } catch {
        return false
    }
}

const offerEncryptExisting = async () => {
    if (await hasPlaintextMailLeft()) {
        showEncryptExistingConfirm.value = true
    }
}

const enableEncryption = async () => {
    if (encBusy.value) return
    encBusy.value = true
    try {
        await uploadNewKeyPair()
        message.success(t('encryptionEnabled'))
        await offerEncryptExisting()
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
        await offerEncryptExisting()
    } catch (error) {
        message.error(error.message || 'error')
    } finally {
        encBusy.value = false
    }
}

const startEncryptExisting = async () => {
    showEncryptExistingConfirm.value = false
    if (encExistingRunning.value) return
    encExistingRunning.value = true
    encExistingResult.value = null
    encExistingError.value = ''
    encExistingProgress.value = { done: 0, remaining: 0 }
    const controller = new AbortController()
    encExistingAbort.value = controller
    try {
        const totals = await encryptExistingMail({
            signal: controller.signal,
            expectedPublicKeys: getKeyRecords(settings.value.address).map((record) => record.publicKey),
            onProgress: (progress) => {
                encExistingProgress.value = { done: progress.done, remaining: progress.remaining }
            },
        })
        encExistingResult.value = totals
        message.success(t('encryptExistingDone', totals))
    } catch (error) {
        if (error?.name === 'AbortError') {
            message.info(t('encryptExistingCancelled'))
        } else if (error instanceof EncryptExistingKeyMismatchError) {
            encExistingError.value = t('encryptExistingKeyMismatch')
            message.error(t('encryptExistingKeyMismatch'))
        } else {
            encExistingError.value = error.message || 'error'
            message.error(t('encryptExistingFailed', { msg: error.message || 'error' }))
        }
    } finally {
        encExistingRunning.value = false
        encExistingAbort.value = null
    }
}

const cancelEncryptExisting = () => {
    encExistingAbort.value?.abort()
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

// Raw private keys are never available after setup (only non-extractable
// CryptoKeys are stored), so "copy protected backup" / "download backup"
// only emit the stored wrapped blob; a new backup can only be created from
// raw key material pasted by the user (verified against the stored records).

// ---- passphrase-protected key backups ----

const encHasBackup = computed(() => hasWrappedBackup(settings.value.address))
const encHasLocalKey = computed(() => getKeyRecords(settings.value.address).length > 0)

const copyProtectedBackupLink = async () => {
    const blob = getWrappedBackup(settings.value.address)
    if (!blob) return
    try {
        await copyToClipboard(buildBackupLink(settings.value.address, blob))
        message.success(t('backupLinkCopied'))
    } catch (error) {
        console.error(error)
        message.error(t('copyFailed'))
    }
}

const downloadProtectedBackupFile = () => {
    const blob = getWrappedBackup(settings.value.address)
    if (!blob) return
    const content = buildBackupFileContent(settings.value.address, blob)
    const file = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = backupFileName(settings.value.address)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
}

// "Create protected backup from my key": paste a raw `#k=` link / bare key,
// verify it against the stored records, wrap it. The pasted string is
// dropped when the dialog closes.
const showCreateBackup = ref(false)
const createBackupInput = ref('')
const createBackupPassphrase = ref('')
const createBackupConfirm = ref('')
const createBackupError = ref('')
const createBackupBusy = ref(false)

const closeCreateBackup = () => {
    showCreateBackup.value = false
    createBackupInput.value = ''
    createBackupPassphrase.value = ''
    createBackupConfirm.value = ''
    createBackupError.value = ''
}

const submitCreateBackup = async () => {
    if (createBackupBusy.value) return
    createBackupError.value = ''
    if (createBackupPassphrase.value !== createBackupConfirm.value) {
        createBackupError.value = t('passwordMismatch')
        return
    }
    createBackupBusy.value = true
    try {
        await createBackupFromPastedKey({
            text: createBackupInput.value,
            address: settings.value.address,
            passphrase: createBackupPassphrase.value,
        })
        message.success(t('backupCreated'))
        closeCreateBackup()
    } catch (error) {
        console.error(error)
        if (error instanceof BackupKeyInvalidError) createBackupError.value = t('backupKeyInvalid')
        else if (error instanceof BackupKeyMismatchError) createBackupError.value = t('backupKeyMismatch')
        else if (error instanceof BackupPassphraseError) {
            createBackupError.value = t('backupPassphraseTooShort', { min: BACKUP_MIN_PASSPHRASE_LENGTH })
        } else createBackupError.value = error.message || 'error'
    } finally {
        createBackupBusy.value = false
    }
}

// ---- passkey (WebAuthn PRF) wrapped key backups ----------------------------
// Server-side opaque blobs (version 0x02) usable only with a registered
// passkey; available to logged-in user accounts with this address bound.
// The server never sees the PRF output, the wrapping key or the private key.

const accountLoggedIn = computed(() => showUserSystem.value && !!userJwt.value)
const addressBound = ref(null) // null: unknown, true/false
const passkeyBackups = ref([])
const passkeyList = ref([])
const passkeyBusyId = ref(null)
const passkeyRestoreError = ref('')

// Row state for the key status card: does a server-side passkey backup exist
// for this address — and are the prerequisites (account, binding) met?
const keyStatusPasskeyState = computed(() => {
    if (!accountLoggedIn.value) return 'not-logged-in'
    if (addressBound.value !== true) return 'not-bound'
    return passkeyBackups.value.length > 0 ? 'yes' : 'no'
})

const goToUserCenter = async () => {
    await router.push(getRouterPathWithLang('/user', locale.value))
}

const passkeyNameFor = (backup) => {
    const passkey = passkeyList.value.find((item) => item.passkey_id === backup.passkey_id)
    return passkey?.passkey_name || backup.passkey_id
}

const passkeyBackupMatchesLocalKey = (backup) => (
    getKeyRecords(settings.value.address).some((record) => record.publicKey === backup.key_id)
)

const formatBackupDate = (value) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString()
}

const refreshPasskeyBackups = async () => {
    passkeyRestoreError.value = ''
    if (!accountLoggedIn.value || !settings.value.address) return
    try {
        const params = new URLSearchParams({ query: settings.value.address, limit: '100', offset: '0' })
        const { results } = await api.fetch(`/user_api/bind_address?${params.toString()}`)
        addressBound.value = (results || []).some((row) => row.name === settings.value.address)
        if (!addressBound.value) {
            passkeyBackups.value = []
            passkeyList.value = []
            return
        }
        const [backups, passkeys] = await Promise.all([
            api.listKeyBackups(settings.value.address),
            api.listPasskeys(),
        ])
        passkeyBackups.value = backups || []
        passkeyList.value = passkeys || []
    } catch (error) {
        console.error(error)
        addressBound.value = false
    }
}

const restoreFromPasskeyBackup = async (backup) => {
    if (passkeyBusyId.value) return
    passkeyRestoreError.value = ''
    passkeyBusyId.value = backup.id
    try {
        // Transient raw key: dropped immediately after addPrivateKey imports
        // it as a non-extractable CryptoKey.
        let raw = await unwrapKeyWithPasskey({
            blob: backup.blob,
            address: settings.value.address,
            keyId: backup.key_id,
            credentialId: backup.passkey_id,
        })
        try {
            const record = await addPrivateKey(settings.value.address, raw, {
                publicKey: backup.key_id,
                wrappedBackup: getWrappedBackup(settings.value.address) || undefined,
            })
            if (!record) throw new Error(t('passkeyBackupRestoreFailed'))
        } finally {
            raw = null
        }
        notifyMailKeysImported()
        message.success(t('passkeyBackupRestored'))
        await refreshEncryptionStatus()
        await refreshPasskeyBackups()
    } catch (error) {
        console.error(error)
        if (error instanceof PasskeyPrfUnsupportedError) {
            passkeyRestoreError.value = t('passkeyPrfUnsupported')
        } else if (error instanceof PasskeyCancelledError) {
            message.info(t('passkeyBackupCancelled'))
        } else if (error instanceof PasskeyUnwrapError) {
            passkeyRestoreError.value = t('passkeyUnwrapFailed')
        } else {
            passkeyRestoreError.value = error?.message || 'error'
        }
    } finally {
        passkeyBusyId.value = null
    }
}

const deletePasskeyBackup = async (backup) => {
    try {
        await api.deleteKeyBackup(backup.id)
        message.success(t('passkeyBackupDeleted'))
        await refreshPasskeyBackups()
    } catch (error) {
        console.error(error)
        message.error(error?.message || 'error')
    }
}

// Key material for the passkey flow inside the "Create protected backup from
// my key" dialog: the raw key only exists inside the textarea until the
// passkey button is clicked.
const resolveCreateBackupKeyMaterial = async () => {
    const rawKey = extractRawKeyFromText(createBackupInput.value)
    if (!rawKey) throw new BackupKeyInvalidError()
    const keyId = await publicKeyFromPrivate(rawKey)
    return { rawKey, keyId }
}

// "Import key backup": paste a `#kp=` link or load a backup file; the parsed
// blob is queued for the global passphrase prompt (KeyBackupHost).
const showImportBackup = ref(false)
const importBackupInput = ref('')
const importBackupError = ref('')

const closeImportBackup = () => {
    showImportBackup.value = false
    importBackupInput.value = ''
    importBackupError.value = ''
}

const submitImportBackup = () => {
    importBackupError.value = ''
    const trimmed = importBackupInput.value.trim()
    let parsed = null
    try {
        const wrapped = parseWrappedFragment(trimmed)
        parsed = wrapped || parseBackupFile(trimmed)
    } catch (error) {
        console.error(error)
        importBackupError.value = t('importBackupInvalid')
        return
    }
    if (!parsed || !parsed.address || !parsed.blob) {
        importBackupError.value = t('importBackupInvalid')
        return
    }
    pendingWrappedImports.value = [...pendingWrappedImports.value, { address: parsed.address, blob: parsed.blob }]
    message.info(t('importBackupQueued'))
    closeImportBackup()
}

const onBackupFileChosen = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
        importBackupInput.value = await file.text()
    } catch (error) {
        console.error(error)
        importBackupError.value = t('importBackupInvalid')
    } finally {
        event.target.value = ''
    }
}

// Offer a backup right after enable/rotate while the raw key is still in
// memory; cleared when the dialog closes.
const encNewKeyPair = ref(null)

const showNewKeyBackup = computed({
    get: () => !!encNewKeyPair.value,
    set: (value) => { if (!value) encNewKeyPair.value = null },
})

const importEncryptionKey = async () => {
    const result = await importKeyOrLink(encImportInput.value, settings.value.address)
    if (result.needsPassphrase) {
        pendingWrappedImports.value = [...pendingWrappedImports.value, result.wrapped]
        encImportInput.value = ''
        message.info(t('encryptionImportNeedsPassphrase'))
        return
    }
    if (!result.ok) {
        message.error(t('encryptionImportInvalid'))
        return
    }
    encImportInput.value = ''
    await compareLocalEncryptionKey()
    message.success(t('success'))
}

const encExistingPercentage = computed(() => {
    const { done = 0, remaining = 0 } = encExistingProgress.value || {}
    const total = done + remaining
    return total > 0 ? Math.min(100, Math.round(done / total * 100)) : 0
})

// openSettings may be fetched after this component mounts (lazy tab), so
// watch instead of a one-shot onMounted.
watch(() => openSettings.value.enableMailEncryption, (enabled) => {
    if (enabled) refreshEncryptionStatus()
}, { immediate: true })

watch(accountLoggedIn, () => {
    if (accountLoggedIn.value) refreshPasskeyBackups()
})

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

// ---- "Open on another device" (QR / link) ----------------------------------

const showOpenDevice = ref(false)

// ---- "Burn mailbox" ---------------------------------------------------------

const showBurnMailbox = ref(false)
const burnConfirmInput = ref('')
const burnBusy = ref(false)
// Same localStorage key as AddressSelect: the saved local addresses are the
// JWTs of mailboxes used on this browser.
const localAddressCache = useLocalStorage("LocalAddressCache", [])

const burnMailboxNow = async () => {
    if (burnBusy.value) return
    burnBusy.value = true
    const address = settings.value.address
    try {
        // Server-side delete first: on failure the flow aborts and this
        // browser's keys are kept (the mailbox still exists).
        await burnMailbox({
            address,
            deleteAddressApi: () => api.fetch('/api/delete_address', { method: 'DELETE' }),
            removeKeys: removePrivateKeys,
            removeFromSavedAddresses: (addr) => {
                localAddressCache.value = filterAddressTokens(localAddressCache.value, addr)
            },
        })
        message.success(t('burnMailboxDone'))
        burnConfirmInput.value = ''
        showBurnMailbox.value = false
        // Log out and land on the front page without a reload so the success
        // toast is visible; dropping the cached address hides the mailbox UI.
        jwt.value = ''
        settings.value.address = ''
        await router.push(getRouterPathWithLang("/", locale.value))
    } catch (error) {
        message.error(error.message || "error")
    } finally {
        burnBusy.value = false
    }
}

// ---- "Use a passkey for this mailbox" guided setup ---------------------------
// Sign in (or create a passkey account), link this mailbox, optionally add a
// passkey backup — one dialog, each step ticked as it completes.

const showPasskeySetup = ref(false)
const showPasskeyHowItWorks = ref(false)

// ---- scroll-to-backup signal -------------------------------------------------
// The reminder banner and the QR panel ask for the backup section; consumed
// here both live (watch) and on mount (the tab pane may mount only now).
// The <div> below wraps the backup controls.

const backupSectionEl = ref(null)
let seenFocusRequests = 0

const scrollToBackupSection = async () => {
    await nextTick()
    backupSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch(keyBackupSectionFocusRequests, () => {
    seenFocusRequests = keyBackupSectionFocusRequests.value
    scrollToBackupSection()
})

onMounted(() => {
    // Deep link from the user-center mailbox list: open this mailbox's
    // Account Settings tab and scroll to the backup controls.
    if (consumeKeyBackupSectionFocusForNextLoad()) {
        indexTab.value = 'accountSettings'
        requestKeyBackupSectionFocus()
    }
    if (keyBackupSectionFocusRequests.value !== seenFocusRequests) {
        seenFocusRequests = keyBackupSectionFocusRequests.value
        scrollToBackupSection()
    }
})
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
                <span class="settings-row__text">{{ t('openDeviceTip') }}</span>
                <div class="settings-row__action">
                    <n-button size="small" secondary data-testid="open-device-toggle"
                        @click="showOpenDevice = !showOpenDevice">
                        {{ t('openDevice') }}
                    </n-button>
                </div>
            </div>
            <OpenDeviceQrPanel v-if="showOpenDevice" :address="settings.address" :jwt="jwt"
                data-testid="open-device" />
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
                <span class="settings-row__text">{{ t('burnMailboxTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showBurnMailbox = true" secondary type="error">{{ t('burnMailbox') }}</n-button>
                </div>
            </div>
            <div class="settings-row">
                <span class="settings-row__text">{{ t('deleteMailboxTip') }}</span>
                <div class="settings-row__action">
                    <n-button @click="showDeleteAccount = true" secondary type="error">{{ t('deleteMailbox') }}</n-button>
                </div>
            </div>
        </section>
        <section v-if="openSettings.enableMailEncryption && settings.address" class="panel settings-section">
            <h3 class="panel-title settings-section__header">{{ t('mailEncryption') }}</h3>
            <template v-if="showUserSystem">
                <div class="toolbar enc-passkey-setup">
                    <n-button size="small" secondary type="primary" data-testid="use-passkey-for-mailbox"
                        @click="showPasskeySetup = true">
                        {{ t('usePasskeyForMailbox') }}
                    </n-button>
                    <n-button size="small" quaternary data-testid="toggle-passkey-how-it-works"
                        @click="showPasskeyHowItWorks = !showPasskeyHowItWorks">
                        {{ t('passkeyHowItWorksToggle') }}
                    </n-button>
                </div>
                <n-collapse v-if="showPasskeyHowItWorks" class="enc-passkey-how">
                    <PasskeyHowItWorks compact :signed-in="accountLoggedIn" :linked="addressBound === true"
                        :has-passkey-backup="passkeyBackups.length > 0" :encrypted="!!encServerPublicKey" />
                </n-collapse>
            </template>
            <n-alert v-if="keyStoreMode === 'memory'" type="warning" :show-icon="false" :bordered="false">
                {{ t('keyStoreMemoryWarning') }}
            </n-alert>
            <n-alert v-if="legacyPlaintextKeysRetained" type="warning" :show-icon="false" :bordered="false">
                {{ t('keyStoreLegacyRetainedWarning') }}
            </n-alert>
            <n-alert v-if="legacyMigrationPending" type="warning" :show-icon="false" :bordered="false">
                <n-space align="center" justify="space-between">
                    <span>{{ t('keyStoreMigrationPendingWarning') }}</span>
                    <n-button size="tiny" tertiary type="warning" data-testid="finish-protecting-keys"
                        @click="requestLegacyBackupPrompt">
                        {{ t('finishProtectingKeys') }}
                    </n-button>
                </n-space>
            </n-alert>
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
                    <p v-if="encFingerprint" class="muted enc-fingerprint">
                        {{ t('keyFingerprint') }}: <code class="mono">{{ encFingerprint }}</code>
                    </p>
                    <KeyStatusCard v-if="encServerPublicKey" :has-key="encHasLocalKey"
                        :has-passphrase-backup="encHasBackup" :passkey-backup-state="keyStatusPasskeyState"
                        @import-key="showImportBackup = true" @create-backup="showCreateBackup = true"
                        @add-passkey-backup="showPasskeySetup = true" @sign-in="goToUserCenter"
                        @link-mailbox="goToUserCenter" />
                </template>
                <div class="toolbar enc-actions">
                    <n-button v-if="!encServerPublicKey" size="small" type="primary" :loading="encBusy"
                        @click="enableEncryption">
                        {{ t('encryptionEnable') }}
                    </n-button>
                    <template v-else>
                        <n-button size="small" type="primary" :loading="encBusy" @click="showRotateConfirm = true">
                            {{ t('encryptionRotate') }}
                        </n-button>
                        <n-button size="small" secondary type="error" :loading="encBusy"
                            @click="showDisableConfirm = true">
                            {{ t('encryptionDisable') }}
                        </n-button>
                        <n-button size="small" secondary :loading="encExistingRunning"
                            @click="showEncryptExistingConfirm = true">
                            {{ t('encryptExisting') }}
                        </n-button>
                    </template>
                </div>
                <div v-if="encKeyMatch !== true" class="toolbar enc-import">
                    <n-input v-model:value="encImportInput" size="small"
                        :placeholder="t('encryptionImportPlaceholder')" style="max-width: 320px;"
                        @keyup.enter="importEncryptionKey" />
                    <n-button size="small" secondary @click="importEncryptionKey">
                        {{ t('encryptionImport') }}
                    </n-button>
                </div>
                <div v-if="encExistingRunning || encExistingResult || encExistingError" class="enc-existing">
                    <n-progress v-if="encExistingRunning" type="line" :percentage="encExistingPercentage"
                        :show-indicator="false" status="default" processing />
                    <p v-if="encExistingRunning" class="muted enc-existing__line">
                        {{ t('encryptExistingRunning', {
                            done: encExistingProgress?.done ?? 0,
                            remaining: encExistingProgress?.remaining ?? 0,
                        }) }}
                        <n-button size="tiny" quaternary type="warning" style="margin-left: 8px;"
                            @click="cancelEncryptExisting">
                            {{ t('encryptExistingCancel') }}
                        </n-button>
                    </p>
                    <n-alert v-else-if="encExistingResult" type="success" :show-icon="false" :bordered="false">
                        {{ t('encryptExistingDone', encExistingResult) }}
                    </n-alert>
                    <n-alert v-else-if="encExistingError" type="error" :show-icon="false" :bordered="false">
                        {{ t('encryptExistingFailed', { msg: encExistingError }) }}
                    </n-alert>
                </div>
            </template>
            <template v-if="encHasLocalKey || encHasBackup">
                <div ref="backupSectionEl" id="key-backup-section" class="toolbar enc-backup">
                    <n-button size="small" secondary :disabled="!encHasBackup"
                        data-testid="copy-protected-backup-link" @click="copyProtectedBackupLink">
                        {{ t('copyProtectedBackupLink') }}
                    </n-button>
                    <n-button size="small" secondary :disabled="!encHasBackup"
                        data-testid="download-protected-backup-file" @click="downloadProtectedBackupFile">
                        {{ t('downloadProtectedBackupFile') }}
                    </n-button>
                    <n-button size="small" tertiary :disabled="!encHasLocalKey" data-testid="create-backup-from-key"
                        @click="showCreateBackup = true">
                        {{ t('createBackupFromKey') }}
                    </n-button>
                    <n-button size="small" tertiary data-testid="import-key-backup" @click="showImportBackup = true">
                        {{ t('importKeyBackup') }}
                    </n-button>
                </div>
                <n-alert v-if="!encHasBackup" type="info" :show-icon="false" :bordered="false">
                    {{ t('noBackupHint') }}
                </n-alert>
            </template>
            <!-- Passkey (WebAuthn PRF) backups stored on the account: restore
                on a new device, delete, or protect the current key. -->
            <template v-if="accountLoggedIn && encEnabled">
                <div v-if="addressBound" class="enc-passkey-backups" data-testid="passkey-backup-list">
                    <p class="muted enc-passkey-backups__tip">{{ t('passkeyBackupTip') }}</p>
                    <div v-for="backup in passkeyBackups" :key="backup.id" class="enc-passkey-backups__row"
                        :data-testid="`passkey-backup-row-${backup.id}`">
                        <span class="enc-passkey-backups__name">{{ passkeyNameFor(backup) }}</span>
                        <span class="muted">{{ t('passkeyBackupCreatedAt') }}: {{ formatBackupDate(backup.created_at) }}</span>
                        <n-tag v-if="passkeyBackupMatchesLocalKey(backup)" size="tiny" type="success"
                            data-testid="passkey-backup-current">
                            {{ t('passkeyBackupCurrentKey') }}
                        </n-tag>
                        <n-tag v-else size="tiny" data-testid="passkey-backup-old">
                            {{ t('passkeyBackupOldKey') }}
                        </n-tag>
                        <n-button size="tiny" secondary type="primary" :loading="passkeyBusyId === backup.id"
                            data-testid="restore-passkey-backup" @click="restoreFromPasskeyBackup(backup)">
                            {{ t('restoreFromPasskey') }}
                        </n-button>
                        <n-popconfirm @positive-click="deletePasskeyBackup(backup)">
                            <template #trigger>
                                <n-button size="tiny" tertiary type="error" data-testid="delete-passkey-backup">
                                    {{ t('deletePasskeyBackup') }}
                                </n-button>
                            </template>
                            {{ t('deletePasskeyBackupConfirm') }}
                        </n-popconfirm>
                    </div>
                    <p v-if="passkeyBackups.length === 0" class="muted" data-testid="passkey-backup-empty">
                        {{ t('passkeyBackupEmpty') }}
                    </p>
                    <n-alert v-if="passkeyRestoreError" type="error" :show-icon="false" :bordered="false"
                        data-testid="passkey-restore-error">
                        {{ passkeyRestoreError }}
                    </n-alert>
                </div>
            </template>
            <n-alert v-if="!encEnabled" type="info" :show-icon="false" :bordered="false">
                {{ t('encryptionUnavailable') }}
            </n-alert>
        </section>
        <slot name="extra" />

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
        <n-modal v-model:show="showBurnMailbox" preset="dialog" :title="t('burnMailbox')"
            data-testid="burn-mailbox-dialog">
            <p>{{ t('burnMailboxConfirm') }}</p>
            <p class="muted mono burn-mailbox__address">{{ settings.address }}</p>
            <n-input v-model:value="burnConfirmInput" class="burn-mailbox__input"
                :placeholder="t('burnMailboxTypeAddress')" data-testid="burn-mailbox-input"
                @keyup.enter="burnMailboxNow" />
            <template #action>
                <n-button size="small" tertiary @click="showBurnMailbox = false">
                    {{ t('cancel') }}
                </n-button>
                <n-button size="small" type="error" :disabled="burnConfirmInput !== settings.address"
                    :loading="burnBusy" data-testid="burn-mailbox-submit" @click="burnMailboxNow">
                    {{ t('burnMailbox') }}
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
        <n-modal v-model:show="showEncryptExistingConfirm" preset="dialog" :title="t('encryptExisting')">
            <p>{{ t('encryptExistingTip') }}</p>
            <template #action>
                <n-button :loading="encExistingRunning" size="small" tertiary type="warning" @click="startEncryptExisting">
                    {{ t('encryptExisting') }}
                </n-button>
            </template>
        </n-modal>

        <PasskeyMailboxSetup v-model:show="showPasskeySetup" :address="settings.address"
            :encrypted="!!encServerPublicKey" @done="refreshPasskeyBackups()" />

        <n-modal :show="showNewKeyBackup" @update:show="showNewKeyBackup = $event" preset="dialog"
            :title="t('newKeyBackupTitle')">
            <p>{{ t('newKeyBackupTip') }}</p>
            <KeyBackupPanel :address="settings.address" :raw-key="encNewKeyPair?.privateKey || ''"
                :public-key="encNewKeyPair?.publicKey || ''" />
        </n-modal>

        <n-modal :show="showCreateBackup" @update:show="showCreateBackup = $event" preset="dialog"
            :title="t('createBackupTitle')" data-testid="create-backup-dialog">
            <p>{{ t('createBackupWhyPaste') }}</p>
            <p class="muted">{{ t('createBackupNoLink') }}</p>
            <n-form label-placement="top">
                <n-form-item :label="t('createBackupInputLabel')">
                    <n-input v-model:value="createBackupInput" type="textarea" :autosize="{ minRows: 2 }"
                        :placeholder="t('createBackupInputPlaceholder')" data-testid="create-backup-input" />
                </n-form-item>
                <n-form-item :label="t('backupPassphrase')">
                    <n-input v-model:value="createBackupPassphrase" type="password" show-password-on="click"
                        data-testid="create-backup-passphrase" />
                </n-form-item>
                <n-form-item :label="t('backupConfirmPassphrase')">
                    <n-input v-model:value="createBackupConfirm" type="password" show-password-on="click"
                        data-testid="create-backup-confirm" @keyup.enter="submitCreateBackup" />
                </n-form-item>
            </n-form>
            <!-- Independent alternative/complement: wrap the pasted key with
                a passkey (WebAuthn PRF) and upload the opaque blob. -->
            <PasskeyWrapControls :address="settings.address"
                :resolve-key-material="resolveCreateBackupKeyMaterial" />
            <n-alert v-if="createBackupError" type="error" :show-icon="false" :bordered="false"
                data-testid="create-backup-error">
                {{ createBackupError }}
            </n-alert>
            <template #action>
                <n-button size="small" tertiary @click="closeCreateBackup">
                    {{ t('cancel') }}
                </n-button>
                <n-button size="small" type="primary" :loading="createBackupBusy" data-testid="create-backup-submit"
                    @click="submitCreateBackup">
                    {{ t('createBackupFromKey') }}
                </n-button>
            </template>
        </n-modal>

        <n-modal :show="showImportBackup" @update:show="showImportBackup = $event" preset="dialog"
            :title="t('importBackupTitle')" data-testid="import-backup-dialog">
            <p>{{ t('importBackupTip') }}</p>
            <n-input v-model:value="importBackupInput" type="textarea" :autosize="{ minRows: 3 }"
                :placeholder="t('importBackupPlaceholder')" data-testid="import-backup-input" />
            <div class="toolbar" style="margin-top: 8px;">
                <input type="file" accept=".json,application/json" data-testid="import-backup-file"
                    @change="onBackupFileChosen" />
            </div>
            <n-alert v-if="importBackupError" type="error" :show-icon="false" :bordered="false"
                data-testid="import-backup-error">
                {{ importBackupError }}
            </n-alert>
            <template #action>
                <n-button size="small" tertiary @click="closeImportBackup">
                    {{ t('cancel') }}
                </n-button>
                <n-button size="small" type="primary" data-testid="import-backup-submit" @click="submitImportBackup">
                    {{ t('importKeyBackup') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.account-settings { max-width: var(--content-form); text-align: left; }
.account-settings > .settings-section + .settings-section { margin-top: 0; }
.danger-title { color: var(--app-danger); }
.danger-title::before { color: var(--app-danger); }
.danger-tip { margin: 0 0 var(--space-2); }
.enc-fingerprint { margin: var(--space-2) 0 0; }
.enc-actions, .enc-import { margin-top: var(--space-3); }
.enc-backup { margin-top: var(--space-3); }
.enc-passkey-backups { margin-top: var(--space-3); display: grid; gap: var(--space-2); }
.enc-passkey-setup { margin-top: 0; }
.enc-passkey-how { margin-top: var(--space-2); }
.enc-passkey-backups__tip { margin: 0; }
.enc-passkey-backups__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
}
.enc-passkey-backups__name { font-weight: 600; }
.enc-existing { margin-top: var(--space-3); }
.enc-existing__line { margin: var(--space-2) 0 0; }
.burn-mailbox__address { margin: var(--space-2) 0; }
.burn-mailbox__input { margin-top: var(--space-2); }
</style>
