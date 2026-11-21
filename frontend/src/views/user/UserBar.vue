<script setup>
import { computed, onMounted } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../../store'
import { api } from '../../api'
import { isPasskeyPseudoEmail } from '../../utils/passkey-account'
import UserLogin from './UserLogin.vue'

const message = useMessage()
const { userSettings, userJwt, userTab } = useGlobalState()
const { t } = useScopedI18n('views.user.UserBar')
const { t: headerT } = useScopedI18n('views.Header')

// Passkey-only accounts have a server-generated pk-*@passkey.invalid
// pseudo-email; show a "Passkey account" label instead of the address.
const displayEmail = computed(() =>
    isPasskeyPseudoEmail(userSettings.value.user_email)
        ? t('passkeyAccount')
        : userSettings.value.user_email
);

onMounted(async () => {
    await api.getUserOpenSettings(message);
    if (!userSettings.value.user_id) await api.getUserSettings(message);
    // Right after a passkey sign-up, land on the account settings tab so the
    // "add a second passkey" nudge is seen.
    if (sessionStorage.getItem('passkeySignupFresh') === '1'
        && isPasskeyPseudoEmail(userSettings.value.user_email)
    ) {
        sessionStorage.removeItem('passkeySignupFresh');
        userTab.value = 'user_settings';
    }
});
</script>

<template>
    <div>
        <div class="panel user-loading" v-if="!userSettings.fetched"><n-skeleton style="height: 80px" /></div>
        <div v-else-if="userSettings.user_email" class="account-bar">
            <div class="account-bar__avatar">{{ displayEmail[0].toUpperCase() }}</div>
            <div class="account-bar__text">
                <span class="caption">{{ t('currentUser') }}</span>
                <span class="account-bar__email">{{ displayEmail }}</span>
            </div>
        </div>
        <section v-else class="user-landing">
            <h1 class="page-title">{{ headerT('userCenter') }}</h1>
            <div class="panel user-landing__panel">
                <n-alert v-if="userJwt" type="warning" :show-icon="false" :bordered="false" closable>
                    <span>{{ t('fetchUserSettingsError') }}</span>
                </n-alert>
                <UserLogin />
            </div>
        </section>
    </div>
</template>

<style scoped>
.user-loading { height: 120px; }
.account-bar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
.account-bar__avatar {
    display: grid;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 50%;
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-weight: 600;
}
.account-bar__text { display: flex; flex-direction: column; min-width: 0; }
.account-bar__email { overflow: hidden; color: var(--app-text-1); font-size: 15px; font-weight: 600; text-overflow: ellipsis; }
.user-landing { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding-top: var(--space-8); text-align: center; }
.user-landing__panel { width: min(var(--content-auth), 100%); text-align: left; }
.user-landing__panel .n-alert { margin-bottom: var(--space-3); }
@media (max-width: 767.98px) { .user-landing { padding-top: var(--space-4); } }
</style>
