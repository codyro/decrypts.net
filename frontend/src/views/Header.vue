<script setup>
import { ref, computed, onMounted } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useHead } from '@unhead/vue'
import { useRoute, useRouter } from 'vue-router'
import { useIsMobile } from '../utils/composables'
import {
    DarkModeOutlined, LightModeOutlined, MenuRound,
    SettingsOutlined, KeyboardArrowDownOutlined, LanguageRound
} from '@vicons/material'

import { useGlobalState } from '../store'
import { api } from '../api'
import { getRouterPathWithLang, hashPassword } from '../utils'
import { DEFAULT_LOCALE, isSupportedLocale, replaceLocaleInFullPath } from '../i18n/utils'
import { getLocaleLabel, SUPPORTED_LOCALES } from '../i18n/locale-registry'
import Turnstile from '../components/Turnstile.vue'
import PreferencesDrawer from '../components/PreferencesDrawer.vue'

const message = useMessage()
const notification = useNotification()

const {
    toggleDark, isDark, isTelegram, showAdminPage, showUserSystem,
    showAuth, auth, loading, openSettings, preferredLocale, userSettings,
    useSideMargin
} = useGlobalState()
const route = useRoute()
const router = useRouter()
const isMobile = useIsMobile()
const showSideMargin = computed(() => !isMobile.value && useSideMargin.value)

const showMobileMenu = ref(false)
const showPreferences = ref(false)
const menuValue = computed(() => {
    if (route.path.includes("user")) return "user";
    if (route.path.includes("admin")) return "admin";
    return "home";
});

const cfToken = ref('')
const turnstileRef = ref(null)

const authFunc = async () => {
    try {
        await api.fetch('/open_api/site_login', {
            method: 'POST',
            body: JSON.stringify({
                password: await hashPassword(auth.value),
                cf_token: cfToken.value
            })
        });
        location.reload()
    } catch (error) {
        message.error(error.message || "error");
        turnstileRef.value?.refresh?.();
    }
}

const languageOptions = SUPPORTED_LOCALES.map((locale) => ({
    label: getLocaleLabel(locale),
    value: locale,
    key: locale,
}))

const { t, locale } = useScopedI18n('views.Header')
const currentLocaleLabel = computed(() => {
    return languageOptions.find(opt => opt.value === locale.value)?.label || locale.value;
});

const changeLocale = async (lang) => {
    if (!isSupportedLocale(lang)) {
        return;
    }

    const currentFullPath = route.fullPath;
    const targetFullPath = replaceLocaleInFullPath(currentFullPath, lang);

    if (lang === locale.value && targetFullPath === currentFullPath) {
        showMobileMenu.value = false;
        return;
    }

    if (lang === DEFAULT_LOCALE) {
        preferredLocale.value = DEFAULT_LOCALE;
    }

    let localeSwitched = false;
    try {
        await router.push({ path: targetFullPath, force: true });
        localeSwitched = router.currentRoute.value.fullPath === targetFullPath;
        if (!localeSwitched) {
            await router.replace({ path: targetFullPath, force: true });
            localeSwitched = router.currentRoute.value.fullPath === targetFullPath;
        }
    } catch (error) {
        console.error('Failed to switch locale', error);
    } finally {
        showMobileMenu.value = false;
    }

    if (localeSwitched) preferredLocale.value = lang;
}

const navItems = computed(() => [
    { key: 'home', label: t('mailbox'), show: true },
    { key: 'user', label: t('userCenter'), show: showUserSystem.value && !isTelegram.value },
    { key: 'admin', label: t('admin'), show: showAdminPage.value },
])

const navigate = async (key) => {
    showMobileMenu.value = false
    if (key === 'admin') loading.value = true
    try {
        const path = key === 'home' ? '/' : `/${key}`
        await router.push(getRouterPathWithLang(path, locale.value))
    } finally {
        if (key === 'admin') loading.value = false
    }
}

const openPreferences = () => {
    showMobileMenu.value = false
    showPreferences.value = true
}

useHead({
    title: () => openSettings.value.title || t('title'),
    meta: [
        { name: "description", content: openSettings.value.description || t('title') },
    ]
});

const logoClickCount = ref(0);
const logoClick = async () => {
    if (route.path.includes("admin")) {
        logoClickCount.value = 0;
        return;
    }
    if (logoClickCount.value >= 5) {
        logoClickCount.value = 0;
        message.info("Change to admin Page");
        loading.value = true;
        await router.push(getRouterPathWithLang('/admin', locale.value));
        loading.value = false;
    } else {
        logoClickCount.value++;
    }
    if (logoClickCount.value > 0) {
        message.info(`Click ${5 - logoClickCount.value + 1} times to enter the admin page`);
    }
}

onMounted(async () => {
    await api.getOpenSettings(message, notification);
    if (showUserSystem.value && !userSettings.value.user_id) await api.getUserSettings(message);
});
</script>

