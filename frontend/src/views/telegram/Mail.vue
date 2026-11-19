<script setup>
import { useRoute } from 'vue-router'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../../store'
import { api } from '../../api'
import { onMounted, watch } from 'vue';
import { processItem } from '../../utils/email-parser'
import { utcToLocalDate } from '../../utils';

const { telegramApp, loading, useUTCDate } = useGlobalState()
const { t } = useScopedI18n('components.MailContentRenderer')
const route = useRoute()
const curMail = ref({});
const showEMailTo = true

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
        <div class="panel telegram-mail" v-if="curMail.message">
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
            <iframe :srcdoc="curMail.message" class="telegram-mail__iframe"></iframe>
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
