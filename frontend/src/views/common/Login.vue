<script>
import { api } from '../../api'

// The default new-address flow uploads the encryption public key. Overrides
// (e.g. the Telegram mini-app) receive it via the optional 5th `options`
// argument ({ encryptionPublicKey }) and forward it as `encryption_public_key`.
export const defaultNewAddressPath = async (
    address_name, domain, cf_token, enableRandomSubdomain, options = {}
) => {
    return await api.fetch("/api/new_address", {
        method: "POST",
        body: JSON.stringify({
            name: address_name,
            domain: domain,
            cf_token: cf_token,
            enableRandomSubdomain: enableRandomSubdomain,
            ...(options.encryptionPublicKey
                ? { encryption_public_key: options.encryptionPublicKey }
                : {}),
        }),
    });
}
</script>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch, nextTick } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'
import { NewLabelOutlined, EmailOutlined, RedeemOutlined } from '@vicons/material'

import AdminContact from '../common/AdminContact.vue'
import About from '../common/About.vue'
import HowItWorks from '../../components/HowItWorks.vue'
import Turnstile from '../../components/Turnstile.vue'
import PasskeyHowItWorks from '../../components/PasskeyHowItWorks.vue'
import PasskeyMailboxLogin from '../../components/PasskeyMailboxLogin.vue'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import { getRouterPathWithLang, hashPassword } from '../../utils'
import { buildRetentionSentences } from '../../utils/retention-text'
import { generateKeyPair } from '../../utils/mail-crypto'
import { randomEmailLocalPart } from '../../utils/random-name'
import { addPrivateKey } from '../../utils/mail-key-store'
import { offerKeyBackup } from '../../utils/key-backup-prompts'
import { isWebAuthnSupported } from '../../utils/passkey-account'
import { canOfferPasskeyMailboxLogin } from '../../utils/passkey-mailbox'
import { setPasskeyLoginSwitchToCreate } from '../../utils/passkey-mailbox-login'

const props = defineProps({
    bindUserAddress: {
        type: Function,
        default: async () => { await api.bindUserAddress(); },
        required: true
    },
    newAddressPath: {
        type: Function,
        default: defaultNewAddressPath,
        required: true
    },
})

const message = useMessage()
const notification = useNotification()
const router = useRouter()

const {
    jwt, loading, openSettings,
    showAddressCredential, userSettings, addressPassword, settings,
    showUserSystem
} = useGlobalState()

const enableMailEncryption = ref(false)

// Apply the operator-configured "encrypt received mail" default once the open
// settings are loaded. Only the initial value is applied here — a choice the
// user already made in this form is never overridden afterwards.
const encryptionDefaultApplied = ref(false)
watch(() => openSettings.value?.fetched, (fetched) => {
    if (!fetched || encryptionDefaultApplied.value) return
    encryptionDefaultApplied.value = true
    if (openSettings.value?.enableMailEncryption && openSettings.value?.defaultMailEncryption) {
        enableMailEncryption.value = true
    }
}, { immediate: true })

const tabValue = ref('signin')
// Creating an address is the main action, so make it the initial tab once it
// is known to be available. Never override a tab the user already clicked;
// programmatic switches are flagged so they don't count as a user choice.
const tabValueTouched = ref(false)
let applyingDefaultTab = false
watch(tabValue, () => {
    if (!applyingDefaultTab) tabValueTouched.value = true
})
const credential = ref('')
const emailName = ref("")
const emailDomain = ref("")
const cfToken = ref("")
const subdomainMode = ref("normal")
const customSubdomain = ref("")
const loginCfToken = ref("")
const loginTurnstileRef = ref(null)
const loginMethod = ref('credential') // 'credential' or 'password'
const loginAddress = ref('')
const loginPassword = ref('')

// 根据 openSettings 初始化登录方式
const initLoginMethod = () => {
    if (openSettings.value?.enableAddressPassword) {
        loginMethod.value = 'password';
    } else {
        loginMethod.value = 'credential';
    }
}

