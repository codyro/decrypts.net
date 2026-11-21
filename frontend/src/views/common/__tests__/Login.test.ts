// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, ref } from 'vue'

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

// jsdom under vitest has no working localStorage (Node's experimental storage
// is disabled), so stub a minimal in-memory one. Login.vue reads the saved
// mailbox cache (LocalAddressCache) straight from localStorage.
const localStorageStub = (() => {
    let store: Record<string, string> = {}
    return {
        getItem: (key: string) => (key in store ? store[key] : null),
        setItem: (key: string, value: string) => { store[key] = String(value) },
        removeItem: (key: string) => { delete store[key] },
        clear: () => { store = {} },
    }
})()

vi.mock('@/store', () => ({
    useGlobalState: () => ({
        openSettings: stubs.openSettings,
        jwt: ref(''),
        loading: ref(false),
        settings: ref({ fetched: false, address: '' }),
        userSettings: ref({ user_email: '', user_role: null }),
        showAddressCredential: ref(false),
        addressPassword: ref(''),
        showUserSystem: computed(() => stubs.openSettings.value.fetched
            && !stubs.openSettings.value.disableUserSystem),
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

// The register tab is the default when creation is available and the first
// tab in DOM order; its pane is already mounted. This helper is a no-op in
// that case and only re-clicks it defensively in tests where another tab
// starts active.
const openRegisterTab = async (el: HTMLElement) => {
    const tabs = el.querySelectorAll<HTMLElement>('.n-tabs-tab')
    tabs[0]?.click()
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

describe('Login.vue initial tab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18n.global.locale.value = 'en'
        localStorageStub.clear()
        vi.stubGlobal('localStorage', localStorageStub)
    })

    it('orders the tabs: create first, then login, then help', async () => {
        stubs.openSettings = makeOpenSettings({ enableUserCreateEmail: true })
        const el = await mountLogin()
        const tabs = [...el.querySelectorAll<HTMLElement>('.n-tabs-tab')]
            .map((tab) => tab.textContent?.trim() || '')
        expect(tabs).toEqual(['Create Email Address', 'Log In to Mailbox', 'Help'])
    })

    it('opens the create tab when address creation is available and nothing is cached', async () => {
        stubs.openSettings = makeOpenSettings({ enableUserCreateEmail: true })
        const el = await mountLogin()
        const paneText = el.querySelector('.n-tab-pane')?.textContent || ''
        expect(paneText).toContain('You can choose a domain from the dropdown list.')
        expect(paneText).not.toContain('Email Address Credential')
    })

    it('opens the login tab when saved mailboxes exist, even if creation is available', async () => {
        localStorageStub.setItem('LocalAddressCache', JSON.stringify(['cached-jwt']))
        stubs.openSettings = makeOpenSettings({ enableUserCreateEmail: true })
        const el = await mountLogin()
        const paneText = el.querySelector('.n-tab-pane')?.textContent || ''
        expect(paneText).toContain('Email Address Credential')
        expect(paneText).not.toContain('You can choose a domain from the dropdown list.')
    })

    it('does not override a tab the user already clicked', async () => {
        stubs.openSettings = makeOpenSettings({ enableUserCreateEmail: true })
        const el = await mountLogin()
        // The user switches to Help; then the operator settings change so
        // creation would no longer be offered. The default-tab watch fires
        // again, but the user's choice must win.
        const tabs = el.querySelectorAll<HTMLElement>('.n-tabs-tab')
        tabs[2]?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
        stubs.openSettings.value = { ...stubs.openSettings.value, enableUserCreateEmail: false }
        await new Promise((resolve) => setTimeout(resolve, 0))
        const paneText = el.querySelector('.n-tab-pane')?.textContent || ''
        expect(paneText).toContain('How it works')
        expect(paneText).not.toContain('Email Address Credential')
    })

    it('opens the login tab when address creation is unavailable', async () => {
        stubs.openSettings = makeOpenSettings({ enableUserCreateEmail: false })
        const el = await mountLogin()
        const paneText = el.querySelector('.n-tab-pane')?.textContent || ''
        expect(paneText).toContain('Email Address Credential')
        expect(paneText).not.toContain('You can choose a domain from the dropdown list.')
    })

    it('opens the login tab when anonymous creation is disabled and no user is signed in', async () => {
        stubs.openSettings = makeOpenSettings({ disableAnonymousUserCreateEmail: true })
        const el = await mountLogin()
        const paneText = el.querySelector('.n-tab-pane')?.textContent || ''
        expect(paneText).toContain('Email Address Credential')
    })
})

describe('Login.vue passkey login button', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18n.global.locale.value = 'en'
        localStorageStub.clear()
        vi.unstubAllGlobals()
        vi.stubGlobal('localStorage', localStorageStub)
        // navigator.credentials is set with defineProperty (not tracked by
        // vitest's stubGlobal): remove it so each test starts WebAuthn-free.
        delete (window.navigator as { credentials?: unknown }).credentials
    })

    const stubWebAuthn = () => {
        vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() { })
        Object.defineProperty(window.navigator, 'credentials', {
            value: {},
            configurable: true,
        })
    }

    const openSigninPane = async (el: HTMLElement) => {
        // Saved mailboxes make the Login tab the default; otherwise click it.
        const tabs = el.querySelectorAll<HTMLElement>('.n-tabs-tab')
        tabs[1]?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
    }

    it('shows "Log in with passkey" when the user system is on and WebAuthn works', async () => {
        stubWebAuthn()
        stubs.openSettings = makeOpenSettings({ disableUserSystem: false })
        const el = await mountLogin()
        await openSigninPane(el)
        const button = el.querySelector('[data-testid="passkey-login-button"]')
        expect(button).toBeTruthy()
        expect(el.textContent).toContain('Signs you in to your passkey account and opens its linked mailboxes.')
    })

    it('hides the button when the user system is disabled', async () => {
        stubWebAuthn()
        stubs.openSettings = makeOpenSettings({ disableUserSystem: true })
        const el = await mountLogin()
        await openSigninPane(el)
        expect(el.querySelector('[data-testid="passkey-login-button"]')).toBeNull()
    })

    it('hides the button when the browser has no WebAuthn', async () => {
        // jsdom has neither PublicKeyCredential nor navigator.credentials.
        stubs.openSettings = makeOpenSettings({ disableUserSystem: false })
        const el = await mountLogin()
        await openSigninPane(el)
        expect(el.querySelector('[data-testid="passkey-login-button"]')).toBeNull()
    })

    it('shows the passkey explainer in the help tab only when the user system is on', async () => {
        stubWebAuthn()
        stubs.openSettings = makeOpenSettings({ disableUserSystem: false })
        const el = await mountLogin()
        const tabs = el.querySelectorAll<HTMLElement>('.n-tabs-tab')
        tabs[2]?.click()
        await new Promise((resolve) => setTimeout(resolve, 0))
        const text = el.textContent || ''
        expect(text).toContain('Passkeys')
        expect(text).toContain('Sign in.')
        expect(text).toContain('Open your mailboxes.')
        expect(text).toContain('Unlock encrypted mail.')
    })
})

describe('Login.vue help tab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18n.global.locale.value = 'en'
    })

    it('renders the numbered quick-start steps', async () => {
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
        // Steps come from the shared HowItWorks component.
        expect(text).toContain('One click, or pick your own name. No account needed.')
        expect(text).toContain('Verification codes and links are detected for one-click copy.')
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
