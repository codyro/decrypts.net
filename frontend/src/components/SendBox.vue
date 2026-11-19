<script setup>
import { watch, onMounted, ref, computed } from "vue";
import { useMessage } from 'naive-ui'
import { LockOutlined } from '@vicons/material'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import { useIsMobile } from '../utils/composables'
import { utcToLocalDate } from '../utils';
import { isEncryptedRow, decryptMail } from '../utils/mail-crypto'
import { getPrivateKeys } from '../utils/mail-key-store'
import { SendRound, RefreshRound } from '@vicons/material'

const message = useMessage()
const isMobile = useIsMobile()

const props = defineProps({
  enableUserDeleteEmail: {
    type: Boolean,
    default: false,
    required: false
  },
  showEMailFrom: {
    type: Boolean,
    default: false
  },
  fetchMailData: {
    type: Function,
    default: () => { },
    required: true
  },
  deleteMail: {
    type: Function,
    default: () => { },
    required: false
  },
})

const { isDark, mailboxSplitSize, loading, useUTCDate } = useGlobalState()
const data = ref([])

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const curMail = ref(null);
const showCode = ref(false)

const multiActionMode = ref(false)
const showMultiActionDelete = ref(false)
const multiActionDeleteProgress = ref({ percentage: 0, tip: '0/0' })

const { t } = useScopedI18n('components.SendBox')
const { t: rt } = useScopedI18n('components.MailContentRenderer')

// Map a parsed sendbox JSON body onto the row, exactly like the plaintext
// path does. The decrypted content of an encrypted row is the same JSON
// string the plaintext path stores.
const applySendboxJson = (item, data) => {
  if (data.version == "v2") {
    item.to_mail = data.to_name ? `${data.to_name} <${data.to_mail}>` : data.to_mail;
    item.subject = data.subject;
    item.is_html = data.is_html;
    item.content = data.content;
    item.raw = JSON.stringify(data, null, 2);
  } else {
    item.to_mail = data?.personalizations?.map(
      (p) => p.to?.map((t) => t.email).join(',')
    ).join(';');
    item.subject = data.subject;
    item.is_html = (data.content[0]?.type != 'text/plain');
    item.content = data.content[0]?.value;
    item.raw = JSON.stringify(data, null, 2);
  }
}

const lockHintFor = (row) => row.lockReason === 'decrypt_failed'
  ? rt('lockedDecryptFailed')
  : rt('lockedMissingKey')

/**
 * Decrypt an encrypted sendbox raw in place when possible. On success the
 * row renders exactly like a plaintext row; on missing key / decrypt
 * failure the row is marked locked and the encrypted envelope never leaks
 * into any display field.
 */
const decryptSendboxItemIfNeeded = async (item) => {
  // The explicit is_encrypted flag is authoritative on migrated databases;
  // only fall back to the "cfte1." prefix check when it is absent.
  if (!isEncryptedRow(item)) return false;
  item.encrypted = true;
  const keys = getPrivateKeys(item.address);
  let decrypted = null;
  for (const key of keys) {
    try {
      decrypted = await decryptMail(key, item.raw);
      break;
    } catch {
      // try the next stored key (rotation may have left several)
    }
  }
  if (decrypted !== null) {
    try {
      applySendboxJson(item, JSON.parse(decrypted));
      delete item.locked;
      delete item.lockReason;
      return true;
    } catch (error) {
      console.log(error);
      // decrypted content is not a sendbox JSON: fall through to locked so
      // it is never displayed as a sendbox row.
    }
  }
  item.locked = true;
  item.lockReason = keys.length > 0 ? 'decrypt_failed' : 'missing_key';
  item.subject = lockHintFor(item);
  item.to_mail = '';
  item.is_html = false;
  item.content = '';
  return true;
}

const parseSendboxItem = async (item) => {
  if (await decryptSendboxItemIfNeeded(item)) {
    return item;
  }
  try {
    applySendboxJson(item, JSON.parse(item.raw));
  } catch (error) {
    console.log(error);
  }
  return item;
}

watch([page, pageSize], async ([page, pageSize], [oldPage, oldPageSize]) => {
  if (page !== oldPage || pageSize !== oldPageSize) {
    await refresh();
  }
})

const refresh = async () => {
  try {
    const { results, count: totalCount } = await props.fetchMailData(
      pageSize.value, (page.value - 1) * pageSize.value
    );
    data.value = await Promise.all(results.map((item) => parseSendboxItem(item)));
    if (totalCount > 0) {
      count.value = totalCount;
    }
    if (!isMobile.value && !curMail.value && data.value.length > 0) {
      curMail.value = data.value[0];
    }
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
  }
};

const clickRow = async (row) => {
  curMail.value = row;
};

const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (isDark.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
};

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
}

const deleteMail = async () => {
  try {
    await props.deleteMail(curMail.value.id);
    message.success(t("success"));
    curMail.value = null;
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  }
};

const showMultiActionMode = computed(() => {
  return props.enableUserDeleteEmail;
});