const login = async () => {
    if (loginMethod.value === 'password') {
        // Password login
        if (!loginAddress.value || !loginPassword.value) {
            message.error(t('emailPasswordRequired'));
            return;
        }
        try {
            const res = await api.fetch('/api/address_login', {
                method: 'POST',
                body: JSON.stringify({
                    email: loginAddress.value,
                    password: await hashPassword(loginPassword.value),
                    cf_token: loginCfToken.value
                })
            });
            jwt.value = res.jwt;
            await api.getSettings();
            try {
                await props.bindUserAddress();
            } catch (error) {
                message.error(`${t('bindUserAddressError')}: ${error.message}`);
            }
            await router.push(getRouterPathWithLang("/", locale.value));
        } catch (error) {
            message.error(error.message || "error");
            loginTurnstileRef.value?.refresh?.();
        }
        return;
    }
    if (!credential.value) {
        message.error(t('credentialInput'));
        return;
    }
    try {
        await api.fetch('/open_api/credential_login', {
            method: 'POST',
            body: JSON.stringify({
                credential: credential.value,
                cf_token: loginCfToken.value
            })
        });
        jwt.value = credential.value;
        await api.getSettings();
        try {
            await props.bindUserAddress();
        } catch (error) {
            message.error(`${t('bindUserAddressError')}: ${error.message}`);
        }
        await router.push(getRouterPathWithLang("/", locale.value));
    } catch (error) {
        message.error(error.message || "error");
        loginTurnstileRef.value?.refresh?.();
    }
}

const { locale, t } = useScopedI18n('views.common.Login')
const { t: indexT } = useScopedI18n('views.Index')
const { t: retentionT } = useScopedI18n('utils.retentionText')

// How long mails and addresses are kept, straight from the operator's
// auto-cleanup settings. Empty when auto cleanup is off.
const retentionSentences = computed(() =>
    buildRetentionSentences(openSettings.value?.retention, retentionT)
)

const loginAndBindTag = computed(() => {
    if (userSettings.value.user_email) {
        return t('loginAndBind')
    }
    return t('login')
})

// Quick-start steps for the help tab live in the shared HowItWorks component
// (compact mode), so the landing page and the help tab never drift apart.
const showHelpAbout = ref(false)

// "Log in with passkey" mirrors the user-center passkey login: offered only
// when the user system is enabled and the browser can do WebAuthn.
const passkeyLoginVisible = computed(() => canOfferPasskeyMailboxLogin({
    showUserSystem: showUserSystem.value,
    webAuthnSupported: isWebAuthnSupported(),
}))
const switchToCreateTab = () => {
    tabValueTouched.value = false
    applyingDefaultTab = true
    tabValue.value = 'register'
    applyingDefaultTab = false
}
// The app-level PasskeyMailboxLoginHost ("no linked mailboxes" dialog) asks
// the Login card to switch to the Create tab. Unregister on unmount: after a
// passkey sign-in the landing swaps this card for the user's address list,
// and a stale handler would silently do nothing.
setPasskeyLoginSwitchToCreate(switchToCreateTab)
onBeforeUnmount(() => setPasskeyLoginSwitchToCreate(null))

const addressRegex = computed(() => {
    try {
        if (openSettings.value.addressRegex) {
            return new RegExp(openSettings.value.addressRegex, 'g');
        }
    } catch (error) {
        console.error(error);
        message.error(`Invalid addressRegex: ${openSettings.value.addressRegex}`);
    }
    return /[^a-z0-9]/g;
});

const generateNameLoading = ref(false);
const generateName = async () => {
    try {
        generateNameLoading.value = true;
        emailName.value = (await randomEmailLocalPart())
            .toLowerCase()
            .replace(/\s+/g, '.')
            .replace(/\.{2,}/g, '.')
            .replace(addressRegex.value, '');
        // support maxAddressLen
        if (emailName.value.length > openSettings.value.maxAddressLen) {
            emailName.value = emailName.value.slice(0, openSettings.value.maxAddressLen);
        }
    } catch (error) {
        message.error(error.message || "error");
    } finally {
        generateNameLoading.value = false;
    }
};

