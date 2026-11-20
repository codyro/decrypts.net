<script setup>
import { watch, onMounted, ref, onBeforeUnmount, computed } from "vue";
import { useMessage, useThemeVars } from 'naive-ui'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'
import { CloudDownloadRound, ArrowBackIosNewFilled, ArrowForwardIosFilled, InboxRound, CheckBoxOutlined, RefreshRound, SearchRound } from '@vicons/material'
import { useIsMobile } from '../utils/composables'
import { processItem } from '../utils/email-parser'
import { MAIL_KEYS_IMPORTED_EVENT } from '../utils/key-backup-prompts'
import { buildReplyModel, buildForwardModel } from '../utils/mail-actions'
import MailContentRenderer from "./MailContentRenderer.vue";
import MailSummary from "./MailSummary.vue";

const message = useMessage()
const themeVars = useThemeVars()
const isMobile = useIsMobile()

const props = defineProps({
  enableUserDeleteEmail: {
    type: Boolean,
    default: false,
    required: false
  },
  showEMailTo: {
    type: Boolean,
    default: true,
    required: false
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
  showReply: {
    type: Boolean,
    default: false,
    required: false
  },
  showSaveS3: {
    type: Boolean,
    default: false,
    required: false
  },
  saveToS3: {
    type: Function,
    default: (mail_id, filename, blob) => { },
    required: false
  },
  showFilterInput: {
    type: Boolean,
    default: false,
    required: false
  },
  enableMailReadStatus: {
    type: Boolean,
    default: false
  },
  updateMailReadStatus: {
    type: Function,
    default: () => { }
  },
})

const localFilterKeyword = ref('')

const {
  isDark, mailboxSplitSize, mailListView, mailListPreviewLineClamp, indexTab, loading,
  autoRefresh, configAutoRefreshInterval, sendMailModel
} = useGlobalState()
const autoRefreshInterval = ref(configAutoRefreshInterval.value)
const rawData = ref([])
const loaded = ref(false)
const timer = ref(null)

const count = ref(0)
const page = ref(1)
const pageSize = ref(20)

const mailListPreviewLineClampValue = computed(() => {
  const value = Number(mailListPreviewLineClamp.value)
  if (!Number.isFinite(value)) return 0
  return Math.min(5, Math.max(0, Math.round(value)))
})

// Computed property for filtered data (only filter current page)
const data = computed(() => {
  if (!localFilterKeyword.value || localFilterKeyword.value.trim() === '') {
    return rawData.value;
  }
  const keyword = localFilterKeyword.value.toLowerCase();
  return rawData.value.filter(mail => {
    // Search in subject, text, message fields
    const searchFields = [
      mail.subject || '',
      mail.text || '',
      mail.message || ''
    ].map(field => field.toLowerCase());
    return searchFields.some(field => field.includes(keyword));
  });
})

const openMail = (mail) => {
  curMail.value = mail
  if (mail?.is_unread !== 1 || !props.enableMailReadStatus) return
  mail.is_unread = 0
  void props.updateMailReadStatus(mail.id, false).catch(() => {
    mail.is_unread = 1
  })
}

const toggleCurrentMailUnread = async () => {
  if (!curMail.value || !props.enableMailReadStatus) return
  const mail = curMail.value
  const previousValue = mail.is_unread
  const isUnread = previousValue !== 1
  mail.is_unread = isUnread ? 1 : 0
  try {
    await props.updateMailReadStatus(mail.id, isUnread)
    message.success(t("success"))
  } catch {
    mail.is_unread = previousValue
  }
}

const canGoPrevMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex > 0 || page.value > 1
})

const canGoNextMail = computed(() => {
  if (!curMail.value) return false
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)
  return currentIndex < data.value.length - 1 || count.value > page.value * pageSize.value
})

const prevMail = async () => {
  if (!canGoPrevMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex > 0) {
    openMail(data.value[currentIndex - 1])
  } else if (page.value > 1) {
    page.value--
    const refreshed = await refresh()
    if (refreshed && data.value.length > 0) {
      openMail(data.value[data.value.length - 1])
    }
  }
}

