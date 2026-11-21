<script setup>
import { computed } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useIsMobile } from '../../utils/composables'
import { useGlobalState } from '../../store'

const props = defineProps({
    showUseSimpleIndex: {
        type: Boolean,
        default: false
    }
})

const {
    mailboxSplitSize, mailListView, mailListPreviewLineClamp, useIframeShowMail, preferShowTextMail, configAutoRefreshInterval,
    globalTabplacement, useSideMargin, useUTCDate, useSimpleIndex, autoLoadRemoteImages,
    detectVerificationCodes, browserNotifications
} = useGlobalState()
const isMobile = useIsMobile()
const { t } = useScopedI18n('views.common.Appearance')

const notificationSupported = typeof window !== 'undefined' && 'Notification' in window
const notificationPermission = computed(() => notificationSupported ? Notification.permission : 'denied')
const notificationBlocked = computed(() => !notificationSupported || notificationPermission.value === 'denied')

const onNotificationToggle = async (value) => {
    if (!value) {
        browserNotifications.value = false
        return
    }
    if (!notificationSupported) return
    try {
        const permission = await Notification.requestPermission()
        browserNotifications.value = permission === 'granted'
    } catch {
        browserNotifications.value = false
    }
}
</script>

<template>
    <div class="stack">
        <section class="preference-group">
            <h3 class="caption">{{ t('sectionList') }}</h3>
            <n-form-item-row v-if="!isMobile" :label="t('mailboxSplitSize')">
                <n-slider v-model:value="mailboxSplitSize" :min="0" :max="0.75" :step="0.01" :marks="{
                    0: '0', 0.25: '0.25', 0.5: '0.5', 0.75: '0.75'
                }" />
            </n-form-item-row>
            <div v-if="!isMobile" class="pref-row">
                <span>{{ t('mailListView') }}</span>
                <n-switch v-model:value="mailListView" :round="false" />
            </div>
            <n-form-item-row :label="t('mailListPreviewLineClamp')">
                <n-slider v-model:value="mailListPreviewLineClamp" :min="0" :max="5" :step="1" :marks="{
                    0: t('off'), 1: '1', 2: '2', 3: '3', 4: '4', 5: '5'
                }" />
            </n-form-item-row>
            <n-form-item-row :label="t('autoRefreshInterval')">
                <n-slider v-model:value="configAutoRefreshInterval" :min="30" :max="300" :step="1" :marks="{
                    60: '60', 120: '120', 180: '180', 240: '240'
                }" />
            </n-form-item-row>
        </section>
        <section class="preference-group">
            <h3 class="caption">{{ t('sectionReading') }}</h3>
            <div class="pref-row">
                <span>{{ t('preferShowTextMail') }}</span>
                <n-switch v-model:value="preferShowTextMail" :round="false" />
            </div>
            <div class="pref-row">
                <span>{{ t('useIframeShowMail') }}</span>
                <n-switch v-model:value="useIframeShowMail" :round="false" />
            </div>
            <div class="pref-row">
                <span>{{ t('useUTCDate') }}</span>
                <n-switch v-model:value="useUTCDate" :round="false" />
            </div>
            <div class="pref-row">
                <span>{{ t('autoLoadRemoteImages') }}</span>
                <n-switch v-model:value="autoLoadRemoteImages" :round="false" />
            </div>
            <div class="pref-row">
                <span>{{ t('detectVerificationCodes') }}</span>
                <n-switch v-model:value="detectVerificationCodes" :round="false" />
            </div>
        </section>
        <section class="preference-group">
            <h3 class="caption">{{ t('sectionAlerts') }}</h3>
            <div class="pref-row">
                <span>{{ t('browserNotifications') }}</span>
                <n-switch :value="browserNotifications && !notificationBlocked" :disabled="notificationBlocked"
                    :round="false" @update:value="onNotificationToggle" />
            </div>
            <p v-if="!notificationSupported" class="pref-hint">{{ t('browserNotificationsUnsupported') }}</p>
            <p v-else-if="notificationPermission === 'denied'" class="pref-hint">{{ t('browserNotificationsDenied') }}</p>
            <p v-else class="pref-hint">{{ t('browserNotificationsHint') }}</p>
            <div class="pref-row">
                <span>{{ t('shortcuts') }}</span>
                <kbd class="pref-key" :title="t('shortcutsHint')">?</kbd>
            </div>
            <p class="pref-hint">{{ t('shortcutsHint') }}</p>
        </section>
        <section class="preference-group">
            <h3 class="caption">{{ t('sectionLayout') }}</h3>
            <div v-if="!isMobile" class="pref-row">
                <span>{{ t('useSideMargin') }}</span>
                <n-switch v-model:value="useSideMargin" :round="false" />
            </div>
            <n-form-item-row :label="t('globalTabplacement')">
                <n-radio-group v-model:value="globalTabplacement">
                    <n-radio-button value="top" :label="t('top')" />
                    <n-radio-button value="left" :label="t('left')" />
                    <n-radio-button value="right" :label="t('right')" />
                    <n-radio-button value="bottom" :label="t('bottom')" />
                </n-radio-group>
            </n-form-item-row>
            <div v-if="props.showUseSimpleIndex" class="pref-row">
                <span>{{ t('useSimpleIndex') }}</span>
                <n-switch v-model:value="useSimpleIndex" :round="false" />
            </div>
        </section>
    </div>
</template>

<style scoped>
.preference-group { min-width: 0; }
.preference-group > .caption { margin: 0 0 var(--space-2); }
.pref-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 10px 0;
    color: var(--app-text-2);
    font-size: var(--font-md);
}
.pref-hint {
    margin: 0;
    padding-bottom: var(--space-2);
    font-size: var(--font-xs);
    color: var(--app-text-3);
}
.pref-key {
    padding: 2px 10px;
    font-family: var(--font-mono);
    font-size: var(--font-sm);
    color: var(--app-text-1);
    background: var(--app-surface-raised);
    border: 1px solid var(--app-border);
    border-bottom-width: 2px;
    border-radius: var(--radius-sm);
}
.preference-group :deep(.n-radio-group) { max-width: 100%; }
</style>
