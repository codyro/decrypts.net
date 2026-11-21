<script setup>
import { computed, unref } from 'vue'
import {
    LockOutlined, ShieldOutlined, WarningAmberRound, KeyOutlined,
    CheckCircleOutlineRound, WarningOutlined, ErrorOutlineRound, AutoDeleteOutlined,
} from '@vicons/material'
import { useGlobalState } from '../../store'
import { sanitizeHtml } from '../../utils/sanitize-html'
import { buildRetentionSentences } from '../../utils/retention-text'
import { useScopedI18n } from '@/i18n/app'
import { UPSTREAM_REPO_URL } from '../../constant'

const { announcement, openSettings } = useGlobalState()
const { t } = useScopedI18n('views.common.About')
const { t: retentionT } = useScopedI18n('utils.retentionText')
const safeAnnouncement = computed(() => sanitizeHtml(announcement.value))
const showAppTitleFallback = computed(() =>
    !safeAnnouncement.value && !unref(openSettings)?.enableMailEncryption
)
const retentionSentences = computed(() =>
    buildRetentionSentences(unref(openSettings)?.retention, retentionT)
)

const doesItems = ['does1', 'does2', 'does3']
const doesntItems = ['doesnt1', 'doesnt2', 'doesnt3', 'doesnt4']
const keyItems = ['key1', 'key2', 'key3', 'key4']
</script>

<template>
    <div class="about">
        <div v-if="safeAnnouncement" class="about__announcement" v-html="safeAnnouncement"></div>

        <section v-if="openSettings.enableMailEncryption" class="enc">
            <div class="enc__hero">
                <div class="enc__hero-icon">
                    <n-icon :component="LockOutlined" :size="22" />
                </div>
                <div class="enc__hero-text">
                    <h2 class="panel-title">{{ t('encryptionTitle') }}</h2>
                    <p class="muted">{{ t('encryptionSubtitle') }}</p>
                </div>
            </div>
            <div class="enc__pills">
                <span class="enc-pill">{{ t('pillOptional') }}</span>
                <span class="enc-pill">{{ t('pillPerMailbox') }}</span>
                <span class="enc-pill">{{ t('pillNotAudited') }}</span>
            </div>

            <div class="enc__grid">
                <section class="panel enc-panel">
                    <h3 class="enc-panel__title enc-panel__title--accent">
                        <n-icon :component="ShieldOutlined" :size="18" />
                        {{ t('doesTitle') }}
                    </h3>
                    <ul class="enc-list">
                        <li v-for="item in doesItems" :key="item" class="enc-item">
                            <n-icon class="enc-item__icon enc-item__icon--accent" :component="CheckCircleOutlineRound"
                                :size="15" />
                            <p class="enc-item__text"><strong>{{ t(`${item}Lead`) }}</strong> {{ t(item) }}</p>
                        </li>
                    </ul>
                </section>

                <section class="panel enc-panel enc-panel--warning">
                    <h3 class="enc-panel__title enc-panel__title--warning">
                        <n-icon :component="WarningAmberRound" :size="18" />
                        {{ t('doesntTitle') }}
                    </h3>
                    <ul class="enc-list">
                        <li v-for="item in doesntItems" :key="item" class="enc-item">
                            <n-icon class="enc-item__icon enc-item__icon--warning" :component="WarningOutlined"
                                :size="15" />
                            <p class="enc-item__text"><strong>{{ t(`${item}Lead`) }}</strong> {{ t(item) }}</p>
                        </li>
                    </ul>
                </section>

                <section class="panel enc-panel enc-panel--danger">
                    <h3 class="enc-panel__title enc-panel__title--danger">
                        <n-icon :component="KeyOutlined" :size="18" />
                        {{ t('keyTitle') }}
                    </h3>
                    <ul class="enc-list">
                        <li v-for="item in keyItems" :key="item" class="enc-item">
                            <n-icon class="enc-item__icon enc-item__icon--danger" :component="ErrorOutlineRound"
                                :size="15" />
                            <p class="enc-item__text"><strong>{{ t(`${item}Lead`) }}</strong> {{ t(item) }}</p>
                        </li>
                    </ul>
                </section>
            </div>

            <p class="enc__fine caption">{{ t('encryptionFinePrint') }}</p>
        </section>

        <section v-if="retentionSentences.length > 0" class="panel enc-panel retention-panel">
            <h3 class="enc-panel__title enc-panel__title--accent">
                <n-icon :component="AutoDeleteOutlined" :size="18" />
                {{ t('retentionTitle') }}
            </h3>
            <ul class="enc-list">
                <li class="enc-item">
                    <n-icon class="enc-item__icon enc-item__icon--accent" :component="CheckCircleOutlineRound"
                        :size="15" />
                    <p class="enc-item__text"><strong>{{ t('retentionLead') }}</strong>
                        {{ retentionSentences.join(' ') }}</p>
                </li>
                <li class="enc-item">
                    <n-icon class="enc-item__icon enc-item__icon--warning" :component="WarningOutlined" :size="15" />
                    <p class="enc-item__text">{{ t('retentionDeleted') }}</p>
                </li>
            </ul>
        </section>

        <p v-else-if="showAppTitleFallback && openSettings.title" class="about__fallback">
            {{ openSettings.title }}
        </p>

        <p class="about__credit">
            {{ t('upstreamCreditPrefix') }}<a :href="UPSTREAM_REPO_URL" target="_blank"
                rel="noopener noreferrer">cloudflare_temp_email</a>{{ t('upstreamCreditSuffix') }}
        </p>
    </div>