const nextMail = async () => {
  if (!canGoNextMail.value) return
  const currentIndex = data.value.findIndex(mail => mail.id === curMail.value.id)

  if (currentIndex < data.value.length - 1) {
    openMail(data.value[currentIndex + 1])
  } else if (count.value > page.value * pageSize.value) {
    page.value++
    const refreshed = await refresh()
    if (refreshed && data.value.length > 0) {
      openMail(data.value[0])
    }
  }
}

const curMail = ref(null);

const multiActionMode = ref(false)
const showMultiActionDownload = ref(false)
const showMultiActionDelete = ref(false)
const multiActionDownloadZip = ref({})
const multiActionDeleteProgress = ref({ percentage: 0, tip: '0/0' })

const { t } = useScopedI18n('components.MailBox')

const setupAutoRefresh = async (autoRefresh) => {
  // auto refresh every configAutoRefreshInterval seconds
  autoRefreshInterval.value = configAutoRefreshInterval.value;
  if (autoRefresh) {
    clearInterval(timer.value);
    timer.value = setInterval(async () => {
      if (loading.value) return;
      autoRefreshInterval.value--;
      if (autoRefreshInterval.value <= 0) {
        autoRefreshInterval.value = configAutoRefreshInterval.value;
        await backFirstPageAndRefresh();
      }
    }, 1000)
  } else {
    clearInterval(timer.value)
    timer.value = null
  }
}

watch(autoRefresh, async (autoRefresh, old) => {
  setupAutoRefresh(autoRefresh)
}, { immediate: true })

let loadedPage = { page: page.value, pageSize: pageSize.value }
let requestedPage = null
watch([page, pageSize], async ([page, pageSize]) => {
  if (requestedPage?.page === page && requestedPage.pageSize === pageSize) return
  if (loadedPage.page !== page || loadedPage.pageSize !== pageSize) {
    await refresh();
  }
})

const refresh = async () => {
  const pagination = { page: page.value, pageSize: pageSize.value }
  requestedPage = pagination
  try {
    const { results, count: totalCount } = await props.fetchMailData(
      pagination.pageSize, (pagination.page - 1) * pagination.pageSize
    );
    loading.value = true;
    rawData.value = await Promise.all(results.map(async (item) => {
      item.checked = false;
      return await processItem(item);
    }));
    loadedPage = pagination
    if (totalCount > 0) {
      count.value = totalCount;
    }
    curMail.value = null;
    if (!isMobile.value && !mailListView.value && data.value.length > 0) {
      curMail.value = data.value[0];
    }
    return true
  } catch (error) {
    message.error(error.message || "error");
    console.error(error);
    if (requestedPage === pagination && page.value === pagination.page && pageSize.value === pagination.pageSize) {
      page.value = loadedPage.page
      pageSize.value = loadedPage.pageSize
    }
  } finally {
    if (requestedPage === pagination) requestedPage = null
    loading.value = false;
    loaded.value = true;
  }
};

const backFirstPageAndRefresh = async () => {
  page.value = 1;
  await refresh();
}

const clickRow = (row) => {
  if (multiActionMode.value) {
    row.checked = !row.checked;
    curMail.value = row;
    return;
  }
  if (mailListView.value && curMail.value?.id === row.id) {
    curMail.value = null;
    return;
  }
  openMail(row);
};


const mailItemClass = (row) => {
  return curMail.value && row.id == curMail.value.id ? (isDark.value ? 'overlay overlay-dark-backgroud' : 'overlay overlay-light-backgroud') : '';
};

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

const replyMail = async () => {
  Object.assign(sendMailModel.value, buildReplyModel(curMail.value, t('reply')));
  indexTab.value = 'sendmail';
};

const forwardMail = async () => {
  Object.assign(sendMailModel.value, buildForwardModel(curMail.value, t('forwardMail')));
  indexTab.value = 'sendmail';
};

const onSpiltSizeChange = (size) => {
  mailboxSplitSize.value = size;
}

// Re-parse still-locked mails in place after the user imported a decryption
// key (their raw is still the encrypted envelope, so processItem retries).
const reprocessLockedMails = async () => {
  rawData.value = await Promise.all(rawData.value.map(async (item) => {
    if (!item.locked) return item;
    return await processItem(item);
  }));
}

