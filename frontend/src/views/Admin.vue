<script setup>
import { computed, onMounted, ref, watchEffect } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'
import { getRouterPathWithLang, hashPassword } from '../utils'
import Turnstile from '../components/Turnstile.vue'

import SenderAccess from './admin/SenderAccess.vue'
import Statistics from "./admin/Statistics.vue"
import SendBox from './admin/SendBox.vue';
import Account from './admin/Account.vue';
import CreateAccount from './admin/CreateAccount.vue';
import AccountSettings from './admin/AccountSettings.vue';
import UserManagement from './admin/UserManagement.vue';
import UserSettings from './admin/UserSettings.vue';
import UserOauth2Settings from './admin/UserOauth2Settings.vue';
import RoleAddressConfig from './admin/RoleAddressConfig.vue';
import Mails from './admin/Mails.vue';
import MailsUnknow from './admin/MailsUnknow.vue';
import Maintenance from './admin/Maintenance.vue';
import DatabaseManager from './admin/DatabaseManager.vue';
import Telegram from './admin/Telegram.vue';
import Webhook from './admin/Webhook.vue';
import MailWebhook from './admin/MailWebhook.vue';
import WorkerConfig from './admin/WorkerConfig.vue';
import IpBlacklistSettings from './admin/IpBlacklistSettings.vue';
import AiExtractSettings from './admin/AiExtractSettings.vue';
import RedeemCodes from './admin/RedeemCodes.vue';

const {
  adminAuth, showAdminAuth, adminTab, loading,
  globalTabplacement, showAdminPage, userSettings,
  openSettings, showUserSystem
} = useGlobalState()
const message = useMessage()
const router = useRouter()

const SendMail = defineAsyncComponent(() => {
  loading.value = true;
  return import('./admin/SendMail.vue')
    .finally(() => loading.value = false);
});

const cfToken = ref('')
const turnstileRef = ref(null)

const authFunc = async () => {
  try {
    await api.fetch('/open_api/admin_login', {
      method: 'POST',
      body: JSON.stringify({
        password: await hashPassword(tmpAdminAuth.value),
        cf_token: cfToken.value
      })
    });
    adminAuth.value = tmpAdminAuth.value;
    location.reload()
  } catch (error) {
    message.error(error.message || "error");
    turnstileRef.value?.refresh?.();
  }
}

const showLogoutModal = ref(false)

const handleLogout = async () => {
  // 清空管理员认证
  adminAuth.value = '';
  // 重置管理员相关状态
  showAdminAuth.value = false;
  adminTab.value = 'account';
  // 显示成功提示并跳转
  message.success(t('logoutSuccess'));
  await router.push(getRouterPathWithLang('/', locale.value));
}

const { t, locale } = useScopedI18n('views.Admin')

const showAdminPasswordModal = computed(() => !showAdminPage.value || showAdminAuth.value)
const tmpAdminAuth = ref('')
// 判断是否通过 admin password 登录（而非用户管理员权限）
const isAdminPasswordLogin = computed(() => !!adminAuth.value)

// 获取当前登录方式
const currentLoginMethod = computed(() => {
  if (adminAuth.value) {
    return t('loginViaPassword');
  } else if (userSettings.value.is_admin) {
    return t('loginViaUserAdmin');
  } else if (openSettings.value.disableAdminPasswordCheck) {
    return t('loginViaDisabledCheck');
  }
  return '';
})

const visibleAdminTabs = computed(() => [
  'qucickSetup', 'account', ...(showUserSystem.value ? ['user'] : []),
  'mails', 'telegram', 'statistics',
  ...(openSettings.value.enableRedeemCode ? ['redeemCodes'] : []),
  'maintenance', 'adminAccount'
])
watchEffect(() => {
  if (!openSettings.value.fetched) return
  if (!visibleAdminTabs.value.includes(adminTab.value)) adminTab.value = 'account'
})

onMounted(async () => {
  // make sure openSettings is fetched for turnstile check
  if (!openSettings.value.fetched) await api.getOpenSettings(message);
  // make sure user_id is fetched
  if (!userSettings.value.user_id) await api.getUserSettings(message);
})
</script>

