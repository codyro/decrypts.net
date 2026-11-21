// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import i18n from '@/i18n'
import PasskeyHowItWorks from '../PasskeyHowItWorks.vue'

const stubs = vi.hoisted(() => ({
    openSettings: { enableIndexAbout: false },
}))

vi.mock('@/store', () => ({
    useGlobalState: () => ({
        openSettings: stubs.openSettings,
    }),
}))

type Situation = {
    signedIn?: boolean | null
    linked?: boolean | null
    hasPasskeyBackup?: boolean | null
    encrypted?: boolean | null
}

const renderStrip = async (props: Situation = {}) => {
    const app = createSSRApp({
        render: () => h(PasskeyHowItWorks, {
            signedIn: null,
            linked: null,
            hasPasskeyBackup: null,
            encrypted: null,
            ...props,
        }),
    })
    app.use(i18n)
    return await renderToString(app)
}

describe('PasskeyHowItWorks.vue', () => {
    beforeEach(() => {
        stubs.openSettings.enableIndexAbout = false
        i18n.global.locale.value = 'en'
    })

    it('renders the three numbered steps without status lines when no situation is given', async () => {
        const html = await renderStrip()
        expect(html).toContain('01')
        expect(html).toContain('02')
        expect(html).toContain('03')
        expect(html).toContain('Sign in.')
        expect(html).toContain('Your passkey signs you in to a private account. No email or password needed.')
        expect(html).toContain('Open your mailboxes.')
        expect(html).toContain('Mailboxes linked to that account open with your passkey.')
        expect(html).toContain('Unlock encrypted mail.')
        expect(html).toContain('Only for mailboxes that have a passkey backup.')
        // No situation props -> no ✓/– status lines at all.
        expect(html).not.toContain('✓')
        expect(html).not.toContain('–')
    })

    it('marks every step done for a fully set up encrypted mailbox', async () => {
        const html = await renderStrip({
            signedIn: true,
            linked: true,
            hasPasskeyBackup: true,
            encrypted: true,
        })
        expect(html.match(/✓/g)).toHaveLength(3)
        expect(html).not.toContain('–')
        expect(html).toContain('Signed in')
        expect(html).toContain('Linked to your account')
        expect(html).toContain('Passkey backup added')
    })

    it('marks everything missing for a fresh signed-out visitor with an encrypted mailbox', async () => {
        const html = await renderStrip({
            signedIn: false,
            linked: false,
            hasPasskeyBackup: false,
            encrypted: true,
        })
        expect(html.match(/–/g)).toHaveLength(3)
        expect(html).not.toContain('✓')
        expect(html).toContain('Not signed in yet')
        expect(html).toContain('No mailbox linked yet')
        expect(html).toContain('No passkey backup yet')
    })

    it('mixes states: signed in and linked, but no passkey backup yet', async () => {
        const html = await renderStrip({
            signedIn: true,
            linked: true,
            hasPasskeyBackup: false,
            encrypted: true,
        })
        expect(html.match(/✓/g)).toHaveLength(2)
        expect(html.match(/–/g)).toHaveLength(1)
        expect(html).toContain('No passkey backup yet')
    })

    it('says step 3 is not needed for an unencrypted mailbox instead of counting it as missing', async () => {
        const html = await renderStrip({
            signedIn: true,
            linked: true,
            hasPasskeyBackup: false,
            encrypted: false,
        })
        expect(html.match(/✓/g)).toHaveLength(2)
        // Marked neither ✓ nor –: the step simply does not apply.
        expect(html).not.toContain('–')
        expect(html).toContain('Not needed — this mailbox isn&#39;t encrypted')
    })

    it('hides partial situation: only signed in is known', async () => {
        const html = await renderStrip({ signedIn: true })
        expect(html.match(/✓/g)).toHaveLength(1)
        expect(html).toContain('Signed in')
        // Steps 2 and 3 show no status at all.
        expect(html).not.toContain('Not signed in yet')
        expect(html).not.toContain('No mailbox linked yet')
        expect(html).not.toContain('No passkey backup yet')
    })

    it('shows the Learn more footer only when the About page is enabled', async () => {
        stubs.openSettings.enableIndexAbout = false
        expect(await renderStrip()).not.toContain('Learn more')
        stubs.openSettings.enableIndexAbout = true
        const html = await renderStrip()
        expect(html).toContain('Learn more')
        expect(html).toContain('phiw-learn-more')
    })

    it('renders the steps and statuses in Chinese', async () => {
        i18n.global.locale.value = 'zh'
        const html = await renderStrip({
            signedIn: true,
            linked: false,
            hasPasskeyBackup: false,
            encrypted: true,
        })
        expect(html).toContain('登录。')
        expect(html).toContain('打开你的邮箱。')
        expect(html).toContain('解锁加密邮件。')
        expect(html).toContain('已登录')
        expect(html).toContain('尚未绑定邮箱')
        expect(html).toContain('还没有通行密钥备份')
    })
})
