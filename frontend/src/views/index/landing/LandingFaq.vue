<script setup>
import { computed, ref, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../../../store'
import { buildRetentionSentences } from '../../../utils/retention-text'
import { useReveal } from '../../../utils/reveal'
import About from '../../common/About.vue'

const { openSettings } = useGlobalState()
const { t } = useScopedI18n('views.index.Landing')
const { t: retentionT } = useScopedI18n('utils.retentionText')
const { t: indexT } = useScopedI18n('views.Index')

// Keep the copy honest and consistent with the About page: the same caveats,
// not softened. Encryption-only items only exist when the operator runs
// mailbox encryption; the retention item only when retention is configured.
const faqItems = computed(() => {
    const encrypted = !!openSettings.value?.enableMailEncryption
    const items = []
    if (encrypted) {
        items.push(
            { name: 'e2e', title: t('faqE2eTitle'), text: t('faqE2eText') },
            { name: 'read', title: t('faqReadTitle'), text: t('faqReadText') },
            { name: 'loseKey', title: t('faqLoseKeyTitle'), text: t('faqLoseKeyText') },
        )
    }
    const retention = buildRetentionSentences(openSettings.value?.retention, retentionT)
    if (retention.length > 0) {
        items.push({ name: 'retention', title: t('faqRetentionTitle'), text: retention.join(' ') })
    }
    items.push({ name: 'account', title: t('faqAccountTitle'), text: t('faqAccountText') })
    return items
})

const showAbout = ref(false)
const revealRoot = useReveal()

// Controlled accordion so the first item starts expanded once the items are
// known: a classic FAQ look, and the first answer stays in the DOM for SSR
// and no-JS (naive-ui otherwise mounts content lazily on first expand).
const expandedNames = ref([])
watch(faqItems, (items) => {
    if (expandedNames.value.length === 0 && items.length > 0) {
        expandedNames.value = [items[0].name]
    }
}, { immediate: true })
</script>

<template>
    <section ref="revealRoot" class="faq">
        <div class="faq__head" data-reveal>
            <h2 class="panel-title">{{ t('faqTitle') }}</h2>
        </div>
        <!-- show directive: content that has been expanded once stays in the
             DOM instead of unmounting on collapse. -->
        <n-collapse class="faq__collapse" display-directive="show" :expanded-names="expandedNames"
            @update:expanded-names="expandedNames = $event" data-reveal
            :style="{ '--reveal-delay': '80ms' }">
            <n-collapse-item v-for="item in faqItems" :key="item.name" :name="item.name"
                :title="item.title">
                <p class="muted faq__answer">{{ item.text }}</p>
            </n-collapse-item>
        </n-collapse>
        <p v-if="openSettings.enableIndexAbout" class="faq__more" data-reveal
            :style="{ '--reveal-delay': '160ms' }">
            <n-button text size="tiny" class="faq__about-button" @click="showAbout = true">
                {{ t('faqMoreInAbout') }}
            </n-button>
        </p>
        <n-modal v-model:show="showAbout" preset="card" :title="indexT('about')">
            <About />
        </n-modal>
    </section>
</template>

<style scoped>
.faq {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    width: 100%;
    max-width: var(--content-form);
    margin: 0 auto;
    text-align: left;
}

.faq__head {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.faq__collapse {
    background: var(--app-surface);
    border: 1px solid var(--app-border);
    border-radius: var(--radius-lg);
    --n-border-color: var(--app-border);
}

.faq__collapse :deep(.n-collapse-item) {
    padding: 0 var(--space-5);
}

.faq__collapse :deep(.n-collapse-item:first-child) {
    margin-top: var(--space-3);
}

.faq__collapse :deep(.n-collapse-item:last-child) {
    margin-bottom: var(--space-3);
}

.faq__collapse :deep(.n-collapse-item__header) {
    font-family: var(--font-mono);
    font-size: var(--font-md);
    font-weight: 600;
    color: var(--app-text-1);
}

.faq__answer {
    margin: 0;
    padding-bottom: var(--space-4);
}

.faq__more {
    margin: 0;
}

.faq__about-button {
    font-size: var(--font-sm);
}

@media (max-width: 767.98px) {
    .faq__collapse :deep(.n-collapse-item) {
        padding: 0 var(--space-4);
    }
}
</style>
