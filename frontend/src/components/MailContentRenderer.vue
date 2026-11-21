<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { useThemeVars } from 'naive-ui';
import { useScopedI18n } from '@/i18n/app'
import { CloudDownloadRound, ReplyFilled, ForwardFilled, FullscreenRound, ImageRound, AttachFileRound,
  MarkEmailReadRound, MarkEmailUnreadRound, MoreHorizRound, DeleteOutlineRound, TextSnippetRound, InfoOutlined,
  LockOutlined, GppGoodOutlined, AltRouteRound, ChevronRightRound } from '@vicons/material'
import ShadowHtmlComponent from "./ShadowHtmlComponent.vue";
import AiExtractInfo from "./AiExtractInfo.vue";
import ClientExtractInfo from "./ClientExtractInfo.vue";
import MailSecurityPanel from "./MailSecurityPanel.vue";
import MailDeliveryPanel from "./MailDeliveryPanel.vue";
import { getDownloadEmlUrl, processItem } from '../utils/email-parser';
import { importKeyOrLink, pendingWrappedImports } from '../utils/mail-fragment';
import { blockRemoteContent } from '../utils/remote-content-policy';
import { utcToLocalDate } from '../utils';
import { copyToClipboard } from '../utils/clipboard';
import {
  analyzeMailSecurity,
  extractDeliveryDetails,
  getAuthDotStatus,
  normalizeHeaders,
  splitAddressDisplay,
} from '../utils/mail-auth';
import { useGlobalState } from '../store';

const { preferShowTextMail, useIframeShowMail, useUTCDate, isDark, autoLoadRemoteImages } = useGlobalState();

const { t } = useScopedI18n('components.MailContentRenderer')
const message = useMessage()
const themeVars = useThemeVars();
const replyColor = computed(() => isDark.value ? themeVars.value.infoColor : themeVars.value.infoColorPressed);
const neutralActionColor = computed(() =>
  `color-mix(in srgb, ${themeVars.value.textColor2} 50%, ${themeVars.value.textColor3})`);
const deleteColor = computed(() => isDark.value
  ? `color-mix(in srgb, ${themeVars.value.errorColor} 65%, ${themeVars.value.textColor1})`
  : themeVars.value.errorColorPressed);

const props = defineProps({
  mail: {
    type: Object,
    required: true
  },
  showEMailTo: {
    type: Boolean,
    default: true
  },
  enableUserDeleteEmail: {
    type: Boolean,
    default: false
  },
  showReply: {
    type: Boolean,
    default: false
  },
  showSaveS3: {
    type: Boolean,
    default: false
  },
  enableMailReadStatus: {
    type: Boolean,
    default: false
  },
  // 回调函数 props
  onDelete: {
    type: Function,
    default: () => { }
  },
  onReply: {
    type: Function,
    default: () => { }
  },
  onForward: {
    type: Function,
    default: () => { }
  },
  onSaveToS3: {
    type: Function,
    default: () => { }
  },
  onUpdateMailReadStatus: {
    type: Function,
    default: () => { }
  }
});

const emit = defineEmits(['unlock']);

const unlockInput = ref('');
const unlockLoading = ref(false);

const lockHint = computed(() => props.mail.lockReason === 'decrypt_failed'
  ? t('lockedDecryptFailed')
  : t('lockedMissingKey'));

// Paste a private key / decryption link, store it, then re-parse this mail
// in place (item.raw still holds the encrypted envelope when locked).
const handleUnlock = async () => {
  if (unlockLoading.value) return;
  unlockLoading.value = true;
  try {
    const result = await importKeyOrLink(unlockInput.value, props.mail.address);
    if (result.needsPassphrase) {
      // A wrapped backup needs its passphrase; the global backup host
      // prompts for it and imports the key there.
      pendingWrappedImports.value = [...pendingWrappedImports.value, result.wrapped];
      unlockInput.value = '';
      message.info(t('unlockNeedsPassphrase'));
      return;
    }
    if (!result.ok) {
      message.error(t('unlockInvalid'));
      return;
    }
    unlockInput.value = '';
    message.success(t('unlockSuccess'));
    await processItem(props.mail);
    if (!props.mail.locked) emit('unlock', props.mail);
  } catch (error) {
    console.error(error);
    message.error(t('unlockInvalid'));
  } finally {
    unlockLoading.value = false;
  }
};