</template>

<style scoped>
.about {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    /* keep the modal content scrollable on short screens */
    max-height: calc(100vh - 160px);
    overflow-y: auto;
}

.about__announcement {
    font-size: var(--font-md);
    line-height: 22px;
    color: var(--app-text-2);
}

.about__announcement :deep(p:first-child) {
    margin-top: 0;
}

.about__announcement :deep(p:last-child) {
    margin-bottom: 0;
}

/* Encrypted mailboxes explainer */

.enc {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
}

.enc__hero {
    display: flex;
    align-items: center;
    gap: var(--space-3);
}

.enc__hero-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex: 0 0 auto;
    border-radius: var(--radius-pill);
    background: var(--app-accent-soft);
    color: var(--app-accent);
}

.enc__hero-text {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.enc__hero-text .muted {
    margin: 0;
}

.enc__pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
}

.enc-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--space-3);
    border: 1px solid var(--app-border);
    border-radius: var(--radius-pill);
    font-size: var(--font-xs);
    line-height: 18px;
    color: var(--app-text-3);
}

.enc__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
}

@media (min-width: 768px) {
    .enc__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .enc-panel--danger {
        grid-column: 1 / -1;
    }
}

.enc-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
}

.enc-panel--warning {
    border-left: 2px solid var(--app-warning);
}

.enc-panel--danger {
    border-left: 2px solid var(--app-danger);
}

.enc-panel__title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--font-md);
    line-height: 22px;
    font-weight: 600;
    color: var(--app-text-1);
}

.enc-panel__title--accent {
    color: var(--app-accent);
}

.enc-panel__title--warning {
    color: var(--app-warning);
}

.enc-panel__title--danger {
    color: var(--app-danger);
}

.enc-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
}

.enc-item {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
}

.enc-item__icon {
    flex: 0 0 auto;
    margin-top: 3px;
}

.enc-item__icon--accent {
    color: var(--app-accent);
}

.enc-item__icon--warning {
    color: var(--app-warning);
}

.enc-item__icon--danger {
    color: var(--app-danger);
}

.enc-item__text {
    margin: 0;
    font-size: var(--font-sm);
    line-height: 20px;
    color: var(--app-text-3);
}

.enc-item__text strong {
    color: var(--app-text-1);
    font-weight: 600;
}

.enc__fine {
    margin: 0;
    border-top: 1px solid var(--app-divider);
    padding-top: var(--space-4);
}

.about__fallback {
    margin: 0;
    text-align: center;
    color: var(--app-text-3);
}

.about__credit {
    margin: 0;
    border-top: 1px solid var(--app-divider);
    padding-top: var(--space-4);
    text-align: center;
    font-size: var(--font-xs);
    line-height: 18px;
    color: var(--app-text-3);
}

@media (max-width: 767.98px) {
    .about {
        gap: var(--space-4);
    }

    .enc {
        gap: var(--space-4);
    }

    .enc-panel {
        padding: var(--space-4);
    }
}
</style>
