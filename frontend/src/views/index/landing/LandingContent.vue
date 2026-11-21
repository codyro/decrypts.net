<script setup>
import { computed } from 'vue'

import { useGlobalState } from '../../../store'
import LandingHero from './LandingHero.vue'
import FeatureGrid from './FeatureGrid.vue'
import LandingFaq from './LandingFaq.vue'
import HowItWorks from '../../../components/HowItWorks.vue'

const { jwt, isTelegram } = useGlobalState()

// The marketing landing only shows for a fresh visitor: no active mailbox
// session and not inside the Telegram mini-app. A stored credential without a
// reachable mailbox (the warning state) keeps just the create/login card.
const showLanding = computed(() => !jwt.value && !isTelegram.value)
</script>

<template>
    <div v-if="showLanding" class="landing-content">
        <div class="landing-content__top">
            <LandingHero class="landing-content__hero" />
            <div class="landing-content__card">
                <slot />
            </div>
        </div>
        <HowItWorks class="landing-content__section" />
        <FeatureGrid class="landing-content__section" />
        <LandingFaq class="landing-content__section" />
    </div>
    <div v-else class="landing-content__card landing-content__card--solo">
        <slot />
    </div>
</template>

<style scoped>
.landing-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-12);
    width: 100%;
    text-align: left;
}

/* Hero above the create/login card on narrow screens; side by side on wide
   ones. The hero is above the fold, so it never waits for the observer. */
.landing-content__top {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-8);
    align-items: center;
}

.landing-content__card {
    width: min(var(--content-auth), 100%);
    margin: 0 auto;
}

.landing-content__card--solo {
    width: 100%;
}

@media (min-width: 1024px) {
    .landing-content__top {
        grid-template-columns: minmax(0, 1fr) minmax(400px, var(--content-auth));
        gap: var(--space-12);
    }

    .landing-content__card {
        width: auto;
        margin: 0;
    }
}

@media (max-width: 767.98px) {
    .landing-content {
        gap: var(--space-8);
    }
}
</style>
