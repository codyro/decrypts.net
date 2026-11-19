<script setup>
import { useRoute } from 'vue-router'

import { useScopedI18n } from '@/i18n/app'
import { LockOutlined } from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { onMounted, watch } from 'vue';
import { processItem } from '../../utils/email-parser'
import { importKeyOrLink } from '../../utils/mail-fragment'
import { utcToLocalDate } from '../../utils';

const { telegramApp, loading, useUTCDate } = useGlobalState()
const route = useRoute()

// The locked-mail UI reuses the MailContentRenderer message registry keys.
const { t } = useScopedI18n('components.MailContentRenderer')
const message = useMessage()

const curMail = ref({});

const unlockInput = ref('');
const unlockLoading = ref(false);

const lockHint = computed(() => curMail.value.lockReason === 'decrypt_failed'
    ? t('lockedDecryptFailed')
    : t('lockedMissingKey'));

// Paste a private key / decryption link, store it, then re-parse this mail in
// place (curMail.raw still holds the encrypted envelope while locked).
const handleUnlock = async () => {
    if (unlockLoading.value) return;
    unlockLoading.value = true;
    try {
        const { ok } = await importKeyOrLink(unlockInput.value, curMail.value.address);
        if (!ok) {
            message.error(t('unlockInvalid'));
            return;
        }
        unlockInput.value = '';
        message.success(t('unlockSuccess'));
        await processItem(curMail.value);
    } catch (error) {
        console.error(error);
        message.error(t('unlockInvalid'));
    } finally {
        unlockLoading.value = false;
    }
};

watch(telegramApp, async () => {
    if (telegramApp.value.initData) {
        curMail.value = await fetchMailData();
    }
});

const fetchMailData = async () => {
    try {
        const res = await api.fetch(`/telegram/get_mail`, {
            method: 'POST',
            body: JSON.stringify({
                initData: telegramApp.value.initData,
                mailId: route.query.mail_id
            })
        });
        loading.value = true;
        return await processItem(res);
    }
    catch (error) {
        console.error(error);
        return {};
    }
    finally {
        loading.value = false;
    }
};

onMounted(async () => {
    curMail.value = await fetchMailData();
});
</script>

<template>
    <div class="center">
        <n-card :bordered="false" embedded v-if="curMail.message || curMail.locked" style="max-width: 800px; height: 100%;">
            <n-tag type="info">
                ID: {{ curMail.id }}
            </n-tag>
            <n-tag type="info">
                Date: {{ utcToLocalDate(curMail.created_at, useUTCDate) }}
            </n-tag>
            <n-tag type="info">
                FROM: {{ curMail.source }}
            </n-tag>
            <n-tag v-if="showEMailTo" type="info">
                TO: {{ curMail.address }}
            </n-tag>
            <n-alert v-if="curMail.locked" type="warning" :show-icon="false" :bordered="false"
                style="margin-top: 10px; text-align: left;">
                <n-space align="center" :size="6">
                    <n-icon :component="LockOutlined" />
                    <span>{{ lockHint }}</span>
                </n-space>
                <n-space align="center" :size="6" style="margin-top: 8px;">
                    <n-input v-model:value="unlockInput" size="small" :placeholder="t('unlockInputPlaceholder')"
                        style="max-width: 320px;" @keyup.enter="handleUnlock" />
                    <n-button size="small" type="primary" tertiary :loading="unlockLoading" @click="handleUnlock">
                        {{ t('unlock') }}
                    </n-button>
                </n-space>
            </n-alert>
            <iframe v-else :srcdoc="curMail.message" style="margin-top: 10px;width: 100%; height: 100%;">
            </iframe>
        </n-card>
    </div>
</template>


<style scoped>
.center {
    display: flex;
    text-align: left;
    place-items: center;
    justify-content: center;
    height: 80vh;
}
</style>
