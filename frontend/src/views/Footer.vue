<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { GithubAlt } from '@vicons/fa'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import About from './common/About.vue'
import DOMPurify from 'dompurify'
import { REPO_URL } from '../constant'

const { openSettings, showGithubForCurrentUser } = useGlobalState()
const route = useRoute()
const showAbout = ref(false)
const { t } = useScopedI18n('views.Footer')
const { t: headerT } = useScopedI18n('views.Header')
const { t: indexT } = useScopedI18n('views.Index')
const decryptsVersion = import.meta.env.DECRYPTS_VERSION || 'dev'
const upstreamVersion = import.meta.env.PACKAGE_VERSION ? `v${import.meta.env.PACKAGE_VERSION}` : ''
const version = `decrypts ${decryptsVersion}`
const upstreamSuffix = upstreamVersion ? ` · upstream ${upstreamVersion}` : ''
const showAboutLink = computed(() => openSettings.value.enableIndexAbout || route.path.includes('admin'))
const aboutModalStyle = computed(() => ({
    width: openSettings.value.enableMailEncryption
        ? 'min(760px, calc(100vw - 32px))'
        : 'min(640px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 32px)',
}))
</script>

<template>
    <footer class="app-footer">
        <span>{{ t('copyright') }} © {{ new Date().getFullYear() }}</span>
        <template v-if="openSettings.copyright">
            <span aria-hidden="true">·</span>
            <span class="footer-copyright" v-html="DOMPurify.sanitize(openSettings.copyright)"></span>
        </template>
        <template v-if="showAboutLink">
            <span aria-hidden="true">·</span>
            <n-button text size="tiny" @click="showAbout = true">{{ indexT('about') }}</n-button>
        </template>
        <template v-if="showGithubForCurrentUser">
            <span aria-hidden="true">·</span>
            <n-button text size="tiny" tag="a" target="_blank" rel="noopener noreferrer" :href="REPO_URL">
                <template #icon><n-icon :component="GithubAlt" /></template>
                {{ version }}<span class="footer-upstream">{{ upstreamSuffix }}</span>
            </n-button>
        </template>
        <template v-if="openSettings.statusUrl">
            <span aria-hidden="true">·</span>
            <n-button text size="tiny" tag="a" target="_blank" rel="noopener noreferrer" :href="openSettings.statusUrl">
                {{ headerT('status') }}
            </n-button>
        </template>
    </footer>
    <n-modal v-model:show="showAbout" preset="card" :title="indexT('about')"
        :style="aboutModalStyle">
        <About />
    </n-modal>
</template>

<style scoped>
.app-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-5) var(--gutter);
    border-top: 1px solid var(--app-divider);
    color: var(--app-text-3);
    font-size: var(--font-xs);
    line-height: 18px;
    text-align: center;
}
.app-footer :deep(.n-button) { color: var(--app-text-3); }
.footer-copyright { display: inline-flex; }
.footer-copyright :deep(p) { margin: 0; }
/* Keep the footer compact on small screens: drop the upstream credit. */
@media (max-width: 480px) {
    .footer-upstream { display: none; }
}
</style>
