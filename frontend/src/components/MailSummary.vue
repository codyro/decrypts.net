<script setup>
import { computed } from 'vue';
import { useMessage, useThemeVars } from 'naive-ui';
import { LockOutlined } from '@vicons/material';
import { useGlobalState } from '../store';
import { utcToLocalDate } from '../utils';
import { copyToClipboard } from '../utils/clipboard';
import { extractCodesAndLinks } from '../utils/extract-codes';
import AiExtractInfo from './AiExtractInfo.vue';
import { useScopedI18n } from '@/i18n/app';

const { useUTCDate, isDark, detectVerificationCodes } = useGlobalState();
const message = useMessage();
const themeVars = useThemeVars();
const mutedTextColor = computed(() => isDark.value
  ? themeVars.value.textColor3
  : `color-mix(in srgb, ${themeVars.value.textColor3} 65%, ${themeVars.value.textColor2})`);
const { t } = useScopedI18n('components.MailContentRenderer');

const props = defineProps({
  mail: { type: Object, required: true },
  showEMailTo: { type: Boolean, default: true },
  enableMailReadStatus: { type: Boolean, default: false },
  previewLineClamp: { type: Number, default: 0 },
});

const receivedAt = computed(() => new Date(`${props.mail.created_at} UTC`));
const lockHint = computed(() => props.mail.lockReason === 'decrypt_failed'
  ? t('lockedDecryptFailed')
  : t('lockedMissingKey'));

// Client-side verification code detection: fills in for encrypted mail (the
// server AI extraction is skipped for it) and shows a one-click copy chip.
const serverExtract = computed(() => {
  if (!props.mail.metadata) return null;
  try {
    return JSON.parse(props.mail.metadata).ai_extract || null;
  } catch {
    return null;
  }
});

const detectedCode = computed(() => {
  if (!detectVerificationCodes.value || props.mail.locked) return null;
  if (!props.mail.encrypted && serverExtract.value) return null;
  const { codes } = extractCodesAndLinks({
    subject: props.mail.subject,
    text: props.mail.text,
    html: props.mail.message
  });
  return codes[0] || null;
});

const copyDetectedCode = async () => {
  try {
    await copyToClipboard(detectedCode.value);
    message.success(t('codeCopied'));
  } catch {
    message.error(t('copyCodeFailed'));
  }
};
</script>

<template>
  <div class="mail-summary">
    <n-flex align="center" :wrap="false" :size="6">
      <div class="mail-summary-sender" :title="mail.locked ? lockHint : mail.source">
        <span v-if="enableMailReadStatus && mail.is_unread === 1" class="mail-summary-unread-dot" />
        <n-ellipsis>
          <n-text v-if="showEMailTo" depth="3" class="mail-summary-muted">{{ t('from') }}: </n-text><n-text depth="2">{{ mail.locked ? lockHint : (mail.source || '—') }}</n-text>
        </n-ellipsis>
      </div>
      <n-text depth="3" class="mail-summary-date mail-summary-muted" :title="utcToLocalDate(mail.created_at, useUTCDate)">
        <n-time v-if="!Number.isNaN(receivedAt.getTime())" :time="receivedAt"
          :time-zone="useUTCDate ? 'UTC' : undefined" format="yy/MM/dd" />
        <template v-else>{{ utcToLocalDate(mail.created_at, useUTCDate) }}</template>
      </n-text>
    </n-flex>
    <div v-if="showEMailTo" class="mail-summary-recipient">
      <n-ellipsis>
        <n-text depth="3" class="mail-summary-muted">{{ t('to') }}: </n-text><n-text depth="2">{{ mail.address }}</n-text>
      </n-ellipsis>
    </div>
    <div class="mail-summary-subject" :title="`ID: ${mail.id}\n${mail.subject || ''}`">
      <n-flex align="center" :wrap="false" :size="4">
        <n-icon v-if="mail.locked" :component="LockOutlined" class="mail-summary-lock"
          :title="mail.lockReason === 'decrypt_failed' ? t('lockedDecryptFailed') : t('lockedMissingKey')" />
        <n-ellipsis><n-text strong depth="1">{{ mail.locked ? lockHint : (mail.subject || '—') }}</n-text></n-ellipsis>
      </n-flex>
    </div>
    <div v-if="mail.text && previewLineClamp > 0" class="mail-summary-preview">
      <n-ellipsis :line-clamp="previewLineClamp" :tooltip="false"><n-text depth="3" class="mail-summary-muted">{{ mail.text }}</n-text></n-ellipsis>
    </div>
    <AiExtractInfo :metadata="mail.metadata" compact />
    <button v-if="detectedCode" type="button" class="mail-summary-code" :title="t('copyCode')"
      @click.stop="copyDetectedCode">
      <span class="mail-summary-code__value">{{ detectedCode }}</span>
      <span class="mail-summary-code__glyph" aria-hidden="true">⧉</span>
    </button>
  </div>
</template>

<style scoped>
.mail-summary {
  min-width: 0;
  width: 100%;
  line-height: 20px;
}

.mail-summary-sender {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  font-size: 13px;
}

.mail-summary :deep(.n-ellipsis) {
  min-width: 0;
}

.mail-summary-sender :deep(.n-ellipsis) {
  flex: 1;
}

.mail-summary-recipient {
  margin-top: 4px;
}

.mail-summary-recipient :deep(.n-ellipsis) {
  display: block;
}

.mail-summary-subject {
  font-size: 15px;
  margin-top: 4px;
}

.mail-summary-muted {
  color: v-bind(mutedTextColor);
}

.mail-summary-preview {
  font-size: 13px;
  line-height: 18px;
  margin-top: 8px;
}

.mail-summary-preview :deep(.n-ellipsis) {
  display: -webkit-box;
  overflow-wrap: anywhere;
}

.mail-summary-recipient,
.mail-summary-date {
  font-size: 12px;
}

.mail-summary-unread-dot {
  flex: 0 0 7px;
  height: 7px;
  border-radius: 50%;
  background: v-bind('themeVars.infoColor');
}

.mail-summary-lock {
  flex: 0 0 auto;
  color: v-bind(mutedTextColor);
}

.mail-summary :deep(.ai-extract-info) {
  margin: 2px 0 0;
}

.mail-summary :deep(.n-tag) {
  max-width: 100%;
}

.mail-summary :deep(.n-tag__content) {
  min-width: 0;
}

/* Client-side detected code: compact mono chip, one click copies. */
.mail-summary-code {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  color: var(--app-accent);
  background: var(--app-accent-soft);
  border: 1px solid var(--app-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.mail-summary-code:hover {
  border-color: var(--app-accent);
}

.mail-summary-code__value {
  font-weight: 600;
  letter-spacing: 0.08em;
}

.mail-summary-code__glyph {
  color: var(--app-text-3);
}
</style>
