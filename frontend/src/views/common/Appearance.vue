<script setup>
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
    globalTabplacement, useSideMargin, useUTCDate, useSimpleIndex, autoLoadRemoteImages
} = useGlobalState()
const isMobile = useIsMobile()
const { t } = useScopedI18n('views.common.Appearance')
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
.preference-group :deep(.n-radio-group) { max-width: 100%; }
</style>
