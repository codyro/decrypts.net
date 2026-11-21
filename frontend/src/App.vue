<script setup>
import {
  darkTheme,
} from 'naive-ui'
import { computed, onMounted, watchEffect } from 'vue'
import { useHead } from '@unhead/vue'
import { useI18n } from 'vue-i18n'
import { useGlobalState } from './store'
import { useIsMobile } from './utils/composables'
import Header from './views/Header.vue';
import Footer from './views/Footer.vue';
import { api } from './api'
import { getNaiveLocaleConfig } from './i18n/naive-locale'
import { DEFAULT_LOCALE, isSupportedLocale } from './i18n/utils'
import { APP_CONFIG } from './config'
import { buildThemeOverrides, toCssVars, tokensFor } from './theme'
import KeyBackupHost from './components/KeyBackupHost.vue'
import PasskeyMailboxLoginHost from './components/PasskeyMailboxLoginHost.vue'

const {
  isDark, loading, useSideMargin, telegramApp, isTelegram
} = useGlobalState()
const adClient = APP_CONFIG.GOOGLE_AD_CLIENT;
const adSlot = APP_CONFIG.GOOGLE_AD_SLOT;
const { locale } = useI18n({ useScope: 'global' });
const theme = computed(() => isDark.value ? darkTheme : null)
const tokens = computed(() => tokensFor(isDark.value))
const themeOverrides = computed(() => buildThemeOverrides(tokens.value, isDark.value))
const localeConfig = computed(() => getNaiveLocaleConfig(isSupportedLocale(locale.value) ? locale.value : DEFAULT_LOCALE))
const isMobile = useIsMobile()
const showSideMargin = computed(() => !isMobile.value && useSideMargin.value);
const showAd = computed(() => !isMobile.value && adClient && adSlot);

watchEffect(() => {
  if (typeof document === 'undefined') return
  document.documentElement.lang = isSupportedLocale(locale.value) ? locale.value : DEFAULT_LOCALE
  const root = document.documentElement
  for (const [key, value] of Object.entries(toCssVars(tokens.value))) root.style.setProperty(key, value)
})

if (showAd.value) {
  useHead({
    script: [{
      src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`,
      async: true,
      crossorigin: 'anonymous',
    }],
  })
}

onMounted(async () => {
  try {
    await api.getUserSettings();
  } catch (error) {
    console.error(error);
  }

  const token = APP_CONFIG.CF_WEB_ANALY_TOKEN;

  const exist = document.querySelector('script[src="https://static.cloudflareinsights.com/beacon.min.js"]') !== null
  if (token && !exist) {
    const script = document.createElement('script');
    script.defer = true;
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.dataset.cfBeacon = `{ token: ${token} }`;
    document.body.appendChild(script);
  }

  // check if google ad is enabled
  if (showAd.value) {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }


  // check if telegram is enabled
  const enableTelegram = APP_CONFIG.IS_TELEGRAM;
  if (
    (typeof enableTelegram === 'boolean' && enableTelegram === true)
    ||
    (typeof enableTelegram === 'string' && enableTelegram === 'true')
  ) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
    telegramApp.value = window.Telegram?.WebApp || {};
    isTelegram.value = !!window.Telegram?.WebApp?.initData;
  }
});
</script>

<template>
  <n-config-provider :locale="localeConfig.locale" :date-locale="localeConfig.dateLocale" :theme="theme" :theme-overrides="themeOverrides">
    <n-global-style />
    <n-spin description="loading..." :show="loading">
      <n-notification-provider container-style="margin-top: 64px;">
        <n-message-provider container-style="margin-top: 64px;">
          <div class="app-shell" :class="{ 'app-shell--fluid': !showSideMargin, 'app-shell--ads': showAd && showSideMargin }">
            <Header />
            <div class="app-body">
              <aside v-if="showAd && showSideMargin" class="app-ad">
                <ins class="adsbygoogle" style="display:block" :data-ad-client="adClient" :data-ad-slot="adSlot"
                  data-ad-format="auto" data-full-width-responsive="true"></ins>
              </aside>
              <main class="app-main"><router-view /></main>
              <aside v-if="showAd && showSideMargin" class="app-ad">
                <ins class="adsbygoogle" style="display:block" :data-ad-client="adClient" :data-ad-slot="adSlot"
                  data-ad-format="auto" data-full-width-responsive="true"></ins>
              </aside>
            </div>
            <Footer />
          </div>
          <n-back-top />
          <KeyBackupHost />
          <PasskeyMailboxLoginHost />
        </n-message-provider>
      </n-notification-provider>
    </n-spin>
  </n-config-provider>
</template>


<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.app-body {
  flex: 1 0 auto;
  width: 100%;
  max-width: calc(var(--app-max-width) + 2 * var(--gutter));
  margin: 0 auto;
  padding: var(--space-6) var(--gutter) var(--space-12);
}

.app-shell--fluid .app-body { max-width: none; }

.app-shell--ads .app-body {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 160px;
  gap: var(--space-6);
  max-width: calc(var(--app-max-width) + 320px + 48px + 2 * var(--gutter));
}

.app-main { min-width: 0; }
.app-ad { min-height: 100%; }

@media (max-width: 767.98px) {
  .app-body {
    padding-top: var(--space-4);
    padding-bottom: var(--space-8);
  }
}
</style>
