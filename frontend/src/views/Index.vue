<script setup>
import { computed, defineAsyncComponent, onMounted, watch, watchEffect } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useRoute } from 'vue-router'

import { useGlobalState } from '../store'
import { api } from '../api'

import AddressBar from './index/AddressBar.vue';
import MailBox from '../components/MailBox.vue';
import SendBox from '../components/SendBox.vue';
import AutoReply from './index/AutoReply.vue';
import AccountSettings from './index/AccountSettings.vue';
import Webhook from './index/Webhook.vue';
import Attachment from './index/Attachment.vue';
import SimpleIndex from './index/SimpleIndex.vue';

const { loading, settings, openSettings, indexTab, globalTabplacement, useSimpleIndex } = useGlobalState()
const message = useMessage()
const route = useRoute()

const SendMail = defineAsyncComponent(() => {
  loading.value = true;
  return import('./index/SendMail.vue')
    .finally(() => loading.value = false);
});

const { t } = useScopedI18n('views.Index')

const visibleIndexTabs = computed(() => [
  'mailbox',
  ...(openSettings.value.enableSendMail ? ['sendbox', 'sendmail'] : []),
  'accountSettings',
  ...(openSettings.value.enableWebhook ? ['webhook'] : []),
])
const LEGACY_INDEX_TABS = { auto_reply: 'accountSettings', s3_attachment: 'accountSettings', appearance: 'mailbox', about: 'mailbox' }
watchEffect(() => {
  if (!openSettings.value.fetched) return
  if (!visibleIndexTabs.value.includes(indexTab.value)) {
    indexTab.value = LEGACY_INDEX_TABS[indexTab.value] ?? 'mailbox'
  }
})

const fetchMailData = async (limit, offset) => {
  if (mailIdQuery.value > 0) {
    const singleMail = await api.fetch(`/api/mail/${mailIdQuery.value}`);
    if (singleMail) return { results: [singleMail], count: 1 };
    return { results: [], count: 0 };
  }
  return await api.fetch(`/api/mails?limit=${limit}&offset=${offset}`);
};

const deleteMail = async (curMailId) => {
  await api.fetch(`/api/mails/${curMailId}`, { method: 'DELETE' });
};

const updateMailReadStatus = async (id, isUnread) => {
  await api.fetch(`/api/mails/${id}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ isUnread }),
    showLoading: false
  })
}

const deleteSenboxMail = async (curMailId) => {
  await api.fetch(`/api/sendbox/${curMailId}`, { method: 'DELETE' });
};

const fetchSenboxData = async (limit, offset) => {
  return await api.fetch(`/api/sendbox?limit=${limit}&offset=${offset}`);
};

const saveToS3 = async (mail_id, filename, blob) => {
  try {
    const { url } = await api.fetch(`/api/attachment/put_url`, {
      method: 'POST',
      body: JSON.stringify({ key: `${mail_id}/${filename}` })
    });
    // upload to s3 by formdata
    const formData = new FormData();
    formData.append(filename, blob);
    await fetch(url, {
      method: 'PUT',
      body: formData
    });
    message.success(t('saveToS3Success'));
  } catch (error) {
    console.error(error);
    message.error(error.message || "save to s3 error");
  }
}

const mailBoxKey = ref("")
const mailIdQuery = ref("")
const showMailIdQuery = ref(false)

const queryMail = () => {
  mailBoxKey.value = Date.now();
}

watch(route, () => {
  if (!route.query.mail_id) {
    showMailIdQuery.value = false;
    mailIdQuery.value = "";
    queryMail();
  }
})

onMounted(() => {
  if (route.query.mail_id) {
    showMailIdQuery.value = true;
    mailIdQuery.value = route.query.mail_id;
    queryMail();
  }
})
</script>

<template>
  <div>
    <div v-if="useSimpleIndex">
      <SimpleIndex />
    </div>
    <div v-else>
      <AddressBar />
      <n-tabs v-if="settings.address" type="line" size="medium" v-model:value="indexTab" :placement="globalTabplacement" class="mailbox-tabs">
        <n-tab-pane name="mailbox" :tab="t('inbox')">
          <div v-if="showMailIdQuery" class="toolbar mail-id-query">
            <n-input-group>
              <n-input v-model:value="mailIdQuery" style="max-width: 280px" />
              <n-button @click="queryMail" secondary>
                {{ t('query') }}
              </n-button>
            </n-input-group>
          </div>
          <MailBox :key="mailBoxKey" :showEMailTo="false" :showReply="openSettings.enableSendMail" :showSaveS3="openSettings.isS3Enabled"
            :saveToS3="saveToS3" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
            :fetchMailData="fetchMailData" :deleteMail="deleteMail" :showFilterInput="true"
            :enableMailReadStatus="openSettings.enableMailReadStatus" :updateMailReadStatus="updateMailReadStatus" />
        </n-tab-pane>
        <n-tab-pane v-if="openSettings.enableSendMail" name="sendbox" :tab="t('sendbox')">
          <SendBox :fetchMailData="fetchSenboxData" :enableUserDeleteEmail="openSettings.enableUserDeleteEmail"
            :deleteMail="deleteSenboxMail" />
        </n-tab-pane>
        <n-tab-pane v-if="openSettings.enableSendMail" name="sendmail" :tab="t('sendmail')">
          <SendMail />
        </n-tab-pane>
        <n-tab-pane name="accountSettings" :tab="t('mailboxSettings')">
          <AccountSettings>
            <template #extra>
              <n-collapse v-if="openSettings.enableAutoReply || openSettings.isS3Enabled" display-directive="if" class="settings-collapse">
                <n-collapse-item v-if="openSettings.enableAutoReply" name="auto_reply" :title="t('auto_reply')">
                  <AutoReply />
                </n-collapse-item>
                <n-collapse-item v-if="openSettings.isS3Enabled" name="s3_attachment" :title="t('s3Attachment')">
                  <Attachment />
                </n-collapse-item>
              </n-collapse>
            </template>
          </AccountSettings>
        </n-tab-pane>
        <n-tab-pane v-if="openSettings.enableWebhook" name="webhook" :tab="t('webhookSettings')">
          <Webhook />
        </n-tab-pane>
      </n-tabs>
    </div>
  </div>
</template>

<style scoped>
.mail-id-query { margin-bottom: var(--space-3); }
.settings-collapse {
  max-width: var(--content-form);
  padding: var(--space-2) var(--space-6) var(--space-5);
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--radius-lg);
}
@media (max-width: 767.98px) {
  .settings-collapse { padding-inline: var(--space-4); }
}
</style>