const saveToS3Proxy = async (filename, blob) => {
  await props.saveToS3(curMail.value.id, filename, blob);
}

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
  const deletedIds = new Set()
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
      deletedIds.add(mail.id)
      multiActionDeleteProgress.value = {
        percentage: Math.floor((index + 1) / selectedMails.length * 100),
        tip: `${index + 1}/${selectedMails.length}`
      };
    }
    showMultiActionDelete.value = true;
    message.success(t("success"));
    await refresh();
  } catch (error) {
    rawData.value = rawData.value.filter(mail => !deletedIds.has(mail.id))
    count.value = Math.max(0, count.value - deletedIds.size)
    if (deletedIds.has(curMail.value?.id)) curMail.value = null
    message.error(error.message || "error");
  } finally {
    loading.value = false;
  }
}

const multiActionDownload = async () => {
  try {
    loading.value = true;
    const selectedMails = data.value.filter((item) => item.checked);
    if (selectedMails.length === 0) {
      message.error(t('pleaseSelectMail'));
      return;
    }
    const JSZipModlue = await import('jszip');
    const JSZip = JSZipModlue.default;
    const zip = new JSZip();
    for (const mail of selectedMails) {
      zip.file(`${mail.id}.eml`, mail.raw);
    }
    multiActionDownloadZip.value = {
      url: URL.createObjectURL(await zip.generateAsync({ type: "blob" })),
      filename: `mails-${new Date().toISOString().replace(/:/g, '-')}.zip`
    }
    showMultiActionDownload.value = true;
  } catch (error) {
    message.error(error.message || "error");
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await refresh();
  window.addEventListener(MAIL_KEYS_IMPORTED_EVENT, reprocessLockedMails);
});

onBeforeUnmount(() => {
  clearInterval(timer.value)
  window.removeEventListener(MAIL_KEYS_IMPORTED_EVENT, reprocessLockedMails);
})
</script>