const multiActionModeClick = (enableMulti) => {
  if (enableMulti) {
    data.value.forEach((item) => {
      item.checked = false;
    });
    multiActionMode.value = true;
  } else {
    multiActionMode.value = false;
    data.value.forEach((item) => {
      item.checked = false;
    });
  }
}

const multiActionSelectAll = (checked) => {
  data.value.forEach((item) => {
    item.checked = checked;
  });
}

const multiActionDeleteMail = async () => {
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    multiActionDeleteProgress.value = {
      percentage: 0,
      tip: `0/${selectedMails.length}`
    };
    for (const [index, mail] of selectedMails.entries()) {
      await props.deleteMail(mail.id);
      showMultiActionDelete.value = true;
      multiActionDeleteProgress.value = {
        percentage: Math.floor((index + 1) / selectedMails.length * 100),
        tip: `${index + 1}/${selectedMails.length}`
      };
    }
    message.success(t("success"));
    await refresh();
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
    showMultiActionDelete.value = true;
  }
}

onMounted(async () => {
  await refresh();
});
</script>

<template>
  <div>
    <div v-if="!isMobile" class="left">
      <div class="toolbar sent-toolbar">
        <template v-if="multiActionMode">
          <n-button @click="multiActionModeClick(false)" quaternary size="small">{{ t('cancelMultiAction') }}</n-button>
          <n-button @click="multiActionSelectAll(true)" quaternary size="small">{{ t('selectAll') }}</n-button>
          <n-button @click="multiActionSelectAll(false)" quaternary size="small">{{ t('unselectAll') }}</n-button>
          <div class="toolbar__spacer" />
          <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="multiActionDeleteMail">
            <template #trigger><n-button tertiary type="error" size="small">{{ t('delete') }}</n-button></template>
            {{ t('deleteMailTip') }}
          </n-popconfirm>
        </template>
        <template v-else>
          <n-button v-if="showMultiActionMode" @click="multiActionModeClick(true)" quaternary size="small">{{ t('multiAction') }}</n-button>
          <n-button @click="refresh" quaternary size="small">
            <template #icon><n-icon :component="RefreshRound" /></template>{{ t('refresh') }}
          </n-button>
          <div class="toolbar__spacer" />
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count"
            :page-sizes="[20, 50, 100]" show-size-picker size="small" />
        </template>
      </div>
      <div v-if="data.length === 0" class="empty-state">
        <n-icon class="empty-state__icon" :component="SendRound" />
        <h3 class="empty-state__title">{{ t('emptySent') }}</h3>
      </div>
      <n-split v-else direction="horizontal" :max="0.75" :min="0" :resize-trigger-size="8"
        :default-size="mailboxSplitSize" :on-update:size="onSpiltSizeChange">
        <template #resize-trigger><div class="split-handle"><div class="split-handle__grip" /></div></template>
        <template #1>
          <div class="sent-list-scroll sent-list-column">
            <n-list hoverable clickable>
              <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)" :class="mailItemClass(row)">
                <template #prefix v-if="multiActionMode"><n-checkbox v-model:checked="row.checked" /></template>
                <n-thing :title="row.locked ? lockHintFor(row) : row.subject">
                  <template #description>
                    <n-text depth="3" class="sent-meta">
                      <n-icon v-if="row.locked" :component="LockOutlined" class="sent-lock" />
                      <template v-if="showEMailFrom">{{ rt('from') }} {{ row.address }} · </template>{{ rt('to') }} {{ row.to_mail }} · {{ utcToLocalDate(row.created_at, useUTCDate) }}
                    </n-text>
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </div>
        </template>
        <template #2>
          <n-card :bordered="false" v-if="curMail" class="mail-item" :title="curMail.subject"
            style="overflow: auto; max-height: calc(100vh - 180px);">
            <div class="mail-details">
              <div class="mail-address"><span class="mail-address-label">{{ rt('from') }}</span><span>{{ curMail.address }}</span></div>
              <div class="mail-address"><span class="mail-address-label">{{ rt('to') }}</span><span>{{ curMail.to_mail }}</span></div>
              <div class="muted sent-detail-footer">{{ utcToLocalDate(curMail.created_at, useUTCDate) }} · #{{ curMail.id }}</div>
            </div>
            <div class="toolbar sent-detail-actions">
              <n-button v-if="!curMail.locked" size="small" quaternary @click="showCode = !showCode">{{ t('showCode') }}</n-button>
              <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="deleteMail">
                <template #trigger><n-button quaternary type="error" size="small">{{ t('delete') }}</n-button></template>
                {{ t('deleteMailTip') }}
              </n-popconfirm>
            </div>
            <n-alert v-if="curMail.locked" type="warning" :show-icon="false" :bordered="false" class="mail-locked-banner">
              <n-space align="center" :size="6">
                <n-icon :component="LockOutlined" />
                <span>{{ lockHintFor(curMail) }}</span>
              </n-space>
            </n-alert>
            <template v-else>
              <pre v-if="showCode">{{ curMail.raw }}</pre>
              <pre v-else-if="!curMail.is_html">{{ curMail.content }}</pre>
              <div v-else v-html="curMail.content"></div>
            </template>
          </n-card>
          <div v-else class="empty-state">
            <n-icon class="empty-state__icon" :component="SendRound" />
            <h3 class="empty-state__title">{{ t('pleaseSelectMail') }}</h3>
          </div>
        </template>
      </n-split>
    </div>
    <div class="left" v-else>
      <div class="toolbar sent-toolbar">
        <n-button @click="refresh" quaternary size="small">
          <template #icon><n-icon :component="RefreshRound" /></template>{{ t('refresh') }}
        </n-button>
        <div class="toolbar__spacer" />
        <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="small" />
      </div>
      <div v-if="data.length === 0" class="empty-state">
        <n-icon class="empty-state__icon" :component="SendRound" />
        <h3 class="empty-state__title">{{ t('emptySent') }}</h3>
      </div>
      <div v-else class="sent-list-scroll">
        <n-list hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)">
            <n-thing :title="row.locked ? lockHintFor(row) : row.subject">
              <template #description>
                <n-text depth="3" class="sent-meta">
                  <n-icon v-if="row.locked" :component="LockOutlined" class="sent-lock" />
                  <template v-if="showEMailFrom">{{ rt('from') }} {{ row.address }} · </template>{{ rt('to') }} {{ row.to_mail }} · {{ utcToLocalDate(row.created_at, useUTCDate) }}
                </n-text>
              </template>
            </n-thing>
          </n-list-item>
        </n-list>
      </div>
      <n-drawer v-model:show="curMail" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
        style="height: 92vh; border-radius: 12px 12px 0 0;">
        <n-drawer-content :title="curMail ? curMail.subject : ''" closable>
          <div v-if="curMail" class="sent-mobile-detail">
            <div class="mail-details">
              <div class="mail-address"><span class="mail-address-label">{{ rt('from') }}</span><span>{{ curMail.address }}</span></div>
              <div class="mail-address"><span class="mail-address-label">{{ rt('to') }}</span><span>{{ curMail.to_mail }}</span></div>
              <div class="muted sent-detail-footer">{{ utcToLocalDate(curMail.created_at, useUTCDate) }} · #{{ curMail.id }}</div>
            </div>
            <div class="toolbar sent-detail-actions">
              <n-button v-if="!curMail.locked" size="small" quaternary @click="showCode = !showCode">{{ t('showCode') }}</n-button>
              <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="deleteMail">
                <template #trigger><n-button quaternary type="error" size="small">{{ t('delete') }}</n-button></template>
                {{ t('deleteMailTip') }}
              </n-popconfirm>
            </div>
            <n-alert v-if="curMail.locked" type="warning" :show-icon="false" :bordered="false" class="mail-locked-banner">
              <n-space align="center" :size="6">
                <n-icon :component="LockOutlined" />
                <span>{{ lockHintFor(curMail) }}</span>
              </n-space>
            </n-alert>
            <template v-else>
              <pre v-if="showCode">{{ curMail.raw }}</pre>
              <pre v-else-if="!curMail.is_html">{{ curMail.content }}</pre>
              <div v-else v-html="curMail.content"></div>
            </template>
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>
  </div>