<template>
    <div>
        <header class="app-header" :class="{ 'app-header--fluid': !showSideMargin }">
            <div class="app-header__inner">
                <div class="app-brand" @click="logoClick">
                    <img class="header-logo" src="/logo.png" alt="" />
                    <span class="app-title">{{ openSettings.title || t('title') }}</span>
                </div>
                <nav v-if="!isMobile" class="app-nav" aria-label="Primary">
                    <template v-for="item in navItems" :key="item.key">
                        <n-button v-if="item.show" quaternary size="small" class="app-nav__item"
                            :class="{ 'is-active': menuValue === item.key }" @click="navigate(item.key)">
                            {{ item.label }}
                        </n-button>
                    </template>
                </nav>
                <div class="header-actions">
                    <n-dropdown v-if="!isMobile" :options="languageOptions" @select="changeLocale" trigger="click" class="header-locale-dropdown">
                        <n-button quaternary size="small" class="header-locale-button">
                            <template #icon><n-icon :component="LanguageRound" /></template>
                            {{ currentLocaleLabel }}
                            <n-icon :component="KeyboardArrowDownOutlined" class="locale-chevron" />
                        </n-button>
                    </n-dropdown>
                    <n-button quaternary circle size="small" :aria-label="isDark ? t('light') : t('dark')"
                        :title="isDark ? t('light') : t('dark')" @click="toggleDark()">
                        <template #icon><n-icon :component="isDark ? LightModeOutlined : DarkModeOutlined" /></template>
                    </n-button>
                    <n-button v-if="!isMobile" quaternary circle size="small" :aria-label="t('preferences')"
                        :title="t('preferences')" @click="showPreferences = true">
                        <template #icon><n-icon :component="SettingsOutlined" /></template>
                    </n-button>
                    <n-button v-if="isMobile" quaternary circle :aria-label="t('menu')" :title="t('menu')"
                        @click="showMobileMenu = true">
                        <template #icon><n-icon :component="MenuRound" /></template>
                    </n-button>
                </div>
            </div>
        </header>
        <n-drawer v-model:show="showMobileMenu" placement="right" :width="'min(320px, 86vw)'">
            <n-drawer-content :title="t('menu')" closable>
                <nav class="mobile-menu-nav" aria-label="Primary">
                    <template v-for="item in navItems" :key="item.key">
                        <n-button v-if="item.show" quaternary block class="mobile-menu-nav__item"
                            :class="{ 'is-active': menuValue === item.key }" @click="navigate(item.key)">
                            {{ item.label }}
                        </n-button>
                    </template>
                </nav>
                <div class="mobile-menu-actions">
                    <n-dropdown :options="languageOptions" @select="changeLocale" trigger="click" class="header-locale-dropdown">
                        <button type="button" class="mobile-menu-utility-button">
                            <n-icon :component="LanguageRound" />
                            <span class="mobile-menu-action-label">{{ currentLocaleLabel }}</span>
                            <n-icon :component="KeyboardArrowDownOutlined" class="mobile-menu-action-arrow" />
                        </button>
                    </n-dropdown>
                    <button type="button" class="mobile-menu-utility-button" @click="openPreferences">
                        <n-icon :component="SettingsOutlined" />
                        <span class="mobile-menu-action-label">{{ t('preferences') }}</span>
                    </button>
                </div>
            </n-drawer-content>
        </n-drawer>
        <PreferencesDrawer v-model:show="showPreferences" :is-home-route="menuValue === 'home'" />
        <n-modal v-model:show="showAuth" :closable="false" :closeOnEsc="false" :maskClosable="false" preset="dialog"
            :title="t('accessHeader')">
            <p>{{ t('accessTip') }}</p>
            <n-input v-model:value="auth" type="password" show-password-on="click" @keyup.enter="authFunc" />
            <Turnstile ref="turnstileRef" v-if="openSettings.enableGlobalTurnstileCheck" v-model:value="cfToken" />
            <template #action>
                <n-button :loading="loading" @click="authFunc" type="primary">
                    {{ t('ok') }}
                </n-button>
            </template>
        </n-modal>
    </div>
</template>

<style scoped>
.app-header {
    position: sticky;
    top: 0;
    z-index: 20;
    height: var(--header-height);
    background: var(--app-bg);
    border-bottom: 1px solid var(--app-border);
}

.app-header__inner {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    width: 100%;
    max-width: calc(var(--app-max-width) + 2 * var(--gutter));
    height: 100%;
    margin: 0 auto;
    padding: 0 var(--gutter);
}

.app-header--fluid .app-header__inner { max-width: none; }

.app-brand {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    cursor: pointer;
}

.header-logo { flex: 0 0 auto; width: 28px; height: 28px; }

.app-title {
    overflow: hidden;
    color: var(--app-text-1);
    font-family: var(--font-mono);
    font-size: var(--font-lg);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Terminal prompt glyph before the site title (CSS only, no i18n text). */
.app-title::before {
    content: '>_';
    margin-right: var(--space-2);
    color: var(--app-accent);
    font-weight: 500;
    letter-spacing: 0;
}

/* Faint phosphor glow on the wordmark, dark mode only. */
html.dark .app-title {
    text-shadow: 0 0 14px rgba(255, 176, 0, 0.4), 0 0 2px rgba(255, 176, 0, 0.55);
}

.app-nav { display: flex; flex: 1 1 auto; align-items: center; gap: var(--space-1); }
.app-nav__item.is-active,
.mobile-menu-nav__item.is-active { background: var(--app-accent-soft); color: var(--app-accent); }
.header-actions { display: flex; flex: 0 0 auto; align-items: center; gap: var(--space-2); margin-left: auto; }
.locale-chevron { margin-left: var(--space-1); }
.mobile-menu-nav { display: flex; flex-direction: column; gap: var(--space-2); }
.mobile-menu-nav__item { justify-content: flex-start; height: 44px; }
.mobile-menu-nav__item :deep(.n-button__content) { justify-content: flex-start; }

.mobile-menu-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--app-divider);
}

.mobile-menu-utility-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-width: 0;
    height: 44px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--app-text-2);
    font: inherit;
    cursor: pointer;
}

.mobile-menu-utility-button:hover { background: var(--app-accent-soft); }
.mobile-menu-action-label { min-width: 0; margin: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-menu-action-arrow { flex: 0 0 auto; margin-left: 2px; }

@media (max-width: 767.98px) {
    .app-header__inner { gap: var(--space-2); }
    .app-brand { flex: 1 1 auto; }
    .header-actions { gap: var(--space-1); }
}
</style>
