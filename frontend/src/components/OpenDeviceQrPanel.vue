<script setup>
import { computed, ref, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { getKeyRecords, getWrappedBackup } from '../utils/mail-key-store'
import { buildOpenDeviceLink } from '../utils/open-device-link'
import { copyToClipboard } from '../utils/clipboard'
import { requestKeyBackupSectionFocus } from '../utils/key-backup-reminder'

const props = defineProps({
    address: {
        type: String,
        default: '',
    },
    jwt: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['create-backup'])

const { t } = useScopedI18n('components.OpenDeviceQrPanel')
const message = useMessage()

const isEncrypted = computed(() => getKeyRecords(props.address).length > 0)
const hasBackup = computed(() => typeof getWrappedBackup(props.address) === 'string' && getWrappedBackup(props.address).length > 0)

// The link carries the credential — and only the WRAPPED backup, never a raw
// key — in the fragment so nothing reaches the server or logs.
const link = computed(() => buildOpenDeviceLink({
    jwt: props.jwt,
    address: props.address,
    wrappedBackup: (isEncrypted.value && hasBackup.value) ? getWrappedBackup(props.address) : null,
}))

const showKeyNote = computed(() => isEncrypted.value && !hasBackup.value)

// Hidden until explicitly revealed: anyone who scans the QR owns the
// mailbox, so it must not sit visible when the settings open.
const revealed = ref(false)
const qrSvg = ref('')
const qrError = ref(false)
let qrSeq = 0

const renderQr = async () => {
    const seq = ++qrSeq
    qrError.value = false
    try {
        // Local generation only; lazily imported so the encoder stays out of
        // the main chunk. QR modules must stay high-contrast to scan, so the
        // colours are fixed rather than themed.
        const QRCode = await import('qrcode')
        const svg = await QRCode.toString(link.value, {
            type: 'svg',
            margin: 1,
            width: 232,
            errorCorrectionLevel: 'M',
            color: { dark: '#000000', light: '#ffffff' },
        })
        if (seq === qrSeq) qrSvg.value = svg
    } catch (error) {
        console.error('Failed to render open-device QR code', error)
        if (seq === qrSeq) qrError.value = true
    }
}

watch(revealed, (show) => {
    if (show) renderQr()
    else qrSvg.value = ''
})

const copyLink = async () => {
    if (!link.value) return
    try {
        await copyToClipboard(link.value)
        message.success(t('linkCopied'))
    } catch (error) {
        console.error(error)
        message.error(t('copyFailed'))
    }
}

const onCreateBackup = () => {
    emit('create-backup')
    requestKeyBackupSectionFocus()
}
</script>

<template>
    <div class="open-device" data-testid="open-device-panel">
        <n-alert type="warning" :show-icon="false" :bordered="false" class="open-device__warning">
            {{ t('qrWarning') }}
        </n-alert>
        <div class="toolbar open-device__actions">
            <n-button size="small" secondary type="primary" data-testid="open-device-show-qr"
                @click="revealed = !revealed">
                {{ revealed ? t('hideQr') : t('showQr') }}
            </n-button>
            <n-button size="small" secondary data-testid="open-device-copy-link" @click="copyLink">
                {{ t('copyLink') }}
            </n-button>
        </div>
        <div v-if="revealed" class="open-device__qr">
            <div v-if="qrSvg" class="open-device__qr-frame" v-html="qrSvg" data-testid="open-device-qr" />
            <n-alert v-else-if="qrError" type="error" :show-icon="false" :bordered="false">
                {{ t('qrUnavailable') }}
            </n-alert>
            <n-spin v-else size="small" />
        </div>
        <n-alert v-if="showKeyNote" type="info" :show-icon="false" :bordered="false" data-testid="open-device-key-note">
            {{ t('keyBackupMissing') }}
            <n-button size="tiny" tertiary type="primary" data-testid="open-device-create-backup"
                @click="onCreateBackup">
                {{ t('createBackup') }}
            </n-button>
        </n-alert>
    </div>
</template>

<style scoped>
.open-device {
    display: grid;
    gap: var(--space-2);
    margin: var(--space-2) 0 var(--space-3);
}
.open-device__actions { margin-top: 0; }
.open-device__qr {
    display: flex;
    justify-content: flex-start;
}
.open-device__qr-frame {
    width: 232px;
    max-width: 100%;
    padding: var(--space-2);
    background: #ffffff;
    border: 1px solid var(--app-border);
    border-radius: var(--radius-md);
}
.open-device__qr-frame :deep(svg) {
    display: block;
    width: 100%;
    height: auto;
}
</style>