const newEmail = async () => {
    try {
        // If custom names are disabled, send empty name to trigger backend auto-generation
        const nameToSend = openSettings.value.disableCustomAddressName ? "" : emailName.value;
        const domainToSend = subdomainMode.value === "custom"
            ? `${customSubdomain.value.trim()}.${emailDomain.value}`
            : emailDomain.value;
        let keyPair = null;
        if (enableMailEncryption.value) {
            keyPair = await generateKeyPair();
        }
        const res = await props.newAddressPath(
            nameToSend,
            domainToSend,
            cfToken.value,
            subdomainMode.value === "random",
            keyPair ? { encryptionPublicKey: keyPair.publicKey } : {}
        );
        jwt.value = res["jwt"];
        addressPassword.value = res["password"] || '';
        await api.getSettings();
        if (keyPair) {
            if (settings.value.address) {
                // The private key never leaves this device; it is stored as
                // a non-extractable CryptoKey (raw string dropped when the
                // global backup dialog closes) and the raw `#k=` link is
                // shown exactly once by the KeyBackupHost, built from the
                // still-in-memory generated key.
                await addPrivateKey(settings.value.address, keyPair.privateKey);
                offerKeyBackup({
                    address: settings.value.address,
                    rawKey: keyPair.privateKey,
                    publicKey: keyPair.publicKey,
                });
            }
        }
        await router.push(getRouterPathWithLang("/", locale.value));
        showAddressCredential.value = true;
        try {
            await props.bindUserAddress();
        } catch (error) {
            message.error(`${t('bindUserAddressError')}: ${error.message}`);
        }
    } catch (error) {
        message.error(error.message || "error");
    }
};

const openRedeemPage = async () => {
    await router.push(getRouterPathWithLang('/redeem', locale.value));
};

const addressPrefix = computed(() => {
    // if user has role, return role prefix
    if (userSettings.value?.user_role) {
        return userSettings.value.user_role.prefix || "";
    }
    // if user has no role, return default prefix
    return openSettings.value.prefix;
});

const canUseRandomSubdomain = computed(() => {
    if (!emailDomain.value) {
        return false;
    }
    return (openSettings.value.randomSubdomainDomains || []).includes(emailDomain.value);
});

watch(canUseRandomSubdomain, (enabled) => {
    if (!enabled) {
        subdomainMode.value = "normal";
    }
});

const domainsOptions = computed(() => {
    // if user has role, return role domains
    if (userSettings.value.user_role) {
        const allDomains = userSettings.value.user_role.domains;
        if (!allDomains) return openSettings.value.domains;
        return openSettings.value.domains.filter((domain) => {
            return allDomains.includes(domain.value);
        });
    }
    // if user has no role, return default domains
    if (!openSettings.value.defaultDomains) {
        return openSettings.value.domains;
    }
    // if user has no role and no default domains, return all domains
    return openSettings.value.domains.filter((domain) => {
        return openSettings.value.defaultDomains.includes(domain.value);
    });
});

const showNewAddressTab = computed(() => {
    if (openSettings.value.disableAnonymousUserCreateEmail
        && !userSettings.value.user_email
    ) {
        return false;
    }
    return openSettings.value.enableUserCreateEmail;
})

// A browser that already holds saved mailboxes belongs to a returning
// visitor, who usually wants to log back in — even (or especially) when the
// current session expired or was cleared. Both credential tokens and
// password-login tokens live in LocalAddressCache, so a non-empty cache is
// the "returning" signal.
const hasSavedMailboxes = () => {
    try {
        const cache = JSON.parse(localStorage.getItem('LocalAddressCache') || '[]')
        return Array.isArray(cache) && cache.length > 0
    } catch (error) {
        console.error(error)
        return false
    }
}

// Apply the initial tab once creation availability is known; re-check when
// user settings arrive (they can disable anonymous creation).
watch(showNewAddressTab, (allowed) => {
    if (!openSettings.value?.fetched || tabValueTouched.value) return
    applyingDefaultTab = true
    tabValue.value = allowed && !hasSavedMailboxes() ? 'register' : 'signin'
    applyingDefaultTab = false
}, { immediate: true });

// Desktop: keep the card's tab-content area at least as tall as the initially
// shown (create) tab. naive-ui re-centres nothing — the landing grid top-aligns
// the card — but a shorter tab would still move the sections below. The
// min-height absorbs the difference; it only ever grows (re-measured when the
// pane grows, e.g. Turnstile arriving), never shrinks below the first
// measurement, so switching tabs never jumps. Measured, not hard-coded, so it
// adapts to locale and operator settings. Only ≥1024px, where the card sits
// beside the hero; on narrow screens it spans full width and a min-height
// would only add dead space.
const loginRoot = ref(null)
let paneObserver = null