<template>
  <div v-if="openSettings.fetched && userSettings.fetched">
    <n-modal v-model:show="showAdminPasswordModal" :closable="false" :closeOnEsc="false" :maskClosable="false"
      preset="dialog" :title="t('accessHeader')">
      <p>{{ t('accessTip') }}</p>
      <n-input v-model:value="tmpAdminAuth" type="password" show-password-on="click" @keyup.enter="authFunc" />
      <Turnstile ref="turnstileRef" v-if="openSettings.enableGlobalTurnstileCheck" v-model:value="cfToken" />
      <template #action>
        <n-button @click="authFunc" type="primary" :loading="loading">
          {{ t('ok') }}
        </n-button>
      </template>
    </n-modal>
    <n-tabs v-if="showAdminPage" type="line" size="medium" v-model:value="adminTab" :placement="globalTabplacement">
      <n-tab-pane name="qucickSetup" :tab="t('qucickSetup')">
        <n-tabs key="quick-setup-tabs" type="bar" size="small" animated>
          <n-tab-pane name="database" :tab="t('database')">
            <DatabaseManager />
          </n-tab-pane>
          <n-tab-pane name="account_settings" :tab="t('mailbox_settings')">
            <AccountSettings />
          </n-tab-pane>
          <n-tab-pane v-if="showUserSystem" name="user_settings" :tab="t('user_settings')">
            <UserSettings />
          </n-tab-pane>
          <n-tab-pane name="workerconfig" :tab="t('workerconfig')">
            <WorkerConfig />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="account" :tab="t('mailbox_management')">
        <n-tabs key="account-tabs" type="bar" size="small" animated>
          <n-tab-pane name="account" :tab="t('mailbox_list')">
            <Account />
          </n-tab-pane>
          <n-tab-pane name="account_create" :tab="t('mailbox_create')">
            <CreateAccount />
          </n-tab-pane>
          <n-tab-pane name="account_settings" :tab="t('mailbox_settings')">
            <AccountSettings />
          </n-tab-pane>
          <n-tab-pane name="senderAccess" :tab="t('senderAccess')">
            <SenderAccess />
          </n-tab-pane>
          <n-tab-pane name="ipBlacklistSettings" :tab="t('ipBlacklistSettings')">
            <IpBlacklistSettings />
          </n-tab-pane>
          <n-tab-pane name="aiExtractSettings" :tab="t('aiExtractSettings')">
            <AiExtractSettings />
          </n-tab-pane>
          <n-tab-pane name="webhook" :tab="t('webhookSettings')">
            <Webhook />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane v-if="showUserSystem" name="user" :tab="t('user')">
        <n-tabs key="user-tabs" type="bar" size="small" animated>
          <n-tab-pane name="user_management" :tab="t('user_management')">
            <UserManagement />
          </n-tab-pane>
          <n-tab-pane name="user_settings" :tab="t('user_settings')">
            <UserSettings />
          </n-tab-pane>
          <n-tab-pane name="userOauth2Settings" :tab="t('userOauth2Settings')">
            <UserOauth2Settings />
          </n-tab-pane>
          <n-tab-pane name="roleAddressConfig" :tab="t('roleAddressConfig')">
            <RoleAddressConfig />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="mails" :tab="t('mails')">
        <n-tabs key="mails-tabs" type="bar" size="small" animated>
          <n-tab-pane name="mails" :tab="t('mails')">
            <Mails />
          </n-tab-pane>
          <n-tab-pane name="unknow" :tab="t('unknow')">
            <MailsUnknow />
          </n-tab-pane>
          <n-tab-pane name="sendBox" :tab="t('sendBox')">
            <SendBox />
          </n-tab-pane>
          <n-tab-pane name="sendMail" :tab="t('sendMail')">
            <SendMail />
          </n-tab-pane>
          <n-tab-pane name="mailWebhook" :tab="t('mailWebhook')">
            <MailWebhook />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="telegram" :tab="t('telegram')">
        <Telegram />
      </n-tab-pane>
      <n-tab-pane name="statistics" :tab="t('statistics')">
        <Statistics />
      </n-tab-pane>
      <n-tab-pane v-if="openSettings.enableRedeemCode" name="redeemCodes" :tab="t('redeemCodes')">
        <RedeemCodes />
      </n-tab-pane>
      <n-tab-pane name="maintenance" :tab="t('maintenance')">
        <n-tabs key="maintenance-tabs" type="bar" size="small" animated>
          <n-tab-pane name="database" :tab="t('database')">
            <DatabaseManager />
          </n-tab-pane>
          <n-tab-pane name="workerconfig" :tab="t('workerconfig')">
            <WorkerConfig />
          </n-tab-pane>
          <n-tab-pane name="maintenance" :tab="t('maintenance')">
            <Maintenance />
          </n-tab-pane>
        </n-tabs>
      </n-tab-pane>
      <n-tab-pane name="adminAccount" :tab="t('adminAccount')">
        <section class="panel settings-section admin-account-panel">
          <h3 class="panel-title settings-section__header">{{ t('adminAccount') }}</h3>
          <div class="settings-row">
            <span class="settings-row__text">{{ t('loginMethod') }}</span>
            <span class="settings-row__action">{{ currentLoginMethod }}</span>
          </div>
          <div v-if="isAdminPasswordLogin" class="settings-row">
            <span class="settings-row__text">{{ t('logout') }}</span>
            <div class="settings-row__action">
              <n-button type="warning" secondary @click="showLogoutModal = true">{{ t('logout') }}</n-button>
            </div>
          </div>
        </section>
      </n-tab-pane>
    </n-tabs>
    <n-modal v-model:show="showLogoutModal" preset="dialog" :title="t('logoutConfirmTitle')">
      <p>{{ t('logoutConfirmContent') }}</p>
      <template #action>
        <n-button :loading="loading" @click="handleLogout" size="small" tertiary type="warning">
          {{ t('confirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.n-pagination {
  margin-top: 10px;
  margin-bottom: 10px;
}
.admin-account-panel { max-width: var(--content-form); text-align: left; }
</style>
