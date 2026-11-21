<script setup>
/**
 * "Log in with passkey" trigger for the mailbox card's Login tab.
 *
 * The click runs the shared flow (utils/passkey-mailbox-login.js); the
 * picker / "no linked mailboxes" UI renders in PasskeyMailboxLoginHost at
 * app level, because a successful sign-in swaps the landing page from this
 * card to the user's address list and would unmount anything rendered here.
 *
 * Visibility is decided by the host with canOfferPasskeyMailboxLogin() (user
 * system on + WebAuthn available), mirroring the user-center passkey login.
 * The copy under the button stays honest: the passkey signs you in, it does
 * not decrypt mail — only a passkey backup can unlock an encrypted mailbox.
 */
import { useScopedI18n } from '@/i18n/app'
import { KeyFilled } from '@vicons/material'

import { passkeyLoginFlow, startPasskeyMailboxLogin } from '../utils/passkey-mailbox-login'

const { t } = useScopedI18n('components.PasskeyMailboxLogin')
const message = useMessage()

const loginWithPasskey = async () => {
    await startPasskeyMailboxLogin({ message })
}
</script>

<template>
    <div class="pk-mailbox-login" data-testid="passkey-mailbox-login">
        <n-button @click="loginWithPasskey" :loading="passkeyLoginFlow.busy" block secondary
            data-testid="passkey-login-button">
            <template #icon>
                <n-icon :component="KeyFilled" />
            </template>
            {{ t('loginWithPasskey') }}
        </n-button>
        <p class="muted pk-mailbox-login__hint">{{ t('helperLine') }}</p>
    </div>
</template>

<style scoped>
.pk-mailbox-login {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
}

.pk-mailbox-login__hint {
    margin: 0;
    font-size: var(--font-xs);
    line-height: 18px;
}
</style>
