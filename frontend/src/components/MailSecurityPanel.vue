<script setup>
import { computed } from 'vue';
import { useScopedI18n } from '@/i18n/app'
import { authStatusCategory, getAuthScore } from '../utils/mail-auth';

const { t } = useScopedI18n('components.MailContentRenderer')

const props = defineProps({
  security: {
    type: Object,
    required: true
  }
});

const score = computed(() => getAuthScore(props.security));

const headline = computed(() => {
  if (score.value.reported === 0) return t('authNotReported');
  if (score.value.failed > 0) {
    return t('authScoreFailed', {
      passed: score.value.passed,
      total: score.value.reported,
      failed: score.value.failed,
    });
  }
  return t('authScorePassed', { passed: score.value.passed, total: score.value.reported });
});

const markFor = (category) => category === 'pass' ? '✓' : category === 'fail' ? '✕' : '–';

const resultKey = (status) => 'result' + status.replace(/(^|\s)(\w)/g, (_match, _sep, chr) => chr.toUpperCase());

const badges = computed(() => {
  const checks = props.security.checks;
  const list = [
    { id: 'spf', status: checks.spf.status },
    { id: 'dkim', status: checks.dkim.status },
    { id: 'dmarc', status: checks.dmarc.status },
  ];
  if (props.security.tls) {
    list.push({ id: 'tls', status: 'pass', label: props.security.tls.version || 'TLS' });
  }
  if (checks.arc.status !== 'not reported') list.push({ id: 'arc', status: checks.arc.status });
  if (checks.iprev.status !== 'not reported') {
    list.push({ id: 'iprev', status: checks.iprev.status, label: 'rDNS' });
  }
  return list.map((badge) => {
    const category = authStatusCategory(badge.status);
    return {
      ...badge,
      category,
      mark: markFor(category),
      label: badge.label || badge.id.toUpperCase(),
      tip: `${t(`${badge.id}Tip`)} · ${t(resultKey(badge.status))}`,
    };
  });
});

const tlsLine = computed(() => {
  const tls = props.security.tls;
  if (!tls) return t('tlsNotReported');
  return [tls.version || 'TLS', tls.cipher].filter(Boolean).join(' · ');
});

const note = computed(() => props.security.authservId
  ? t('authNoteTrusted', { server: props.security.authservId })
  : t('authNoteUntrusted'));
</script>

<template>
  <div class="mail-security-panel">
    <p class="security-headline">{{ headline }}</p>
    <div class="security-badges">
      <n-tooltip v-for="badge in badges" :key="badge.id" placement="top">
        <template #trigger>
          <span class="auth-badge" :class="`auth-badge--${badge.category}`">
            <span class="auth-badge-mark">{{ badge.mark }}</span>{{ badge.label }}
          </span>
        </template>
        {{ badge.tip }}
      </n-tooltip>
    </div>
    <p class="security-tls">{{ tlsLine }}</p>
    <p class="security-note">{{ note }}</p>
  </div>
</template>

<style scoped>
.mail-security-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.security-headline {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-1);
}

.security-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.auth-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}

.auth-badge-mark {
  font-size: 10px;
}

.auth-badge--pass {
  color: var(--app-success);
  border-color: color-mix(in srgb, var(--app-success) 40%, transparent);
  background: var(--app-success-soft);
}

.auth-badge--fail {
  color: var(--app-danger);
  border-color: color-mix(in srgb, var(--app-danger) 40%, transparent);
  background: var(--app-danger-soft);
}

.auth-badge--warn {
  color: var(--app-warning);
  border-color: color-mix(in srgb, var(--app-warning) 40%, transparent);
  background: var(--app-warning-soft);
}

.auth-badge--muted {
  color: var(--app-text-3);
}

.security-tls {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--app-text-3);
  overflow-wrap: anywhere;
}

.security-note {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--app-text-3);
  overflow-wrap: anywhere;
}
</style>