const showTextMail = ref(preferShowTextMail.value);
const showAttachments = ref(false);
const curAttachments = ref([]);
const attachmentLoding = ref(false);
const readStatusUpdating = ref(false);
const showFullscreen = ref(false);
const showMoreActions = ref(false);
const showMailDetails = ref(false);
const moreActionsButton = ref(null);
const downloadMailButton = ref(null);

watch(showMoreActions, async (show) => {
  if (!show) return;
  await nextTick();
  if (showMoreActions.value) downloadMailButton.value?.$el.focus();
});

// Per-mail consent, deliberately independent of the global setting: it only
// ever turns true when the user clicks "load images" for this specific mail,
// and resets when a different mail is shown.
const showRemoteImages = ref(false);
const activeMetaPanel = ref('security');
const mobileDetailsOpen = ref(false);
watch(() => props.mail.id, () => {
  showRemoteImages.value = false;
  showMoreActions.value = false;
  showMailDetails.value = false;
  activeMetaPanel.value = 'security';
  mobileDetailsOpen.value = false;
});

const allowRemoteImages = computed(() => autoLoadRemoteImages.value || showRemoteImages.value);

const processedMail = computed(() => {
  if (allowRemoteImages.value) {
    return { message: props.mail.message, blocked: 0 };
  }
  const { html, blocked } = blockRemoteContent(props.mail.message);
  return { message: html, blocked };
});

const shadowMailHtml = computed(() => allowRemoteImages.value
  ? blockRemoteContent(processedMail.value.message, { allowRemoteImages: true }).html
  : processedMail.value.message);

// --- header pills and metadata panels (all derived from the raw MIME
// headers in this browser; nothing is sent anywhere) ---

const mailHeaders = computed(() => normalizeHeaders(props.mail.headers));

const fromHeader = computed(() => {
  for (const { key, value } of mailHeaders.value) {
    if (key.trim().toLowerCase() === 'from') return value;
  }
  return null;
});

const fromParts = computed(() => fromHeader.value
  ? splitAddressDisplay(fromHeader.value)
  : { name: '', address: '' });

const showMetaPanels = computed(() => !props.mail.locked && mailHeaders.value.length > 0);

const security = computed(() => analyzeMailSecurity(mailHeaders.value));

const delivery = computed(() => {
  const details = extractDeliveryDetails(mailHeaders.value);
  return { ...details, messageId: details.messageId || props.mail.message_id || null };
});

const securityDot = computed(() => getAuthDotStatus(security.value));

const metaPanels = computed(() => [
  { id: 'security', icon: GppGoodOutlined, label: t('security'), dot: securityDot.value },
  { id: 'delivery', icon: AltRouteRound, label: t('delivery'), dot: 'info' },
]);

const copyFromAddress = async () => {
  try {
    await copyToClipboard(fromParts.value.address || props.mail.source);
    message.success(t('addressCopied'));
  } catch {
    message.error(t('copyCodeFailed'));
  }
};

const handleLoadRemoteImages = () => {
  showRemoteImages.value = true;
};

const handleDelete = () => {
  props.onDelete();
};

const handleViewAttachments = () => {
  curAttachments.value = props.mail.attachments;
  showAttachments.value = true;
};

const handleReply = () => {
  props.onReply();
};

const handleForward = () => {
  props.onForward();
};

const closeMoreActions = () => {
  showMoreActions.value = false;
  moreActionsButton.value?.$el.focus();
};

const toggleTextMail = () => {
  showTextMail.value = !showTextMail.value;
  closeMoreActions();
};

const openFullscreen = () => {
  showFullscreen.value = true;
  closeMoreActions();
};

const openMailDetails = () => {
  showMailDetails.value = true;
  closeMoreActions();
};

const handleUpdateMailReadStatus = async () => {
  readStatusUpdating.value = true;
  closeMoreActions();
  try {
    await props.onUpdateMailReadStatus();
  } finally {
    readStatusUpdating.value = false;
  }
};


const handleSaveToS3 = async (filename, blob) => {
  attachmentLoding.value = true;
  try {
    await props.onSaveToS3(filename, blob);
  } finally {
    attachmentLoding.value = false;
  }
};

</script>