<template>
  <div>
    <div v-if="!isMobile" class="left">
      <div class="toolbar mailbox-toolbar">
        <template v-if="multiActionMode">
          <n-button @click="multiActionModeClick(false)" quaternary size="small">{{ t('cancelMultiAction') }}</n-button>
          <n-button @click="multiActionSelectAll(true)" quaternary size="small">{{ t('selectAll') }}</n-button>
          <n-button @click="multiActionSelectAll(false)" quaternary size="small">{{ t('unselectAll') }}</n-button>
          <div class="toolbar__spacer" />
          <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="multiActionDeleteMail">
            <template #trigger><n-button tertiary type="error" size="small">{{ t('delete') }}</n-button></template>
            {{ t('deleteMailTip') }}
          </n-popconfirm>
          <n-button @click="multiActionDownload" tertiary size="small">
            <template #icon><n-icon :component="CloudDownloadRound" /></template>
            {{ t('downloadMail') }}
          </n-button>
        </template>
        <template v-else>
          <n-button @click="multiActionModeClick(true)" quaternary size="small">
            <template #icon><n-icon :component="CheckBoxOutlined" /></template>
            {{ t('multiAction') }}
          </n-button>
          <n-button @click="backFirstPageAndRefresh" quaternary size="small">
            <template #icon><n-icon :component="RefreshRound" /></template>
            {{ t('refresh') }}
          </n-button>
          <n-switch v-model:value="autoRefresh" size="small" :round="false">
            <template #checked>{{ t('refreshAfter', { msg: autoRefreshInterval }) }}</template>
            <template #unchecked>{{ t('autoRefresh') }}</template>
          </n-switch>
          <div class="toolbar__spacer" />
          <n-input v-if="showFilterInput" v-model:value="localFilterKeyword" :placeholder="t('keywordQueryTip')"
            class="mailbox-filter" size="small" clearable>
            <template #prefix><n-icon :component="SearchRound" /></template>
          </n-input>
          <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" :page-sizes="[20, 50, 100]"
            show-size-picker size="small" />
        </template>
      </div>
      <div v-if="loaded && rawData.length === 0" class="empty-state mailbox-empty">
        <n-icon class="empty-state__icon" :component="InboxRound" />
        <h3 class="empty-state__title">{{ t('emptyInbox') }}</h3>
        <p class="empty-state__hint">{{ t('emptyInboxHint') }}</p>
        <n-button secondary size="small" @click="backFirstPageAndRefresh">{{ t('refresh') }}</n-button>
      </div>
      <template v-else>
        <n-split class="left" direction="horizontal" :max="0.75" :min="0" :resize-trigger-size="8"
          :default-size="mailboxSplitSize" :on-update:size="onSpiltSizeChange" v-if="!mailListView || curMail">
          <template #resize-trigger><div class="split-handle"><div class="split-handle__grip" /></div></template>
          <template #1>
            <div class="mail-list-scroll mail-list-compact mail-list-column">
              <p v-if="rawData.length > 0 && data.length === 0" class="muted filter-empty">{{ t('noFilterMatch') }}</p>
              <n-list v-else hoverable clickable>
                <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
                  :class="[mailItemClass(row), { 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }]">
                  <template #prefix v-if="multiActionMode"><n-checkbox v-model:checked="row.checked" @click.stop /></template>
                  <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
                    :previewLineClamp="mailListPreviewLineClampValue" />
                </n-list-item>
              </n-list>
            </div>
          </template>
          <template #2>
            <div v-if="curMail" class="toolbar reader-nav">
              <n-button v-if="mailListView" @click="curMail = null" text size="small">
                <template #icon><n-icon><ArrowBackIosNewFilled /></n-icon></template>
                {{ t('backToList') }}
              </n-button>
              <div v-if="mailListView" class="toolbar__spacer" />
              <n-button @click="prevMail" :disabled="!canGoPrevMail" text size="small">
                <template #icon><n-icon><ArrowBackIosNewFilled /></n-icon></template>
                {{ t('prevMail') }}
              </n-button>
              <n-button @click="nextMail" :disabled="!canGoNextMail" text size="small" icon-placement="right">
                <template #icon><n-icon><ArrowForwardIosFilled /></n-icon></template>
                {{ t('nextMail') }}
              </n-button>
            </div>
            <n-card :bordered="false" v-if="curMail" class="mail-item" :title="curMail.subject"
              content-style="padding: 0 24px 24px" header-style="padding: 8px 24px 12px"
              style="overflow: auto; max-height: calc(100vh - 180px);">
              <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
                :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
                :enableMailReadStatus="enableMailReadStatus" :onUpdateMailReadStatus="toggleCurrentMailUnread"
                :onDelete="deleteMail" :onReply="replyMail" :onForward="forwardMail" :onSaveToS3="saveToS3Proxy"
                @unlock="reprocessLockedMails" />
            </n-card>
            <div v-else class="empty-state reader-empty">
              <n-icon class="empty-state__icon" :component="InboxRound" />
              <h3 class="empty-state__title">{{ t('pleaseSelectMail') }}</h3>
            </div>
          </template>
        </n-split>
        <div v-else class="mail-list-scroll mail-list-compact">
          <p v-if="rawData.length > 0 && data.length === 0" class="muted filter-empty">{{ t('noFilterMatch') }}</p>
          <n-list v-else hoverable clickable>
            <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
              :class="[mailItemClass(row), { 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }]">
              <template #prefix v-if="multiActionMode"><n-checkbox v-model:checked="row.checked" @click.stop /></template>
              <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
                :previewLineClamp="mailListPreviewLineClampValue" />
            </n-list-item>
          </n-list>
        </div>
      </template>
    </div>
    <div class="left" v-else>
      <n-input v-if="showFilterInput" v-model:value="localFilterKeyword" :placeholder="t('keywordQueryTip')"
        class="mobile-mailbox-filter" size="medium" clearable>
        <template #prefix><n-icon :component="SearchRound" /></template>
      </n-input>
      <div class="toolbar mailbox-toolbar">
        <n-button @click="backFirstPageAndRefresh" quaternary size="small">
          <template #icon><n-icon :component="RefreshRound" /></template>
          {{ t('refresh') }}
        </n-button>
        <n-switch v-model:value="autoRefresh" size="small" :round="false">
          <template #checked>{{ t('refreshAfter', { msg: autoRefreshInterval }) }}</template>
          <template #unchecked>{{ t('autoRefresh') }}</template>
        </n-switch>
        <div class="toolbar__spacer" />
        <n-pagination v-model:page="page" v-model:page-size="pageSize" :item-count="count" simple size="small" />
      </div>
      <div v-if="loaded && rawData.length === 0" class="empty-state mailbox-empty">
        <n-icon class="empty-state__icon" :component="InboxRound" />
        <h3 class="empty-state__title">{{ t('emptyInbox') }}</h3>
        <p class="empty-state__hint">{{ t('emptyInboxHint') }}</p>
        <n-button secondary size="small" @click="backFirstPageAndRefresh">{{ t('refresh') }}</n-button>
      </div>
      <div v-else class="mail-list-scroll mail-list-compact">
        <p v-if="rawData.length > 0 && data.length === 0" class="muted filter-empty">{{ t('noFilterMatch') }}</p>
        <n-list v-else hoverable clickable>
          <n-list-item v-for="row in data" v-bind:key="row.id" @click="() => clickRow(row)"
            :class="{ 'mail-list-unread': enableMailReadStatus && row.is_unread === 1 }">
            <MailSummary :mail="row" :showEMailTo="showEMailTo" :enableMailReadStatus="enableMailReadStatus"
              :previewLineClamp="mailListPreviewLineClampValue" />
          </n-list-item>
        </n-list>
      </div>
      <n-drawer v-model:show="curMail" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
        style="height: 92vh; border-radius: 12px 12px 0 0;">
        <n-drawer-content :title="curMail ? curMail.subject : ''" closable>
          <div class="mail-mobile-reader">
            <MailContentRenderer :mail="curMail" :showEMailTo="showEMailTo"
              :enableUserDeleteEmail="enableUserDeleteEmail" :showReply="showReply" :showSaveS3="showSaveS3"
              :enableMailReadStatus="enableMailReadStatus" :onUpdateMailReadStatus="toggleCurrentMailUnread"
              :onDelete="deleteMail" :onReply="replyMail" :onForward="forwardMail"
              :onSaveToS3="saveToS3Proxy" @unlock="reprocessLockedMails" />
          </div>
        </n-drawer-content>
      </n-drawer>
    </div>
    <n-modal v-model:show="showMultiActionDownload" preset="dialog" :title="t('downloadMail')">
      <n-tag type="info">
        {{ multiActionDownloadZip.filename }}
      </n-tag>
      <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="multiActionDownloadZip.filename"
        :href="multiActionDownloadZip.url">
        <n-icon :component="CloudDownloadRound" />
        {{ t('downloadMail') + " zip" }}
      </n-button>
    </n-modal>
    <n-modal v-model:show="showMultiActionDelete" preset="dialog" :title="t('delete') + t('success')"
      negative-text="OK">
      <n-space justify="center">
        <n-progress type="circle" status="error" :percentage="multiActionDeleteProgress.percentage">
          <span style="text-align: center">
            {{ multiActionDeleteProgress.tip }}
          </span>
        </n-progress>
      </n-space>
    </n-modal>
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

