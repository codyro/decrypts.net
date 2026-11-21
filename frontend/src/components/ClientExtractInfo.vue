<script setup>
import { computed } from 'vue';
import { useMessage } from 'naive-ui';
import { ContentCopyOutlined, CodeRound, LinkRound } from '@vicons/material';
import { useScopedI18n } from '@/i18n/app';
import { useGlobalState } from '../store';
import { copyToClipboard } from '../utils/clipboard';
import { extractCodesAndLinks } from '../utils/extract-codes';

// Client-side replacement for the server AI extraction (AiExtractInfo), which
// is skipped for encrypted mail. Runs only in the browser, on the already
// decrypted/parsed mail; nothing is sent anywhere.
const props = defineProps({
  mail: {
    type: Object,
    required: true
  }
});

const message = useMessage();
const { detectVerificationCodes } = useGlobalState();
// Reuse the AiExtractInfo copy so both extractions read identically.
const { t } = useScopedI18n('components.AiExtractInfo');

const serverExtract = computed(() => {
  if (!props.mail.metadata) return null;
  try {
    return JSON.parse(props.mail.metadata).ai_extract || null;
  } catch {
    return null;
  }
});

const extracted = computed(() => {
  if (!detectVerificationCodes.value) return { codes: [], links: [] };
  if (props.mail.locked) return { codes: [], links: [] };
  // Encrypted mail is never server-extracted; for plaintext mail only fill in
  // when the server left no ai_extract metadata.
  if (!props.mail.encrypted && serverExtract.value) return { codes: [], links: [] };
  return extractCodesAndLinks({
    subject: props.mail.subject,
    text: props.mail.text,
    html: props.mail.message
  });
});

const linkHost = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const copyCode = async (code) => {
  try {
    await copyToClipboard(code);
    message.success(t('copySuccess'));
  } catch {
    message.error(t('copyFailed'));
  }
};
</script>

<template>
  <div v-if="extracted.codes.length || extracted.links.length" class="client-extract">
    <div v-if="extracted.codes.length" class="client-extract__group">
      <span class="client-extract__label">{{ t('authCode') }}</span>
      <button v-for="code in extracted.codes" :key="code" type="button" class="code-chip"
        :title="t('copySuccess')" @click="copyCode(code)">
        <n-icon :component="CodeRound" />
        <span class="code-chip__value">{{ code }}</span>
        <n-icon :component="ContentCopyOutlined" />
      </button>
    </div>
    <div v-if="extracted.links.length" class="client-extract__group">
      <span class="client-extract__label">{{ t('authLink') }}</span>
      <a v-for="link in extracted.links" :key="link.url" class="extract-link" :href="link.url" target="_blank"
        rel="noopener noreferrer" :title="link.url">
        <n-icon :component="LinkRound" />
        <span class="extract-link__host">{{ linkHost(link.url) }}</span>
        <span v-if="link.label" class="extract-link__text">{{ link.label }}</span>
      </a>
    </div>
  </div>
</template>

<style scoped>
.client-extract {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--app-accent-soft);
  border: 1px solid var(--app-border);
  border-radius: var(--radius-md);
}

.client-extract__group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.client-extract__label {
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--app-text-3);
}

.code-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  font-family: var(--font-mono);
  font-size: var(--font-md);
  color: var(--app-accent);
  background: var(--app-surface-raised);
  border: 1px solid var(--app-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.code-chip:hover {
  border-color: var(--app-accent);
}

.code-chip__value {
  font-weight: 600;
  letter-spacing: 0.08em;
}

.extract-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 3px 8px;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  color: var(--app-accent);
  background: var(--app-surface-raised);
  border: 1px solid var(--app-border);
  border-radius: var(--radius-sm);
  text-decoration: none;
}

.extract-link:hover {
  border-color: var(--app-accent);
  text-decoration: underline;
}

.extract-link__host {
  font-weight: 600;
}

.extract-link__text {
  overflow: hidden;
  color: var(--app-text-3);
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}
</style>
