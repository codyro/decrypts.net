<script setup>
import { computed } from 'vue';
import { useScopedI18n } from '@/i18n/app';

// Terminal help screen listing the mailbox keyboard shortcuts. Purely
// presentational; all actions live in MailBox.vue.
defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:show']);

const { t } = useScopedI18n('components.ShortcutsOverlay');

const shortcuts = computed(() => [
  { keys: ['c'], action: 'copyAddress' },
  { keys: ['r'], action: 'refresh' },
  { keys: ['j', 'k'], action: 'nextPrev' },
  { keys: ['Enter', 'o'], action: 'openMail' },
  { keys: ['Esc'], action: 'closeMail' },
  { keys: ['/'], action: 'focusFilter' },
  { keys: ['?'], action: 'showShortcuts' }
]);
</script>

<template>
  <n-modal :show="show" preset="card" :title="t('title')" :bordered="false" class="shortcuts-overlay"
    style="width: min(420px, calc(100vw - 32px));" @update:show="emit('update:show', $event)">
    <ul class="shortcuts-list">
      <li v-for="item in shortcuts" :key="item.action" class="shortcuts-row">
        <span class="shortcuts-keys">
          <kbd v-for="key in item.keys" :key="key" class="shortcut-key">{{ key }}</kbd>
        </span>
        <span class="shortcuts-desc">{{ t(item.action) }}</span>
      </li>
    </ul>
    <p class="shortcuts-foot">{{ t('disabledInInputs') }}</p>
  </n-modal>
</template>

<style scoped>
.shortcuts-overlay :deep(.n-card-header__title) {
  font-family: var(--font-mono);
}

.shortcuts-overlay :deep(.n-card-header__title)::before {
  content: '>_';
  margin-right: var(--space-2);
  color: var(--app-accent);
  font-weight: 500;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.shortcuts-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.shortcuts-keys {
  display: inline-flex;
  gap: var(--space-1);
}

.shortcut-key {
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: var(--font-sm);
  color: var(--app-text-1);
  background: var(--app-surface-raised);
  border: 1px solid var(--app-border);
  border-bottom-width: 2px;
  border-radius: var(--radius-sm);
}

.shortcuts-desc {
  font-size: var(--font-md);
  color: var(--app-text-2);
  text-align: right;
}

.shortcuts-foot {
  margin: var(--space-4) 0 0;
  font-size: var(--font-xs);
  color: var(--app-text-3);
}
</style>