const stabilizePaneHeight = async () => {
    await nextTick()
    const root = loginRoot.value
    if (!root) return
    // `justify-content` puts naive-ui tabs into flex mode, which renders the
    // panes without the pane wrapper — the tab bar + panes live directly on
    // the .n-tabs root, so that is what keeps the stable height.
    const tabsEl = root.querySelector('.n-tabs')
    if (!tabsEl) return
    paneObserver?.disconnect()
    paneObserver = null
    if (!window.matchMedia?.('(min-width: 1024px)').matches) {
        tabsEl.style.minHeight = ''
        return
    }
    // jsdom (vitest) only has naive-ui's ResizeObserver polyfill, whose
    // scheduler throws on DOM mutations; layout measuring is meaningless
    // there anyway.
    if (import.meta.env.MODE === 'test') return
    const pane = [...root.querySelectorAll('.n-tab-pane')].find((p) => p.offsetHeight > 0)
    if (!pane || typeof ResizeObserver === 'undefined') return
    const apply = () => {
        const nav = tabsEl.querySelector('.n-tabs-nav')
        const height = (nav?.offsetHeight || 0) + pane.offsetHeight
        if (height > parseFloat(tabsEl.style.minHeight || '0')) {
            tabsEl.style.minHeight = `${height}px`
        }
    }
    apply()
    paneObserver = new ResizeObserver(apply)
    paneObserver.observe(pane)
}

onMounted(async () => {
    if (!openSettings.value.domains || openSettings.value.domains.length === 0) {
        await api.getOpenSettings(message, notification);
    }
    emailDomain.value = domainsOptions.value ? domainsOptions.value[0]?.value : "";
    initLoginMethod();
    window.addEventListener('resize', stabilizePaneHeight);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', stabilizePaneHeight);
    paneObserver?.disconnect();
});

// The tabs render once the open settings load; measure then, and again when a
// new tab becomes active (its pane may be taller than the first measurement).
watch(() => openSettings.value?.fetched, (fetched) => {
    if (fetched) stabilizePaneHeight()
}, { immediate: true })
watch(tabValue, () => stabilizePaneHeight())
</script>