.mail-list-compact :deep(.n-list-item.overlay-dark-backgroud) {
  background-color: rgba(255, 255, 255, 0.1);
}

.mail-list-compact :deep(.n-list-item.overlay-light-backgroud) {
  background-color: rgba(0, 0, 0, 0.1);
}

.mailbox-toolbar { margin-bottom: var(--space-3); }
.mailbox-filter { width: 220px; }
.filter-empty { padding: 16px 14px; margin: 0; }
.reader-nav { justify-content: flex-end; padding: 0 24px; }
.reader-empty { padding-block: var(--space-8); }
.mailbox-empty { min-height: 320px; justify-content: center; }
.mail-list-column { border-right: 1px solid var(--app-divider); }
.mail-list-compact :deep(.n-list-item.overlay) { box-shadow: inset 3px 0 0 var(--app-accent); }

.mail-item {
  height: 100%;
}

:deep(.mail-item .n-card-header__main) {
  overflow-wrap: anywhere;
  font-size: var(--font-xl);
  font-weight: 600;
}

.mail-mobile-reader {
  min-width: 0;
}

.mail-list-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 420px;
  max-height: calc(100vh - 220px);
}

.mail-list-compact :deep(.n-list-item) {
  height: auto;
  padding: 12px 14px;
}

.mail-list-compact :deep(.n-list-item:not(.overlay):hover) {
  background-color: v-bind("isDark ? 'rgba(255, 255, 255, 0.04)' : themeVars.hoverColor");
}

.mail-list-scroll :deep(.n-list-item__main) {
  min-width: 0;
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
  .mail-list-scroll { min-height: 0; max-height: none; overflow: visible; }
  .mobile-mailbox-filter { width: 100%; margin-bottom: var(--space-3); }
}
</style>
