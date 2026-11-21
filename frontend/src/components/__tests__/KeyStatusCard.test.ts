// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import i18n from '@/i18n'
import KeyStatusCard from '../KeyStatusCard.vue'

type PasskeyState = 'yes' | 'no' | 'not-logged-in' | 'not-bound'

const renderCard = async (props: {
    hasKey?: boolean
    hasPassphraseBackup?: boolean
    passkeyBackupState?: PasskeyState
}) => {
    const app = createSSRApp({
        render: () => h(KeyStatusCard, {
            hasKey: false,
            hasPassphraseBackup: false,
            passkeyBackupState: 'no',
            ...props,
        }),
    })
    app.use(i18n)
    return await renderToString(app)
}

describe('KeyStatusCard.vue', () => {
    beforeEach(() => {
        i18n.global.locale.value = 'en'
    })

    it('marks all three rows present and shows no action buttons when everything exists', async () => {
        const html = await renderCard({
            hasKey: true,
            hasPassphraseBackup: true,
            passkeyBackupState: 'yes',
        })
        expect(html).toContain('Key on this device')
        expect(html).toContain('Passphrase backup')
        expect(html).toContain('Passkey backup')
        // One ✓ per row.
        expect(html.match(/✓/g)).toHaveLength(3)
        expect(html).not.toContain('–')
        expect(html).not.toContain('key-status-import-key')
        expect(html).not.toContain('key-status-create-backup')
        expect(html).not.toContain('key-status-add-passkey-backup')
        // The explainer stays even when everything is present.
        expect(html).toContain('Your passkey signs you in. It can only unlock this mailbox after you add a passkey backup here.')
    })

    it('shows a missing mark and one action per row when nothing exists', async () => {
        const html = await renderCard({
            hasKey: false,
            hasPassphraseBackup: false,
            passkeyBackupState: 'no',
        })
        expect(html.match(/–/g)).toHaveLength(3)
        expect(html).not.toContain('✓')
        expect(html).toContain('key-status-import-key')
        expect(html).toContain('Import key backup')
        expect(html).toContain('key-status-create-backup')
        expect(html).toContain('Create backup')
        expect(html).toContain('key-status-add-passkey-backup')
        expect(html).toContain('Add passkey backup')
        expect(html).toContain('Your passkey signs you in.')
    })

    it('mixes states: key present, passphrase backup missing, passkey backup present', async () => {
        const html = await renderCard({
            hasKey: true,
            hasPassphraseBackup: false,
            passkeyBackupState: 'yes',
        })
        expect(html.match(/✓/g)).toHaveLength(2)
        expect(html.match(/–/g)).toHaveLength(1)
        expect(html).not.toContain('key-status-import-key')
        expect(html).toContain('key-status-create-backup')
        expect(html).not.toContain('key-status-add-passkey-backup')
    })

    it('shows the sign-in hint and button when the user is not logged in', async () => {
        const html = await renderCard({
            hasKey: true,
            hasPassphraseBackup: true,
            passkeyBackupState: 'not-logged-in',
        })
        expect(html).toContain('sign in to use passkey backups')
        expect(html).toContain('key-status-sign-in')
        expect(html).toContain('Sign in')
        expect(html).not.toContain('key-status-add-passkey-backup')
        expect(html).not.toContain('key-status-link-mailbox')
        expect(html.match(/–/g)).toHaveLength(1)
    })

    it('shows the link-mailbox hint and button when the address is not bound', async () => {
        const html = await renderCard({
            hasKey: true,
            hasPassphraseBackup: true,
            passkeyBackupState: 'not-bound',
        })
        expect(html).toContain('link this mailbox to your account first')
        expect(html).toContain('key-status-link-mailbox')
        expect(html).toContain('Link mailbox')
        expect(html).not.toContain('key-status-sign-in')
        expect(html.match(/–/g)).toHaveLength(1)
    })

    it('renders the rows and explainer in Chinese', async () => {
        i18n.global.locale.value = 'zh'
        const html = await renderCard({
            hasKey: false,
            hasPassphraseBackup: false,
            passkeyBackupState: 'not-logged-in',
        })
        expect(html).toContain('此设备上的密钥')
        expect(html).toContain('密码短语备份')
        expect(html).toContain('通行密钥备份')
        expect(html).toContain('登录后可使用通行密钥备份')
        expect(html).toContain('通行密钥用于登录。只有在此邮箱添加通行密钥备份后，它才能解锁此邮箱。')
    })
})
