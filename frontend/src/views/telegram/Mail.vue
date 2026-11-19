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
const { t } = useScopedI18n('components.MailContentRenderer')
const route = useRoute()

// The locked-mail UI reuses the MailContentRenderer message registry keys.
const message = useMessage()

const curMail = ref({});
const showEMailTo = true

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
        <div class="panel telegram-mail" v-if="curMail.message || curMail.locked">
            <div class="mail-details">
                <div class="mail-address">
                    <span class="mail-address-label">{{ t('from') }}</span>
                    <span>{{ curMail.source }}</span>
                </div>
                <div v-if="showEMailTo" class="mail-address">
                    <span class="mail-address-label">{{ t('to') }}</span>
                    <span>{{ curMail.address }}</span>
                </div>
                <div class="muted telegram-mail__meta">
                    {{ utcToLocalDate(curMail.created_at, useUTCDate) }} · #{{ curMail.id }}
                </div>
            </div>
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
            <iframe v-else :srcdoc="curMail.message" class="telegram-mail__iframe"></iframe>
        </div>
    </div>
</template>

<style scoped>
.center { display: flex; justify-content: center; min-height: 80vh; text-align: left; }
.telegram-mail { width: 100%; max-width: 800px; }
.mail-details { padding-bottom: 12px; border-bottom: 1px solid var(--app-divider); font-size: 13px; }
.mail-address { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; overflow-wrap: anywhere; }
.mail-address-label { color: var(--app-text-3); font-size: 11px; }
.telegram-mail__meta { margin-top: 6px; }
.telegram-mail__iframe {
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 200px);
    margin-top: var(--space-3);
    border: 0;
    border-radius: var(--radius-md);
    background: #fff;
}
</style>
