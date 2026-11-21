<script setup>
import { computed } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { humanFileSize } from '../utils/email-parser';

const { t } = useScopedI18n('components.MailContentRenderer')

const props = defineProps({
  delivery: {
    type: Object,
    required: true
  },
  mail: {
    type: Object,
    required: true
  }
});

const byteSize = computed(() => {
  if (typeof props.mail.raw !== 'string' || props.mail.raw.length === 0) return null;
  return new TextEncoder().encode(props.mail.raw).length;
});

const sendingServer = computed(() => {
  const server = props.delivery.sendingServer;
  if (!server) return null;
  return server.ip ? `${server.host} (${server.ip})` : server.host;
});

const rows = computed(() => {
  const list = [];
  if (props.delivery.messageId) {
    list.push({ label: 'Message-ID', value: props.delivery.messageId, mono: true });
  }
  if (props.delivery.returnPath) {
    list.push({ label: 'Return-Path', value: props.delivery.returnPath, mono: true });
  }
  if (props.delivery.replyTo) {
    list.push({ label: 'Reply-To', value: props.delivery.replyTo, mono: true });
  }
  if (sendingServer.value) {
    list.push({ label: t('sendingServer'), value: sendingServer.value });
  }
  if (props.delivery.hopCount > 0) {
    list.push({ label: t('hops'), value: String(props.delivery.hopCount) });
  }
  if (byteSize.value !== null) {
    list.push({ label: t('size'), value: humanFileSize(byteSize.value) });
  }
  const attachmentCount = props.mail.attachments?.length || 0;
  if (attachmentCount > 0) {
    list.push({ label: t('attachments'), value: String(attachmentCount) });
  }
  return list;
});
</script>

<template>
  <div class="mail-delivery-panel">
    <div class="delivery-grid">
      <template v-for="row in rows" :key="row.label">
        <span class="mail-address-label">{{ row.label }}</span>
        <span class="delivery-value" :class="{ 'delivery-value--mono': row.mono }">{{ row.value }}</span>
      </template>
    </div>
    <a v-if="delivery.listUnsubscribe" class="delivery-unsubscribe" :href="delivery.listUnsubscribe"
      target="_blank" rel="noopener noreferrer">
      {{ t('unsubscribe') }}
    </a>
  </div>
</template>

<style scoped>
.mail-delivery-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.delivery-grid {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 4px 8px;
  font-size: 12px;
  line-height: 18px;
}

.mail-address-label {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--app-text-3);
}

.delivery-value {
  color: var(--app-text-2);
  overflow-wrap: anywhere;
  min-width: 0;
}

.delivery-value--mono {
  font-family: var(--font-mono);
  font-size: 11px;
}

.delivery-unsubscribe {
  align-self: flex-start;
  font-size: 12px;
  color: var(--app-accent);
  text-decoration: none;
}

.delivery-unsubscribe:hover {
  text-decoration: underline;
}
</style>
