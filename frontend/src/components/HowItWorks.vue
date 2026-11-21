<script setup>
import { computed } from 'vue'
import {
    AlternateEmailOutlined, LockOutlined, MarkEmailReadOutlined, ContentCopyOutlined,
} from '@vicons/material'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'
import { useReveal } from '../utils/reveal'

// The three quick-start steps, shared between the landing page (card layout,
// default) and the Login "Help" tab (compact list via the `compact` prop), so
// the copy never drifts between the two.
const props = defineProps({
    compact: {
        type: Boolean,
        default: false,
    },
})

const { openSettings } = useGlobalState()
const { t } = useScopedI18n('components.HowItWorks')

const steps = computed(() => {
    const encrypted = !!openSettings.value?.enableMailEncryption
    return [
        {
            num: '01',
            icon: AlternateEmailOutlined,
            title: 'step1Title',
            text: 'step1Text',
        },
        encrypted
            ? {
                num: '02',
                icon: LockOutlined,
                title: 'step2TitleEncrypted',
                text: 'step2TextEncrypted',
            }
            : {
                num: '02',
                icon: MarkEmailReadOutlined,
                title: 'step2TitlePlain',
                text: 'step2TextPlain',
            },
        {
            num: '03',
            icon: ContentCopyOutlined,
            title: 'step3Title',
            text: 'step3Text',
        },
    ]
})

const revealRoot = useReveal()
</script>

<template>
    <section v-if="!compact" ref="revealRoot" class="hiw">
        <div class="hiw__head" data-reveal>
            <h2 class="panel-title">{{ t('title') }}</h2>
            <p class="muted hiw__subline">{{ t('subline') }}</p>
        </div>
        <ol class="hiw__cards">
            <li v-for="(step, i) in steps" :key="step.num" class="hiw-card" data-reveal
                :style="{ '--reveal-delay': `${(i + 1) * 80}ms` }">
                <div class="hiw-card__top">
                    <span class="hiw-card__pill mono">{{ t('stepPill', { n: i + 1 }) }}</span>
                    <span class="hiw-card__tile">
                        <n-icon :component="step.icon" :size="20" />
                    </span>
                </div>
                <h3 class="hiw-card__title">{{ t(step.title) }}</h3>
                <p class="muted hiw-card__text">{{ t(step.text) }}</p>
            </li>
        </ol>
    </section>
    <ol v-else class="hiw-compact">
        <li v-for="step in steps" :key="step.num" class="hiw-compact__step">
            <span class="hiw-compact__num mono">{{ step.num }}</span>
            <p class="hiw-compact__text"><strong>{{ t(step.title) }}</strong> {{ t(step.text) }}</p>
        </li>
    </ol>
</template>

<style scoped>
/* Card layout (landing) */
.hiw {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    text-align: left;
}

.hiw__head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.hiw__subline {
    margin: 0;
}

.hiw__cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
}

.hiw-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-radius: var(--radius-lg);
}

.hiw-card__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
}

.hiw-card__pill {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-3);
    border: 1px solid var(--app-border);
    border-radius: var(--radius-pill);
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: var(--font-xs);
    line-height: 18px;
    font-weight: 500;
}

.hiw-card__tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    border-radius: var(--radius-lg);
    background: var(--app-accent-soft);
    color: var(--app-accent);
}

.hiw-card__title {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--font-md);
    line-height: 22px;
    font-weight: 600;
    color: var(--app-text-1);
}

.hiw-card__text {
    margin: 0;
}

/* Compact layout (Login "Help" tab) */
.hiw-compact {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.hiw-compact__step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
}

.hiw-compact__num {
    flex: 0 0 auto;
    font-size: var(--font-xs);
    line-height: 20px;
    letter-spacing: 0.08em;
    color: var(--app-accent);
}

.hiw-compact__text {
    margin: 0;
    font-size: var(--font-sm);
    line-height: 20px;
    color: var(--app-text-3);
}

.hiw-compact__text strong {
    color: var(--app-text-1);
    font-weight: 600;
}

@media (min-width: 768px) {
    .hiw__cards {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-5);
    }

    .hiw-card {
        padding: var(--space-8);
    }
}

@media (max-width: 767.98px) {
    .hiw-compact__step {
        gap: var(--space-2);
    }
}
</style>
