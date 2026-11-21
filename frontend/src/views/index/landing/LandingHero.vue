<script setup>
import { computed } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../../store'

const { openSettings } = useGlobalState()
const { t } = useScopedI18n('views.index.Landing')
const { t: retentionT } = useScopedI18n('utils.retentionText')

// Mono uppercase eyebrow: "DISPOSABLE" always, "ENCRYPTED AT REST" only when
// the operator runs mailbox encryption.
const eyebrow = computed(() => {
    const parts = [t('heroEyebrowDisposable')]
    if (openSettings.value?.enableMailEncryption) {
        parts.push(t('heroEyebrowEncrypted'))
    }
    return parts.join(' · ')
})

const title = computed(() =>
    openSettings.value?.enableMailEncryption ? t('heroTitleEncrypted') : t('heroTitlePlain')
)

// Reuses the utils.retentionText plural i18n so the sentence stays correct
// for any day count.
const retentionNote = computed(() => {
    const days = openSettings.value?.retention?.mailsDays
    if (typeof days !== 'number' || !Number.isFinite(days) || days <= 0) return ''
    return retentionT('mails', { days }, days)
})
</script>

<template>
    <div class="hero">
        <p class="caption hero__eyebrow">{{ eyebrow }}</p>
        <h1 class="hero__title">{{ title }}</h1>
        <p class="muted hero__subline">
            {{ t('heroSubline') }}
            <template v-if="retentionNote"> {{ retentionNote }}</template>
        </p>
    </div>
</template>

<style scoped>
.hero {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    text-align: left;
}

.hero__eyebrow {
    margin: 0;
    color: var(--app-accent);
}

.hero__title {
    margin: 0;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.15;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--app-text-1);
}

.hero__subline {
    margin: 0;
    font-size: var(--font-md);
    line-height: 22px;
    max-width: 42ch;
}
</style>
