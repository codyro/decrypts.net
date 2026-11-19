<script setup>
import { useScopedI18n } from '@/i18n/app'
import { onMounted, ref } from 'vue'

import { useGlobalState } from '../../store'
import { api } from '../../api'

const message = useMessage()
const sourcePrefix = ref("")
const enableAutoReply = ref(false)
const autoReplyMessage = ref("")
const subject = ref("")
const name = ref("")

const { settings } = useGlobalState()


const { t } = useScopedI18n('views.index.AutoReply')

const fetchData = async () => {
    try {
        const res = await api.fetch("/api/auto_reply")
        sourcePrefix.value = res.source_prefix || ""
        enableAutoReply.value = res.enabled || false
        name.value = res.name || ""
        autoReplyMessage.value = res.message || ""
        subject.value = res.subject || ""
    } catch (error) {
        message.error(error.message || "error");
    }
}

const saveData = async () => {
    try {
        await api.fetch("/api/auto_reply", {
            method: "POST",
            body: JSON.stringify({
                auto_reply: {
                    enabled: enableAutoReply.value,
                    source_prefix: sourcePrefix.value,
                    name: name.value,
                    message: autoReplyMessage.value,
                    subject: subject.value,
                }
            })
        })
        message.success(t("success"))
    } catch (error) {
        message.error(error.message || "error");
    }
}

onMounted(async () => {
    await fetchData()
})
</script>

<template>
    <div class="stack" v-if="settings.address">
        <n-form-item :label="t('enableAutoReply')" label-placement="top">
            <n-switch v-model:value="enableAutoReply" />
        </n-form-item>
        <n-form-item :label="t('name')" label-placement="top">
            <n-input :disabled="!enableAutoReply" v-model:value="name" />
        </n-form-item>
        <n-form-item :label="t('sourcePrefix')" label-placement="top">
            <n-input :disabled="!enableAutoReply" v-model:value="sourcePrefix"
                :placeholder="t('sourcePrefixPlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('subject')" label-placement="top">
            <n-input :disabled="!enableAutoReply" v-model:value="subject" />
        </n-form-item>
        <n-form-item :label="t('autoReply')" label-placement="top">
            <n-input :disabled="!enableAutoReply" type="textarea" v-model:value="autoReplyMessage" />
        </n-form-item>
        <div class="toolbar" style="justify-content:flex-end">
            <n-button type="primary" @click="saveData">{{ t('save') }}</n-button>
        </div>
    </div>
</template>

<style scoped>
.stack { padding-top: var(--space-2); }
.stack :deep(.n-form-item) { margin-bottom: 0; }
</style>
