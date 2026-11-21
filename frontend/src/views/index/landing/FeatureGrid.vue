<script setup>
import { computed } from 'vue'
import {
    ShieldOutlined, PasswordOutlined, BackupOutlined, QrCode2Outlined,
    DeleteForeverOutlined, CodeOutlined,
} from '@vicons/material'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../../store'
import { useReveal } from '../../../utils/reveal'
import { REPO_URL } from '../../../constant'

const { openSettings } = useGlobalState()
const { t } = useScopedI18n('views.index.Landing')

// Encryption-only panels hide when the operator doesn't run mailbox
// encryption; the rest apply to every address.
const features = computed(() => {
    const encrypted = !!openSettings.value?.enableMailEncryption
    return [
        {
            icon: ShieldOutlined,
            title: 'featureEncryptedTitle',
            text: 'featureEncryptedText',
            encryptedOnly: true,
        },
        { icon: PasswordOutlined, title: 'featureCodesTitle', text: 'featureCodesText' },
        {
            icon: BackupOutlined,
            title: 'featureBackupsTitle',
            text: 'featureBackupsText',
            encryptedOnly: true,
        },
        { icon: QrCode2Outlined, title: 'featureDevicesTitle', text: 'featureDevicesText' },
        { icon: DeleteForeverOutlined, title: 'featureBurnTitle', text: 'featureBurnText' },
        {
            icon: CodeOutlined,
            title: 'featureOpenSourceTitle',
            text: 'featureOpenSourceText',
            href: REPO_URL,
        },
    ].filter((feature) => encrypted || !feature.encryptedOnly)
})

const revealRoot = useReveal()
</script>

<template>
    <section ref="revealRoot" class="features">
        <div class="features__head" data-reveal>
            <h2 class="panel-title">{{ t('featuresTitle') }}</h2>
            <p class="muted features__subline">{{ t('featuresSubline') }}</p>
        </div>
        <div class="features__grid">
            <div v-for="(feature, i) in features" :key="feature.title" class="feature-card"
                data-reveal :style="{ '--reveal-delay': `${(i + 1) * 80}ms` }">
                <span class="feature-card__tile">
                    <n-icon :component="feature.icon" :size="20" />
                </span>
                <h3 class="feature-card__title">{{ t(feature.title) }}</h3>
                <p v-if="feature.href" class="muted feature-card__text">
                    <a :href="feature.href" target="_blank" rel="noopener noreferrer">{{ t(feature.text) }}</a>
                </p>
                <p v-else class="muted feature-card__text">{{ t(feature.text) }}</p>
            </div>
        </div>
    </section>
</template>

<style scoped>
.features {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    width: 100%;
    max-width: var(--content-form);
    margin: 0 auto;
    text-align: left;
}

.features__head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.features__subline {
    margin: 0;
}

.features__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
}

.feature-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-radius: var(--radius-lg);
}

.feature-card__tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--radius-lg);
    background: var(--app-accent-soft);
    color: var(--app-accent);
}

@media (hover: hover) {
    .feature-card__tile {
        transition: background-color 200ms ease-out, color 200ms ease-out;
    }

    .feature-card:hover .feature-card__tile {
        background: var(--app-accent);
        color: var(--app-on-accent);
    }
}

.feature-card__title {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--font-md);
    line-height: 22px;
    font-weight: 600;
    color: var(--app-text-1);
}

.feature-card__text {
    margin: 0;
}

@media (min-width: 768px) {
    .features__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-5);
    }

    .feature-card {
        padding: var(--space-8);
    }
}
</style>