</template>

<style scoped>
.left {
  text-align: left;
}

.center {
  text-align: center;
}

.overlay {
  width: 100%;
  height: 100%;
  z-index: 1000;
}

.overlay-dark-backgroud {
  background-color: rgba(255, 255, 255, 0.1);
}

.overlay-light-backgroud {
  background-color: rgba(0, 0, 0, 0.1);
}

.sent-toolbar { margin-bottom: var(--space-3); }
.sent-list-scroll { overflow: auto; min-height: 420px; max-height: calc(100vh - 220px); }
.sent-list-column { border-right: 1px solid var(--app-divider); }
.sent-list-scroll :deep(.n-list-item.overlay) { box-shadow: inset 3px 0 0 var(--app-accent); }
.sent-meta { display: block; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.sent-lock { vertical-align: -2px; margin-right: 4px; }
.mail-details { padding-bottom: 12px; border-bottom: 1px solid var(--app-divider); font-size: 13px; }
.mail-address { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; overflow-wrap: anywhere; }
.mail-address-label { color: var(--app-text-3); font-size: 11px; }
.sent-detail-footer { margin-top: 6px; }
.sent-detail-actions { padding: 4px 0 var(--space-3); border-bottom: 1px solid var(--app-divider); }
.sent-mobile-detail { min-width: 0; }

.mail-item {
  height: 100%;
}

pre {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.split-handle {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.split-handle__grip {
  width: 1px;
  height: 100%;
  background-color: var(--app-divider);
  transition: width 0.2s, background-color 0.2s;
}

.split-handle:hover .split-handle__grip {
  width: 3px;
  background-color: var(--app-accent);
}

@media (max-width: 767.98px) {
  .sent-list-scroll { min-height: 0; max-height: none; overflow: visible; }
}
</style>
