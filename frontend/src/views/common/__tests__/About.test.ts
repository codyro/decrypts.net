// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'

import i18n from '@/i18n'
import About from '../About.vue'

const stubs = vi.hoisted(() => ({
    openSettings: { enableMailEncryption: false },
    announcement: '',
}))

vi.mock('@/store', () => ({
    useGlobalState: () => ({
        openSettings: stubs.openSettings,
        announcement: { value: stubs.announcement },
    }),
}))

const renderAbout = async () => {
    const app = createSSRApp(About)
    app.use(i18n)
    return await renderToString(app)
}

describe('About.vue', () => {
    beforeEach(() => {
        stubs.openSettings.enableMailEncryption = false
        stubs.announcement = '<p>Scheduled maintenance this weekend.</p>'
        i18n.global.locale.value = 'en'
    })

    it('renders the encryption explainer when enableMailEncryption is true', async () => {
        stubs.openSettings.enableMailEncryption = true
        const html = await renderAbout()
        expect(html).toContain('Encrypted mailboxes')
        expect(html).toContain('What it does')
        expect(html).toContain('What it doesn&#39;t do')
        expect(html).toContain('Your key is your responsibility')
        expect(html).toContain('P-256 ECDH, AES-256-GCM')
        expect(html).toContain('Not audited')
    })

    it('omits the encryption explainer when enableMailEncryption is false', async () => {
        stubs.openSettings.enableMailEncryption = false
        const html = await renderAbout()
        expect(html).not.toContain('Encrypted mailboxes')
        expect(html).not.toContain('What it does')
    })

    it('still renders the announcement and community links either way', async () => {
        stubs.openSettings.enableMailEncryption = true
        const withEncryption = await renderAbout()
        for (const html of [withEncryption, await (stubs.openSettings.enableMailEncryption = false, renderAbout())]) {
            expect(html).toContain('Scheduled maintenance this weekend.')
            expect(html).toContain('Github')
            expect(html).toContain('Discord')
            expect(html).toContain('Telegram')
            expect(html).toContain('https://github.com/dreamhunter2333/cloudflare_temp_email')
        }
    })
})