<template>
  <div class="mail-content-renderer">
    <div class="mail-meta">
      <div class="mail-details">
        <div class="mail-address">
          <span class="mail-address-label">{{ t('from') }}</span>
          <button v-if="!mail.locked && (fromParts.address || mail.source)" type="button"
            class="mail-pill mail-pill--from" :title="t('copyAddress')" :aria-label="t('copyAddress')"
            @click="copyFromAddress">
            <span v-if="fromParts.name" class="mail-pill-name">{{ fromParts.name }}</span>
            <span class="mail-pill-addr">{{ fromParts.address || mail.source }}</span>
          </button>
          <span v-else class="mail-address-value">{{ mail.locked ? lockHint : mail.source }}</span>
        </div>
        <div v-if="showEMailTo" class="mail-address">
          <span class="mail-address-label">{{ t('to') }}</span>
          <span class="mail-pill mail-pill--to">{{ mail.address }}</span>
        </div>
        <div class="mail-details-footer">
          <span class="mail-address-label mail-details-footer-label">{{ t('date') }}</span>
          <span class="mail-details-footer-date">{{ utcToLocalDate(mail.created_at, useUTCDate) }}</span>
        </div>
      </div>
      <div v-if="showMetaPanels" class="mail-side">
        <div class="mail-side-desktop">
          <div class="mail-rail" role="tablist" :aria-label="t('details')">
            <n-tooltip v-for="panel in metaPanels" :key="panel.id" placement="left">
              <template #trigger>
                <button type="button" class="mail-rail-btn"
                  :class="{ 'mail-rail-btn--active': activeMetaPanel === panel.id }" role="tab"
                  :aria-selected="activeMetaPanel === panel.id" :aria-label="panel.label"
                  @click="activeMetaPanel = panel.id">
                  <n-icon :component="panel.icon" />
                  <span class="mail-rail-dot" :class="`mail-rail-dot--${panel.dot}`" />
                </button>
              </template>
              {{ panel.label }}
            </n-tooltip>
          </div>
          <div class="mail-panel" role="tabpanel">
            <MailSecurityPanel v-if="activeMetaPanel === 'security'" :security="security" />
            <MailDeliveryPanel v-else :delivery="delivery" :mail="mail" />
          </div>
        </div>
        <div class="mail-side-mobile">
          <button type="button" class="mail-details-toggle" :aria-expanded="mobileDetailsOpen"
            @click="mobileDetailsOpen = !mobileDetailsOpen">
            <n-icon :component="ChevronRightRound" class="mail-details-toggle-chevron"
              :class="{ 'mail-details-toggle-chevron--open': mobileDetailsOpen }" />
            {{ t('details') }}
            <span class="mail-details-toggle-dots">
              <span v-for="panel in metaPanels" :key="panel.id" class="mail-rail-dot"
                :class="`mail-rail-dot--${panel.dot}`" />
            </span>
          </button>
          <div v-show="mobileDetailsOpen" class="mail-mobile-panels">
            <n-tabs type="line" size="small" class="mail-mobile-tabs">
              <n-tab-pane name="security" :tab="t('security')">
                <MailSecurityPanel :security="security" />
              </n-tab-pane>
              <n-tab-pane name="delivery" :tab="t('delivery')">
                <MailDeliveryPanel :delivery="delivery" :mail="mail" />
              </n-tab-pane>
            </n-tabs>
          </div>
        </div>
      </div>
    </div>
    <n-flex class="mail-actions" align="center" justify="space-between" :size="4">
      <n-space v-if="(showReply || mail.attachments?.length) && !mail.locked" align="center" :size="4">
        <n-button v-if="showReply" size="small" quaternary type="info" :color="replyColor" @click="handleReply">
          <template #icon><n-icon :component="ReplyFilled" /></template>
          {{ t('reply') }}
        </n-button>
        <n-button v-if="showReply" size="small" quaternary :color="neutralActionColor" @click="handleForward">
          <template #icon><n-icon :component="ForwardFilled" /></template>
          {{ t('forward') }}
        </n-button>
        <n-button v-if="mail.attachments?.length" size="small" quaternary :color="neutralActionColor"
          :title="t('attachments')" :aria-label="t('attachments')" @click="handleViewAttachments">
          <template #icon><n-icon :component="AttachFileRound" /></template>
          <n-space align="center" :size="4">
            <span>{{ t('attachments') }}</span>
            <n-badge :value="mail.attachments.length" :color="themeVars.tagColor" />
          </n-space>
        </n-button>
      </n-space>
      <div class="mail-secondary-actions">
        <n-space align="center" :wrap="false" :size="4">
          <n-popover v-model:show="showMoreActions" trigger="click" placement="bottom-end" :show-arrow="false">
            <template #trigger>
              <n-button ref="moreActionsButton" size="small" quaternary :color="neutralActionColor" :title="t('moreActions')" :aria-label="t('moreActions')"
                :aria-expanded="showMoreActions" @keydown.esc.stop.prevent="closeMoreActions">
                <template #icon><n-icon :component="MoreHorizRound" /></template>
                {{ t('more') }}
              </n-button>
            </template>
            <div class="mail-more-actions" @keydown.esc.stop.prevent="closeMoreActions">
              <n-button v-if="!mail.locked" ref="downloadMailButton" tag="a" target="_blank" block quaternary size="small" :download="mail.id + '.eml'"
                :href="getDownloadEmlUrl(mail.raw)" @click="closeMoreActions">
                <template #icon><n-icon :component="CloudDownloadRound" /></template>
                {{ t('downloadMail') }}
              </n-button>
              <n-button v-if="enableMailReadStatus" block quaternary size="small" :loading="readStatusUpdating"
                @click="handleUpdateMailReadStatus">
                <template #icon>
                  <n-icon :component="mail.is_unread === 1 ? MarkEmailReadRound : MarkEmailUnreadRound" />
                </template>
                {{ mail.is_unread === 1 ? t('markAsRead') : t('markAsUnread') }}
              </n-button>
              <n-button v-if="!mail.locked" block quaternary size="small" @click="toggleTextMail">
                <template #icon><n-icon :component="TextSnippetRound" /></template>
                {{ showTextMail ? t('showHtmlMail') : t('showTextMail') }}
              </n-button>
              <n-button block quaternary size="small" @click="openFullscreen">
                <template #icon><n-icon :component="FullscreenRound" /></template>
                {{ t('fullscreen') }}
              </n-button>
              <n-button block quaternary size="small" @click="openMailDetails">
                <template #icon><n-icon :component="InfoOutlined" /></template>
                {{ t('mailDetails') }}
              </n-button>
            </div>
          </n-popover>
          <n-popconfirm v-if="enableUserDeleteEmail" @positive-click="handleDelete">
            <template #trigger>
              <n-button size="small" quaternary type="error" :color="deleteColor" :title="t('delete')" :aria-label="t('delete')">
                <template #icon><n-icon :component="DeleteOutlineRound" /></template>
                {{ t('delete') }}
              </n-button>
            </template>
            {{ t('deleteMailTip') }}
          </n-popconfirm>
        </n-space>
      </div>
    </n-flex>

    <!-- 外部资源阻断提示 -->
    <n-alert v-if="processedMail.blocked" type="warning" :show-icon="false" :bordered="false"
      class="remote-images-banner">
      <n-space align="center" justify="space-between">
        <span>{{ t('remoteImagesBlocked', { count: processedMail.blocked }) }}</span>
        <n-button size="tiny" tertiary type="warning" @click="handleLoadRemoteImages">
          <template #icon>
            <n-icon :component="ImageRound" />
          </template>
          {{ t('loadRemoteImages') }}
        </n-button>
      </n-space>
    </n-alert>

    <!-- AI 提取信息 -->
    <AiExtractInfo :metadata="mail.metadata" />

    <!-- 浏览器端验证码/链接识别（加密邮件或服务器未提取时） -->
    <ClientExtractInfo :mail="mail" />

    <!-- 加密但未解锁的邮件 -->
    <n-alert v-if="mail.locked" type="warning" :show-icon="false" :bordered="false" class="mail-locked-banner">
      <n-space align="center" :size="6">
        <n-icon :component="LockOutlined" />
        <span>{{ lockHint }}</span>
      </n-space>
      <n-space align="center" :size="6" style="margin-top: 8px;">
        <n-input v-model:value="unlockInput" size="small" :placeholder="t('unlockInputPlaceholder')"
          style="max-width: 320px;" @keyup.enter="handleUnlock" />
        <n-button size="small" type="primary" tertiary :loading="unlockLoading" @click="handleUnlock">
          {{ t('unlock') }}
        </n-button>
      </n-space>
    </n-alert>

    <!-- 邮件内容 -->
    <div v-if="!mail.locked" class="mail-content" :class="{ 'dark-mode': isDark }">
      <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>
      <iframe v-else-if="useIframeShowMail" :srcdoc="processedMail.message" class="mail-iframe" sandbox="allow-same-origin allow-popups">
      </iframe>
      <ShadowHtmlComponent v-else :key="mail.id" :htmlContent="shadowMailHtml" :isDark="isDark" class="mail-html" />
    </div>
  </div>

  <n-modal v-model:show="showMailDetails" preset="card" title="Mail details" :bordered="false"
    class="mail-details-modal" style="width: min(480px, calc(100vw - 32px));">
    <n-descriptions :column="1" label-placement="left" :content-style="{ overflowWrap: 'anywhere' }">
      <n-descriptions-item v-if="mail.subject" label="Subject">{{ mail.subject }}</n-descriptions-item>
      <n-descriptions-item label="From">{{ mail.locked ? lockHint : mail.source }}</n-descriptions-item>
      <n-descriptions-item v-if="mail.originalSource && mail.originalSource !== mail.source"
        label="SMTP envelope sender">{{ mail.originalSource }}</n-descriptions-item>
      <n-descriptions-item v-if="showEMailTo" label="To">{{ mail.address }}</n-descriptions-item>
      <n-descriptions-item label="Received at">{{ utcToLocalDate(mail.created_at, useUTCDate) }}</n-descriptions-item>
      <n-descriptions-item v-if="enableMailReadStatus && (mail.is_unread === 0 || mail.is_unread === 1)"
        label="Status">{{ mail.is_unread === 1 ? 'Unread' : 'Read' }}</n-descriptions-item>
      <n-descriptions-item v-if="mail.attachments?.length" :label="`Attachments (${mail.attachments.length})`">
        <n-space vertical :size="4">
          <span v-for="attachment in mail.attachments" :key="attachment.id">
            {{ attachment.filename || '—' }} · {{ attachment.size }}
          </span>
        </n-space>
      </n-descriptions-item>
      <n-descriptions-item v-if="mail.message_id" label="Message-ID">{{ mail.message_id }}</n-descriptions-item>
      <n-descriptions-item label="ID">{{ mail.id }}</n-descriptions-item>
    </n-descriptions>
  </n-modal>

  <n-drawer v-model:show="showFullscreen" width="100%" placement="bottom" :trap-focus="false" :block-scroll="false"
    style="height: 100vh;">
    <n-drawer-content :title="mail.subject" closable>
      <div class="fullscreen-mail-content" :class="{ 'dark-mode': isDark }">
        <pre v-if="showTextMail" class="mail-text">{{ mail.text }}</pre>
        <iframe v-else-if="useIframeShowMail" :srcdoc="processedMail.message" class="mail-iframe" sandbox="allow-same-origin allow-popups">
        </iframe>
        <ShadowHtmlComponent v-else :key="mail.id" :htmlContent="shadowMailHtml" :isDark="isDark" class="mail-html" />
      </div>
    </n-drawer-content>
  </n-drawer>

  <!-- 附件模态框 -->
  <n-modal v-model:show="showAttachments" preset="dialog" title="Dialog">
    <template #header>
      <div>{{ t('attachments') }}</div>
    </template>
    <n-spin v-model:show="attachmentLoding">
      <n-list hoverable clickable>
        <n-list-item v-for="row in curAttachments" v-bind:key="row.id">
          <n-thing class="center" :title="row.filename">
            <template #description>
              <n-space>
                <n-tag type="info">
                  Size: {{ row.size }}
                </n-tag>
                <n-button v-if="showSaveS3" @click="handleSaveToS3(row.filename, row.blob)" ghost type="info"
                  size="small">
                  {{ t('saveToS3') }}
                </n-button>
              </n-space>
            </template>
          </n-thing>
          <template #suffix>
            <n-button tag="a" target="_blank" tertiary type="info" size="small" :download="row.filename"
              :href="row.url">
              <n-icon :component="CloudDownloadRound" />
            </n-button>
          </template>
        </n-list-item>
      </n-list>
    </n-spin>
  </n-modal>