<template>
    <div ref="loginRoot">
        <n-modal v-model:show="showHelpAbout" preset="card" :title="indexT('about')">
            <About />
        </n-modal>
        <n-alert v-if="userSettings.user_email" :show-icon="false" :bordered="false" closable>
            <span>{{ t('bindUserInfo') }}</span>
        </n-alert>
        <n-tabs v-if="openSettings.fetched" v-model:value="tabValue" size="medium" justify-content="space-evenly">
            <n-tab-pane v-if="showNewAddressTab" name="register" :tab="t('getNewEmail')">
                <n-spin :show="generateNameLoading">
                    <n-form class="login-form">
                        <ul class="muted login-tips">
                            <li v-if="!openSettings.disableCustomAddressName">{{ t("getNewEmailTip1") + addressRegex.source }}</li>
                            <li v-if="!openSettings.disableCustomAddressName">{{ t("getNewEmailTip2") }}</li>
                            <li>{{ t("getNewEmailTip3") }}</li>
                        </ul>
                        <div v-if="!openSettings.disableCustomAddressName" class="toolbar" style="justify-content:flex-end">
                            <n-button @click="generateName" quaternary size="small">
                                {{ t('generateName') }}
                            </n-button>
                        </div>
                        <n-input-group>
                            <n-input-group-label v-if="addressPrefix">
                                {{ addressPrefix }}
                            </n-input-group-label>
                            <n-input v-if="!openSettings.disableCustomAddressName" v-model:value="emailName" show-count
                                :minlength="openSettings.minAddressLen" :maxlength="openSettings.maxAddressLen" />
                            <n-input v-else :value="t('autoGeneratedName')" disabled />
                            <n-input-group-label>@</n-input-group-label>
                            <n-select v-model:value="emailDomain" :consistent-menu-width="false"
                                :options="domainsOptions" />
                        </n-input-group>
                        <n-form-item-row v-if="canUseRandomSubdomain" class="subdomain-options">
                            <div style="width: 100%;">
                                <n-radio-group v-model:value="subdomainMode">
                                    <n-space vertical>
                                        <n-radio value="normal">{{ t('normalSubdomain') }}</n-radio>
                                        <n-radio value="random">{{ t('enableRandomSubdomain') }}</n-radio>
                                        <n-radio value="custom">{{ t('enableCustomSubdomain') }}</n-radio>
                                    </n-space>
                                </n-radio-group>
                                <p v-if="subdomainMode === 'random'" style="margin: 8px 0 0; opacity: 0.75;">
                                    {{ t('randomSubdomainTip') }}
                                </p>
                                <n-input-group v-if="subdomainMode === 'custom'" style="margin-top: 8px;">
                                    <n-input v-model:value="customSubdomain" />
                                    <n-input-group-label>.{{ emailDomain }}</n-input-group-label>
                                </n-input-group>
                            </div>
                        </n-form-item-row>
                        <Turnstile v-model:value="cfToken" />
                        <template v-if="openSettings.enableMailEncryption">
                            <n-checkbox v-model:checked="enableMailEncryption" style="margin-top: 10px;">
                                {{ t('encryptMailCheckbox') }}
                            </n-checkbox>
                            <n-alert v-if="enableMailEncryption" type="warning" :show-icon="false" :bordered="false"
                                style="margin-top: 8px; text-align: left;">
                                {{ t('encryptMailWarning') }}
                            </n-alert>
                        </template>
                        <n-button type="primary" block size="large" @click="newEmail" :loading="loading"
                            :disabled="subdomainMode === 'custom' && !customSubdomain.trim()">
                            <template #icon>
                                <n-icon :component="NewLabelOutlined" />
                            </template>
                            {{ t('getNewEmail') }}
                        </n-button>
                        <div v-if="openSettings.enableRedeemCode" class="redeem-entry-section">
                            <n-text class="muted">{{ t('redeemEntryTip') }}</n-text>
                            <n-button data-testid="redeem-entry-register" secondary size="small"
                                @click="openRedeemPage">
                                <template #icon>
                                    <n-icon :component="RedeemOutlined" />
                                </template>
                                {{ t('useRedeemCode') }}
                            </n-button>
                        </div>
                    </n-form>
                </n-spin>
            </n-tab-pane>
            <n-tab-pane name="signin" :tab="loginAndBindTag">
                <n-form class="login-form">
                    <div v-if="loginMethod === 'password'">
                        <n-form-item-row :label="t('email')" required>
                            <n-input v-model:value="loginAddress" />
                        </n-form-item-row>
                        <n-form-item-row :label="t('password')" required>
                            <n-input v-model:value="loginPassword" type="password" show-password-on="click"
                                @keyup.enter="login" />
                        </n-form-item-row>
                    </div>

                    <div v-else>
                        <n-form-item-row :label="t('credential')" required>
                            <n-input v-model:value="credential" type="textarea" :autosize="{ minRows: 3 }" />
                        </n-form-item-row>
                    </div>

                    <Turnstile ref="loginTurnstileRef" v-if="openSettings.enableGlobalTurnstileCheck"
                        v-model:value="loginCfToken" />

                    <n-button @click="login" :loading="loading" type="primary" block size="large" strong>
                        <template #icon>
                            <n-icon :component="EmailOutlined" />
                        </template>
                        {{ loginAndBindTag }}
                    </n-button>
                    <div class="switch-login-button">
                        <n-button v-if="openSettings?.enableAddressPassword && !openSettings.addressPasswordLoginOnly"
                            @click="loginMethod === 'password' ? loginMethod = 'credential' : loginMethod = 'password'"
                            type="info" quaternary size="tiny">
                            {{ loginMethod === 'password' ? t('credentialLogin') : t('passwordLogin') }}
                        </n-button>
                    </div>
                    <PasskeyMailboxLogin v-if="passkeyLoginVisible" />
                    <n-divider v-if="showNewAddressTab" title-placement="center">
                        <span class="muted">{{ t('or') }}</span>
                    </n-divider>
                    <n-button v-if="showNewAddressTab" @click="tabValue = 'register'" block secondary>
                        <template #icon>
                            <n-icon :component="NewLabelOutlined" />
                        </template>
                        {{ t('getNewEmail') }}
                    </n-button>
                    <div v-if="openSettings.enableRedeemCode" class="redeem-entry-section">
                        <n-text class="muted">{{ t('redeemEntryTip') }}</n-text>
                        <n-button data-testid="redeem-entry" secondary size="small" @click="openRedeemPage">
                            <template #icon>
                                <n-icon :component="RedeemOutlined" />
                            </template>
                            {{ t('useRedeemCode') }}
                        </n-button>
                    </div>
                </n-form>
            </n-tab-pane>
            <n-tab-pane name="help" :tab="t('help')">
                <div class="panel help-panel">
                    <h2 class="panel-title">{{ t('helpTitle') }}</h2>
                    <HowItWorks compact />
                    <template v-if="showUserSystem">
                        <h3 class="panel-title help-panel__passkey-title">{{ t('helpPasskeysTitle') }}</h3>
                        <PasskeyHowItWorks compact />
                    </template>
                    <p v-if="openSettings.enableMailEncryption" class="help-step__text help-enc">
                        <strong>{{ t('helpEncryptedLead') }}</strong> {{ t('helpEncrypted') }}
                    </p>
                    <p v-if="retentionSentences.length > 0" class="muted help-step__text help-retention">
                        {{ retentionSentences.join(' ') }}
                    </p>
                    <p class="muted help-footer">
                        {{ t('helpFooterBefore') }}
                        <n-button v-if="openSettings.enableIndexAbout" text size="tiny" class="help-about-button"
                            @click="showHelpAbout = true">
                            {{ indexT('about') }}
                        </n-button>
                        {{ t('helpFooterAfter') }}
                    </p>
                </div>
                <AdminContact />
            </n-tab-pane>
        </n-tabs>
    </div>
