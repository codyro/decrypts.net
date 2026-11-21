<script setup>
import { computed, onMounted, ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'
import { MoreVertRound, PersonOutlineRound, SwapHorizRound } from '@vicons/material'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { useIsMobile } from '../../utils/composables'
import Login from '../common/Login.vue'
import TelegramAddress from './TelegramAddress.vue'
import LocalAddress from './LocalAddress.vue'
import AddressManagement from '../user/AddressManagement.vue'
import { getRouterPathWithLang } from '../../utils'
import AddressSelect from '../../components/AddressSelect.vue'
import AddressCredentialModal from '../../components/AddressCredentialModal.vue'
import KeyBackupReminder from '../../components/KeyBackupReminder.vue'
import PasskeyUnlockBanner from '../../components/PasskeyUnlockBanner.vue'
import LandingContent from './landing/LandingContent.vue'

const router = useRouter()
const isMobile = useIsMobile()
const {
    jwt, settings, showAddressCredential, openSettings, useSimpleIndex,
    isTelegram, addressPassword, showUserSystem, showUserMailboxes
} = useGlobalState()

const { locale, t } = useScopedI18n('views.index.AddressBar')
const { t: accountT } = useScopedI18n('views.index.AccountSettings')
const { t: indexT } = useScopedI18n('views.Index')
const showAddressManage = ref(false)
const mailboxOptions = computed(() => [
    {
        key: 'credentials',
        label: accountT(openSettings.value.addressPasswordLoginOnly ? 'showSessionToken' : 'showAddressCredential'),
    },
    { key: 'simple', label: indexT('enterSimpleMode') },
])

const onMailboxOption = (key) => {
    if (key === 'credentials') showAddressCredential.value = true
    if (key === 'simple') useSimpleIndex.value = true
}

const onUserLogin = async () => {
    await router.push(getRouterPathWithLang("/user", locale.value))
}

onMounted(async () => {
    await api.getSettings();
});
</script>

<template>
    <div>
        <div v-if="!settings.fetched" class="panel loading-panel">
            <n-skeleton style="height: 200px" />
        </div>
        <template v-else-if="settings.address">
            <section class="address-bar">
                <div class="caption">{{ t('yourAddress') }}</div>
                <AddressSelect>
                    <template #actions>
                        <n-button class="address-manage" secondary :circle="isMobile"
                            :aria-label="isMobile ? t('addressManage') : undefined"
                            :title="isMobile ? t('addressManage') : undefined" @click="showAddressManage = true">
                            <template #icon><n-icon :component="SwapHorizRound" /></template>
                            <span v-if="!isMobile">{{ t('addressManage') }}</span>
                        </n-button>
                        <n-dropdown trigger="click" :options="mailboxOptions" @select="onMailboxOption">
                            <n-button quaternary circle :aria-label="t('mailboxOptions')" :title="t('mailboxOptions')">
                                <template #icon><n-icon :component="MoreVertRound" /></template>
                            </n-button>
                        </n-dropdown>
                    </template>
                </AddressSelect>
            </section>
            <KeyBackupReminder />
            <PasskeyUnlockBanner />
        </template>
        <div v-else-if="isTelegram" class="panel address-management-panel">
            <TelegramAddress />
        </div>
        <div v-else-if="showUserMailboxes" class="panel address-management-panel">
            <h2 class="section-title">{{ t('addressManage') }}</h2>
            <AddressManagement />
        </div>
        <section v-else class="landing">
            <LandingContent>
                <div class="panel landing__panel">
                    <n-alert v-if="jwt" type="warning" :show-icon="false" :bordered="false" closable>
                        <span>{{ t('fetchAddressError') }}</span>
                    </n-alert>
                    <Login />
                </div>
            </LandingContent>
            <n-button v-if="showUserSystem" text type="primary" @click="onUserLogin">
                <template #icon><n-icon :component="PersonOutlineRound" /></template>
                {{ t('userCenter') }} →
            </n-button>
        </section>
        <AddressCredentialModal v-model:show="showAddressCredential" :address="settings.address" :jwt="jwt"
            :address-password="addressPassword" />
        <n-modal v-model:show="showAddressManage" preset="card" :title="t('addressManage')"
            style="width: min(760px, calc(100vw - 32px));">
            <TelegramAddress v-if="isTelegram" />
            <AddressManagement v-else-if="showUserMailboxes" />
            <LocalAddress v-else />
        </n-modal>
    </div>
</template>

<style scoped>
.loading-panel { height: 240px; }
.address-bar { position: relative; margin-bottom: var(--space-4); }
.address-bar > .caption { display: block; margin-bottom: var(--space-1); }
.address-manage { flex: 0 0 auto; white-space: nowrap; }
.address-management-panel { max-width: 960px; margin: 0 auto; }
.address-management-panel > .section-title { margin-bottom: var(--space-4); }
.landing {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding-top: var(--space-8);
    text-align: center;
}

/* Extremely faint CRT scanlines over the hero areas, dark mode only,
   pure CSS (no images). */
.landing::before,
.address-bar::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(to bottom,
        rgba(255, 176, 0, 0.03) 0 1px,
        transparent 1px 3px);
    opacity: 0;
}

html.dark .landing::before,
html.dark .address-bar::before {
    opacity: 1;
}
.landing > .landing-content {
    width: 100%;
}

.landing__panel { width: min(var(--content-auth), 100%); text-align: left; }
.landing__panel .n-alert { margin-bottom: var(--space-3); }

@media (max-width: 767.98px) {
    .landing { padding-top: var(--space-4); }
}
</style>