</template>

<style scoped>
.mail-content-renderer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.mail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-divider);
}

.mail-details {
  flex: 1 1 300px;
  min-width: 0;
  font-size: 13px;
  line-height: 22px;
}

.mail-address {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 4px 8px;
  align-items: center;
  overflow-wrap: anywhere;
}

.mail-address-value {
  color: var(--app-text-2);
}

.mail-address-label {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--app-text-3);
}

.mail-pill {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  justify-self: start;
  max-width: 100%;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  font-family: inherit;
  font-size: 12px;
  line-height: 18px;
  min-width: 0;
}

.mail-pill--from {
  cursor: pointer;
  background: transparent;
  color: var(--app-text-2);
  text-align: left;
}

.mail-pill--from:hover {
  border-color: var(--app-text-3);
}

.mail-pill-name {
  color: var(--app-text-1);
  font-weight: 500;
}

.mail-pill-addr {
  color: var(--app-text-3);
  overflow-wrap: anywhere;
}

.mail-pill--to {
  border-color: color-mix(in srgb, var(--app-accent) 35%, transparent);
  background: var(--app-accent-soft);
  color: var(--app-accent);
}

.mail-details-footer {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 4px 8px;
  align-items: baseline;
  margin-top: 6px;
  font-size: 12px;
  color: var(--app-text-2);
}

