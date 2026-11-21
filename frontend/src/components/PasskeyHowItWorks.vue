<script setup>
/**
 * Shared three-step explainer for how passkeys work on this site, in the
 * theme's numbered mono style:
 *
 *   01 Sign in.               Your passkey signs you in to a private account.
 *   02 Open your mailboxes.   Mailboxes linked to that account open with it.
 *   03 Unlock encrypted mail. Only where a passkey backup exists (needs the
 *                             mailbox key at creation or your saved link).
 *
 * The situation props (signedIn / linked / hasPasskeyBackup / encrypted) are
 * all optional; when one is provided the matching step shows ✓ or – plus a
 * one-line "you are here" status. The copy never claims a passkey decrypts
 * mail by itself — it signs you in, and a *passkey backup* is what unlocks
 * an encrypted mailbox on a new device.
 *
 * The "Learn more" footer opens the About page: the app has no docs URL
 * setting, so About (with the same honest FAQ) is the deepest reference
 * reachable from here.
 */
import { ref } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { useGlobalState } from '../store'
import About from '../views/common/About.vue'

const props = defineProps({
    compact: {
        type: Boolean,
        default: false,
    },
    // null = not provided: the step renders without a ✓/– status.
    signedIn: {
        type: Boolean,
        default: null,
    },
    linked: {
        type: Boolean,
        default: null,
    },
    hasPasskeyBackup: {
        type: Boolean,
        default: null,
    },
    encrypted: {
        type: Boolean,
        default: null,
    },
})

const { t } = useScopedI18n('components.PasskeyHowItWorks')
const { t: indexT } = useScopedI18n('views.Index')
const { openSettings } = useGlobalState()

const showAbout = ref(false)

// [statusKey when true, statusKey when false]; a null prop means "unknown"
// and the step shows no mark at all.
const stepStatus = (value, yesKey, noKey) => {
    if (value === null || typeof value === 'undefined') return null
    return { ok: !!value, text: t(value ? yesKey : noKey) }
}

const steps = [
    {
        num: '01',
        title: 'step1Title',
        text: 'step1Text',
        status: () => stepStatus(props.signedIn, 'statusSignedInYes', 'statusSignedInNo'),
    },
    {
        num: '02',
        title: 'step2Title',
        text: 'step2Text',
        status: () => stepStatus(props.linked, 'statusLinkedYes', 'statusLinkedNo'),
    },
    {
        num: '03',
        title: 'step3Title',
        text: 'step3Text',
        status: () => {
            // An unencrypted mailbox never needs step 3 — say so instead of
            // marking "no backup", which would wrongly suggest a to-do.
            if (props.encrypted === false) {
                return { ok: null, text: t('statusBackupNotNeeded') }
            }
            return stepStatus(props.hasPasskeyBackup, 'statusBackupYes', 'statusBackupNo')
        },
    },
]
</script>

<template>
    <section class="phiw" :class="{ 'phiw--compact': compact }" data-testid="passkey-how-it-works">
        <ol class="phiw__steps">
            <li v-for="step in steps" :key="step.num" class="phiw__step" data-testid="phiw-step">
                <span class="phiw__num mono">{{ step.num }}</span>
                <div class="phiw__body">
                    <p class="phiw__text">
                        <strong>{{ t(step.title) }}</strong> {{ t(step.text) }}
                    </p>
                    <p v-if="step.status()" class="phiw__status" :class="{
                        'is-ok': step.status().ok === true,
                        'is-missing': step.status().ok === false,
                    }" data-testid="phiw-status">
                        <template v-if="step.status().ok !== null">
                            {{ step.status().ok ? '✓' : '–' }}
                        </template>
                        {{ step.status().text }}
                    </p>
                </div>
            </li>
        </ol>
        <p v-if="openSettings.enableIndexAbout" class="phiw__more">
            <n-button text size="tiny" class="phiw__more-button" data-testid="phiw-learn-more"
                @click="showAbout = true">
                {{ t('learnMore') }}
            </n-button>
        </p>
        <n-modal v-model:show="showAbout" preset="card" :title="indexT('about')">
            <About />
        </n-modal>
    </section>
</template>

<style scoped>
.phiw {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    text-align: left;
}

.phiw__steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
}

.phiw__step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
}

.phiw__num {
    flex: 0 0 auto;
    font-size: var(--font-xs);
    line-height: 20px;
    letter-spacing: 0.08em;
    color: var(--app-accent);
}

.phiw__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.phiw__text {
    margin: 0;
    font-size: var(--font-sm);
    line-height: 20px;
    color: var(--app-text-3);
}

.phiw__text strong {
    color: var(--app-text-1);
    font-weight: 600;
}

.phiw__status {
    margin: 0;
    font-size: var(--font-xs);
    line-height: 18px;
    color: var(--app-text-3);
}

.phiw__status.is-ok {
    color: var(--app-success);
}

.phiw__status.is-missing {
    color: var(--app-text-3);
}

.phiw__more {
    margin: 0;
}

.phiw__more-button {
    font-size: var(--font-sm);
}

/* Compact variant (Help tab): tighter rows, status lines keep the same look. */
.phiw--compact .phiw__steps {
    gap: var(--space-3);
}

@media (max-width: 767.98px) {
    .phiw__step {
        gap: var(--space-2);
    }
}
</style>
