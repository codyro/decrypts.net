<script setup>
import { computed, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { buildBatchExportCsv } from '../../utils/batch-export'

const props = defineProps({
    show: {
        type: Boolean,
        default: false,
    },
    rows: {
        type: Array,
        default: () => [],
    },
})

const emit = defineEmits(['update:show'])
const { t } = useScopedI18n('views.admin.BatchExportModal')

const mode = ref('spreadsheet')

const modalShow = computed({
    get: () => props.show,
    set: (value) => emit('update:show', value),
})

const hasEncryptedRows = computed(() => props.rows.some(
    (row) => typeof row.privateKey === 'string' && row.privateKey.length > 0,
))

const download = () => {
    if (!props.rows.length) return
    const { csv, filename } = buildBatchExportCsv(props.rows, {
        spreadsheetSafe: mode.value === 'spreadsheet',
        origin: window.location.origin,
    })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>

<template>
    <n-modal v-model:show="modalShow" preset="card" :title="t('title')"
        style="width: min(560px, calc(100vw - 32px));">
        <n-alert v-if="hasEncryptedRows" type="warning" :show-icon="false" :bordered="false"
            style="margin-bottom: 12px; text-align: left;">
            {{ t('encryptedExportWarning') }}
        </n-alert>
        <n-radio-group v-model:value="mode" name="batch-export-format">
            <n-space vertical>
                <n-radio value="spreadsheet">{{ t('spreadsheet') }}</n-radio>
                <n-text depth="3">{{ t('spreadsheetTip') }}</n-text>
                <n-radio value="raw">{{ t('raw') }}</n-radio>
                <n-text depth="3">{{ t('rawTip') }}</n-text>
            </n-space>
        </n-radio-group>
        <template #footer>
            <n-space justify="end">
                <n-button @click="modalShow = false">{{ t('close') }}</n-button>
                <n-button type="primary" :disabled="!rows.length" @click="download">
                    {{ t('download') }}
                </n-button>
            </n-space>
        </template>
    </n-modal>
</template>