.mail-details-footer-label {
  align-self: start;
}

.mail-details-footer-date {
  overflow-wrap: anywhere;
}

.mail-side {
  flex: 0 1 320px;
  min-width: 240px;
}

.mail-side-desktop {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.mail-rail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: none;
}

.mail-rail-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-3);
  font-family: inherit;
  cursor: pointer;
}

.mail-rail-btn:hover {
  background: var(--app-accent-soft);
  color: var(--app-text-1);
}

.mail-rail-btn--active {
  background: var(--app-accent-soft);
  color: var(--app-accent);
}

.mail-rail-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.mail-rail-dot--pass {
  background: var(--app-success);
}

.mail-rail-dot--warn {
  background: var(--app-warning);
}

.mail-rail-dot--fail {
  background: var(--app-danger);
}

.mail-rail-dot--info {
  background: var(--app-accent);
}

.mail-panel {
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-raised);
}

.mail-side-mobile {
  display: none;
}

@media (max-width: 767px) {
  .mail-meta {
    flex-direction: column;
    align-items: stretch;
  }

  .mail-details {
    flex: none;
    width: 100%;
  }

  .mail-side {
    flex: none;
    width: 100%;
    min-width: 0;
  }

  .mail-side-desktop {
    display: none;
  }

  .mail-side-mobile {
    display: block;
  }
}