</template>


<style scoped>
.n-alert { margin-bottom: var(--space-3); }
.login-form { display: flex; flex-direction: column; gap: var(--space-3); text-align: left; }
.login-form :deep(.n-form-item-row) { margin-bottom: 0; }
.login-form :deep(.n-divider) { margin: var(--space-1) 0; }
.login-tips { padding-left: 18px; margin: 0 0 12px; }
.subdomain-options { padding: 8px 0 0 2px; }
.redeem-entry-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--app-divider);
}
.redeem-entry-section .muted { min-width: 0; }
.redeem-entry-section .n-button { flex: 0 0 auto; }
.switch-login-button { display: flex; justify-content: center; }

/* Smooth the desktop min-height adjustments (Login.vue grows it when a taller
   pane appears) so the sections below shift instead of jumping. */
.n-tabs {
    transition:
        min-height 250ms ease,
        background-color .3s var(--n-bezier, ease),
        border-color .3s var(--n-bezier, ease);
}

/* Help tab quick-start */
.help-panel { display: flex; flex-direction: column; gap: var(--space-4); text-align: left; }
.help-panel__passkey-title { margin: var(--space-2) 0 0; }
.help-step__text { margin: 0; font-size: var(--font-sm); line-height: 20px; color: var(--app-text-3); }
.help-step__text strong { color: var(--app-text-1); font-weight: 600; }
.help-enc { border-left: 2px solid var(--app-warning); padding-left: var(--space-3); }
.help-enc strong { color: var(--app-warning); }
.help-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    border-top: 1px solid var(--app-divider);
    padding-top: var(--space-4);
}
.help-about-button { font-size: var(--font-sm); }

@media (max-width: 767.98px) {
    .redeem-entry-section { flex-direction: column; align-items: stretch; }
    .redeem-entry-section .n-button { width: 100%; }
}

/* Narrow phones: naive-ui tabs never scroll — overflowing labels are clipped
   by the nav's overflow:hidden. Let long labels wrap onto two centred lines
   and share the row evenly instead, so every tab stays visible and tappable
   at 360px and up. */
@media (max-width: 480px) {
    .n-tabs :deep(.n-tabs-tab-wrapper) {
        flex: 1 1 0;
        min-width: 0;
    }
    .n-tabs :deep(.n-tabs-tab) {
        width: 100%;
        justify-content: center;
        white-space: normal;
        padding-left: var(--space-1);
        padding-right: var(--space-1);
    }
    .n-tabs :deep(.n-tabs-tab__label) {
        display: block;
        text-align: center;
        line-height: 1.3;
    }
}
</style>
