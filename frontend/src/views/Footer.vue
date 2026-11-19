<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import About from './common/About.vue'
import DOMPurify from 'dompurify'

const { openSettings, showAdminPage } = useGlobalState()
const route = useRoute()
const showAbout = ref(false)
const { t } = useScopedI18n('views.Footer')
const { t: headerT } = useScopedI18n('views.Header')
const { t: indexT } = useScopedI18n('views.Index')
const version = import.meta.env.PACKAGE_VERSION ? `v${import.meta.env.PACKAGE_VERSION}` : ''
const showGithubForCurrentUser = computed(() => {
    if (!openSettings.value.showGithub) return false
    if (openSettings.value.showGithubForUser) return true
    return showAdminPage.value
})
const showAboutLink = computed(() => openSettings.value.enableIndexAbout || route.path.includes('admin'))
</script>

<template>
    <footer class="app-footer">
        <span>{{ t('copyright') }} © 2023-{{ new Date().getFullYear() }}</span>
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
            <n-button text size="tiny" tag="a" target="_blank" rel="noopener noreferrer"
                href="https://github.com/dreamhunter2333/cloudflare_temp_email">
                {{ version || 'Github' }}
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
        style="width: min(640px, calc(100vw - 32px))">
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
</style>