.mail-details-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-2);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}

.mail-details-toggle:hover {
  background: var(--app-accent-soft);
}

.mail-details-toggle-chevron {
  transition: transform 0.15s ease;
}

.mail-details-toggle-chevron--open {
  transform: rotate(90deg);
}

.mail-details-toggle-dots {
  position: relative;
  display: inline-flex;
  gap: 6px;
  margin-left: auto;
}

.mail-details-toggle-dots .mail-rail-dot {
  position: static;
}

.mail-mobile-panels {
  margin-top: 6px;
  padding: 10px 12px;
  border: 1px solid var(--app-border);
  border-radius: 6px;
  background: var(--app-surface-raised);
}

.mail-mobile-tabs :deep(.n-tabs-pane-padding) {
  padding-top: 8px;
}

.mail-secondary-actions {
  margin-left: auto;
}

.mail-actions {
  padding: 4px 0;
  border-bottom: 1px solid var(--app-divider);
}

.mail-actions :deep(.n-badge-sup) {
  color: v-bind('themeVars.textColor2');
}

.mail-more-actions {
  width: 200px;
  max-width: calc(100vw - 48px);
}

.mail-more-actions :deep(.n-button) {
  justify-content: flex-start;
  height: auto;
  min-height: 32px;
  padding: 6px 8px;
}

.mail-more-actions :deep(.n-button__content) {
  white-space: normal;
  text-align: left;
}

/* Let the banner's inner space fill the alert so the button sits on the right. */
.remote-images-banner :deep(.n-space) {
  width: 100%;
}

.mail-content {
  margin-top: 10px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}

.mail-text {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

.dark-mode .mail-text {
  color: #e0e0e0;
}

.mail-iframe {
  width: 100%;
  height: 100%;
  border: none;
  min-height: 400px;
}

.dark-mode .mail-iframe {
  background-color: #fff;
}

.mail-html {
  width: 100%;
  height: 100%;
}

.center {
  text-align: center;
}

.fullscreen-mail-content {
  height: calc(100vh - 120px);
  overflow: auto;
}

.fullscreen-mail-content .mail-iframe {
  min-height: calc(100vh - 120px);
}
</style>
