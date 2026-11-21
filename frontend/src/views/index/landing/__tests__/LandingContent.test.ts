// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, toRef, createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import i18n from '@/i18n'
import LandingContent from '../LandingContent.vue'

const state = reactive({
    jwt: '',
    isTelegram: false,
    openSettings: {
        fetched: true,
        enableMailEncryption: false,
        enableIndexAbout: true,
        retention: undefined as unknown,
    },
})

// Real refs (template auto-unwrap + .value) bound to the reactive state.
vi.mock('@/store', () => ({
    useGlobalState: () => ({
        get jwt() { return toRef(state, 'jwt') },
        get isTelegram() { return toRef(state, 'isTelegram') },
        get openSettings() { return toRef(state, 'openSettings') },
    }),
}))

const renderLanding = async () => {
    const app = createSSRApp(LandingContent)
    app.use(i18n)
    return await renderToString(app)
}

describe('LandingContent.vue', () => {
    beforeEach(() => {
        state.jwt = ''
        state.isTelegram = false
        state.openSettings.enableMailEncryption = false
        state.openSettings.enableIndexAbout = true
        state.openSettings.retention = undefined
        i18n.global.locale.value = 'en'
    })

    it('renders the hero, steps, features and FAQ when there is no mailbox', async () => {
        const html = await renderLanding()
        // Hero (the eyebrow is uppercased by CSS, so the markup is sentence case)
        expect(html).toContain('Disposable')
        expect(html).toContain('A burner inbox, ready in one click.')
        expect(html).toContain('Get an address in one click, no sign-up.')
        // Steps
        expect(html).toContain('How it works')
        expect(html).toContain('Get a disposable address in three steps.')
        expect(html).toContain('Step 1')
        expect(html).toContain('Copy the code, then ghost')
        // Features
        expect(html).toContain('Built for privacy')
        expect(html).toContain('One-click codes')
        expect(html).toContain('Burn mailbox')
        expect(html).toContain('https://github.com/codyro/decrypts.net')
        expect(html).toContain('rel="noopener noreferrer"')
        // FAQ
        expect(html).toContain('FAQ')
        expect(html).toContain('Do I need an account?')
        expect(html).toContain('More in About')
    })

    it('hides the encryption-only steps, features and FAQ items when encryption is off', async () => {
        state.openSettings.enableMailEncryption = false
        const html = await renderLanding()
        expect(html).toContain('Mail arrives in seconds')
        expect(html).not.toContain('Mail arrives encrypted')
        expect(html).not.toContain('Encrypted at rest')
        expect(html).not.toContain('Key backups')
        expect(html).not.toContain('Is this end-to-end encrypted?')
        expect(html).not.toContain('Can you read my mail?')
        expect(html).not.toContain('What if I lose my key?')
        expect(html).not.toContain('Does my passkey decrypt my mail?')
    })

    it('shows the encryption-only items and copy when encryption is on', async () => {
        state.openSettings.enableMailEncryption = true
        const html = await renderLanding()
        expect(html).toContain('Disposable · Encrypted at rest')
        expect(html).toContain('A burner inbox with a key only your browser holds.')
        expect(html).toContain('Mail arrives encrypted')
        expect(html).toContain('Encrypted at rest')
        expect(html).toContain('Key backups')
        expect(html).toContain('Is this end-to-end encrypted?')
        expect(html).toContain('Can you read my mail?')
        expect(html).toContain('Does my passkey decrypt my mail?')
        // The first item starts expanded, so its answer is in the DOM.
        expect(html).toContain('It protects mail while it')
        i18n.global.locale.value = 'zh'
        const zhHtml = await renderLanding()
        expect(zhHtml).toContain('我的通行密钥能解密邮件吗？')
    })

    it('shows the retention FAQ with correct plurals when retention.mailsDays = 7', async () => {
        state.openSettings.retention = { mailsDays: 7, inactiveAddressDays: 30 }
        const html = await renderLanding()
        expect(html).toContain('How long is mail kept?')
        expect(html).toContain('Mail is deleted automatically after 7 days.')
        expect(html).toContain('Addresses unused for 30 days are removed.')
        i18n.global.locale.value = 'zh'
        const zhHtml = await renderLanding()
        expect(zhHtml).toContain('邮件会保留多久？')
        expect(zhHtml).toContain('邮件会在 7 天后被自动删除。')
    })

    it('omits the retention FAQ and hero note without retention settings', async () => {
        const html = await renderLanding()
        expect(html).not.toContain('How long is mail kept?')
        expect(html).not.toContain('Mail is deleted automatically after')
    })

    it('renders nothing of the landing extras when a mailbox JWT is present', async () => {
        state.jwt = 'stored-credential'
        const html = await renderLanding()
        expect(html).not.toContain('A burner inbox')
        expect(html).not.toContain('How it works')
        expect(html).not.toContain('Built for privacy')
        expect(html).not.toContain('FAQ')
    })

    it('renders nothing of the landing extras in the Telegram mini-app', async () => {
        state.isTelegram = true
        const html = await renderLanding()
        expect(html).not.toContain('A burner inbox')
        expect(html).not.toContain('How it works')
        expect(html).not.toContain('FAQ')
    })
})
