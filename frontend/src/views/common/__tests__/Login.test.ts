// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, ref } from 'vue'

import i18n from '@/i18n'
import Login from '../Login.vue'

const message = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }
const notification = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }

vi.mock('naive-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('naive-ui')>()
    return {
        ...actual,
        useMessage: () => message,
        useNotification: () => notification,
    }
})

vi.mock('@/api', () => ({
    api: {
        fetch: vi.fn(),
        getSettings: vi.fn(),
        getOpenSettings: vi.fn(),
        bindUserAddress: vi.fn(),
    },
}))

const makeOpenSettings = (overrides: Record<string, unknown> = {}) => ref({
    fetched: true,
    title: 'Temp Mail',
    announcement: '',
    prefix: '',
    addressRegex: '',
    minAddressLen: 1,
    maxAddressLen: 30,
    needAuth: false,
    adminContact: '',
    defaultDomains: null,
    randomSubdomainDomains: [],
    domains: [{ label: 'test.com', value: 'test.com' }],
    disableUserSystem: false,
    enableUserCreateEmail: true,
    disableAnonymousUserCreateEmail: false,
    disableCustomAddressName: false,
    enableMailEncryption: true,
    defaultMailEncryption: false,
    enableGlobalTurnstileCheck: false,
    enableRedeemCode: false,
    enableAddressPassword: false,
    addressPasswordLoginOnly: false,
    enableIndexAbout: true,
    ...overrides,
})

const stubs = vi.hoisted(() => ({
    openSettings: null as unknown as ReturnType<typeof makeOpenSettings>,
}))

vi.mock('@/store', () => ({
    useGlobalState: () => ({
        openSettings: stubs.openSettings,
        jwt: ref(''),
        loading: ref(false),
        settings: ref({ fetched: false, address: '' }),
        userSettings: ref({ user_email: '', user_role: null }),
        showAddressCredential: ref(false),
        addressPassword: ref(''),
    }),
}))

const mountLogin = async () => {
    const app = createApp(Login)
    app.use(i18n)
    const el = document.createElement('div')
    document.body.appendChild(el)
    app.mount(el)
    await new Promise((resolve) => setTimeout(resolve, 0))
    return el
}

// The register tab is the second tab; its pane only mounts after activation.
const openRegisterTab = async (el: HTMLElement) => {
    const tabs = el.querySelectorAll<HTMLElement>('.n-tabs-tab')
    tabs[1]?.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('Login.vue mail encryption default', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18n.global.locale.value = 'en'
    })

    it('starts checked when defaultMailEncryption is true', async () => {
        stubs.openSettings = makeOpenSettings({ defaultMailEncryption: true })
        const el = await mountLogin()
        await openRegisterTab(el)
        const checkbox = el.querySelector('.n-tab-pane .n-checkbox')
        expect(checkbox).toBeTruthy()
        expect(checkbox?.classList.contains('n-checkbox--checked')).toBe(true)
        // The save-your-key warning must still show next to the checked box.
        expect(el.querySelector('.n-tab-pane')?.textContent)
            .toContain('If you lose it, encrypted mail cannot be recovered')
    })

    it('starts unchecked when defaultMailEncryption is false', async () => {
        stubs.openSettings = makeOpenSettings({ defaultMailEncryption: false })
        const el = await mountLogin()
        await openRegisterTab(el)
        const checkbox = el.querySelector('.n-tab-pane .n-checkbox')
        expect(checkbox).toBeTruthy()
        expect(checkbox?.classList.contains('n-checkbox--checked')).toBe(false)
    })

    it('keeps the user choice once the form is shown', async () => {
        stubs.openSettings = makeOpenSettings({ defaultMailEncryption: true })
        const el = await mountLogin()
        await openRegisterTab(el)
        const checkbox = el.querySelector<HTMLElement>('.n-tab-pane .n-checkbox')
        expect(checkbox?.classList.contains('n-checkbox--checked')).toBe(true)
        // Simulate the user unchecking, then re-applying settings: the watch
        // must not flip the box back on.
        checkbox?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(el.querySelector('.n-tab-pane .n-checkbox')
            ?.classList.contains('n-checkbox--checked')).toBe(false)
        stubs.openSettings.value = { ...stubs.openSettings.value }
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(el.querySelector('.n-tab-pane .n-checkbox')
            ?.classList.contains('n-checkbox--checked')).toBe(false)
    })
})

describe('Login.vue help tab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18n.global.locale.value = 'en'
    })

    it('renders the numbered quick-start with real tab labels', async () => {
        stubs.openSettings = makeOpenSettings({ enableMailEncryption: false })
        const el = await mountLogin()
        const tabs = el.querySelectorAll<HTMLElement>('.n-tabs-tab')
        tabs[2]?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
        const text = el.textContent || ''
        expect(text).toContain('How it works')
        expect(text).toContain('01')
        expect(text).toContain('02')
        expect(text).toContain('03')
        // Steps reference the actual tab labels, not hard-coded strings.
        expect(text).toContain('Open the "Create Email Address" tab')
        expect(text).toContain('Paste your credential in the "Log In to Mailbox" tab')
        // Encryption block hidden when the feature is off.
        expect(text).not.toContain('Encrypted mail can only be read')
    })

    it('warns about encrypted mailboxes when encryption is enabled', async () => {
        stubs.openSettings = makeOpenSettings({
            enableMailEncryption: true,
            defaultMailEncryption: true,
        })
        const el = await mountLogin()
        const tabs = el.querySelectorAll<HTMLElement>('.n-tabs-tab')
        tabs[2]?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
        const text = el.textContent || ''
        expect(text).toContain('Encrypted mailboxes.')
        expect(text).toContain('Encrypted mail can only be read')
        expect(text).toContain('nobody can recover your mail')
        expect(text).toContain('for what encryption does and doesn')
    })
})
