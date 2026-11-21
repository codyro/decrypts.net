import { describe, expect, it } from 'vitest'

import { buildCspPolicy, buildHeadersFile, parseApiBaseOrigin } from '../../vite-plugin-csp.js'

const baseEnv = {
  VITE_API_BASE: '',
  VITE_IS_TELEGRAM: '',
  VITE_CF_WEB_ANALY_TOKEN: '',
  VITE_GOOGLE_AD_CLIENT: '',
}

describe('parseApiBaseOrigin', () => {
  it('returns null for empty or same-origin values', () => {
    expect(parseApiBaseOrigin('')).toBeNull()
    expect(parseApiBaseOrigin(undefined)).toBeNull()
    expect(parseApiBaseOrigin('/api')).toBeNull()
  })

  it('extracts the origin from a full URL, dropping path and query', () => {
    expect(parseApiBaseOrigin('https://api.example.com/mail?x=1')).toBe('https://api.example.com')
    expect(parseApiBaseOrigin('http://worker:8787')).toBe('http://worker:8787')
  })
})

describe('buildCspPolicy', () => {
  it('is disabled when VITE_CSP_DISABLED=true', () => {
    const result = buildCspPolicy({ ...baseEnv, VITE_CSP_DISABLED: 'true' })
    expect(result.enabled).toBe(false)
    expect(result.policy).toBeNull()
  })

  it('builds the default policy without optional origins', () => {
    const { enabled, policy, isTelegram } = buildCspPolicy(baseEnv)
    expect(enabled).toBe(true)
    expect(isTelegram).toBe(false)
    expect(policy).toContain(`default-src 'self'`)
    expect(policy).toContain(
      `script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com`
    )
    expect(policy).not.toContain('telegram.org')
    expect(policy).not.toContain('cloudflareinsights')
    expect(policy).not.toContain('googlesyndication')
    expect(policy).toContain(`style-src 'self' 'unsafe-inline'`)
    expect(policy).toContain(`img-src 'self' data: blob: https:`)
    expect(policy).toContain(`font-src 'self' data:`)
    expect(policy).toContain(`connect-src 'self'`)
    expect(policy).toContain(`frame-src 'self' https://challenges.cloudflare.com`)
    expect(policy).toContain(`worker-src 'self' blob:`)
    expect(policy).toContain(`object-src 'none'`)
    expect(policy).toContain(`base-uri 'self'`)
    expect(policy).toContain(`form-action 'self'`)
    expect(policy).toContain(`manifest-src 'self'`)
    expect(policy).not.toContain(`'unsafe-eval'`)
    // script 'unsafe-inline' is never allowed
    expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/)
    // the meta policy never carries frame-ancestors (meta ignores it)
    expect(policy).not.toContain('frame-ancestors')
  })

  it('adds the API base origin to connect-src', () => {
    const { policy } = buildCspPolicy({ ...baseEnv, VITE_API_BASE: 'https://api.example.com/v1' })
    expect(policy).toContain(`connect-src 'self' https://api.example.com`)
  })

  it('adds analytics origins only when the token is configured', () => {
    const { policy } = buildCspPolicy({ ...baseEnv, VITE_CF_WEB_ANALY_TOKEN: 'token-123' })
    expect(policy).toContain('https://static.cloudflareinsights.com')
    expect(policy).toContain(`connect-src 'self' https://cloudflareinsights.com`)
  })

  it('adds ads origins only when the ad client is configured', () => {
    const { policy } = buildCspPolicy({ ...baseEnv, VITE_GOOGLE_AD_CLIENT: 'ca-pub-123' })
    expect(policy).toContain('https://pagead2.googlesyndication.com')
    expect(policy).toContain('https://*.googlesyndication.com')
    expect(policy).toContain('https://*.doubleclick.net')
  })

  it('adds the Telegram script origin for telegram builds', () => {
    const { policy, isTelegram } = buildCspPolicy({ ...baseEnv, VITE_IS_TELEGRAM: 'true' })
    expect(isTelegram).toBe(true)
    expect(policy).toContain(`script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com https://telegram.org`)
    expect(policy).not.toContain('frame-ancestors')
  })

  it('appends validated extra sources', () => {
    const { policy } = buildCspPolicy({
      ...baseEnv,
      VITE_CSP_EXTRA_SCRIPT_SRC: 'https://cdn.example.com',
      VITE_CSP_EXTRA_CONNECT_SRC: 'wss://realtime.example.com',
      VITE_CSP_EXTRA_IMG_SRC: 'https://img.example.com',
      VITE_CSP_EXTRA_FRAME_SRC: 'https://frame.example.com',
    })
    expect(policy).toContain('script-src')
    expect(policy).toContain('https://cdn.example.com')
    expect(policy).toContain('wss://realtime.example.com')
    expect(policy).toContain('https://img.example.com')
    expect(policy).toContain('https://frame.example.com')
  })

  it.each([
    [`directive break: semicolon`, 'https://a.com; script-src https://evil.com'],
    [`quote injection`, `https://a.com'unsafe-inline'`],
    [`double quote injection`, 'https://a.com"'],
    [`newline injection`, 'https://a.com\nscript-src https://evil.com'],
  ])('rejects extra sources with %s', (_name, value) => {
    for (const key of ['VITE_CSP_EXTRA_SCRIPT_SRC', 'VITE_CSP_EXTRA_CONNECT_SRC',
      'VITE_CSP_EXTRA_IMG_SRC', 'VITE_CSP_EXTRA_FRAME_SRC']) {
      expect(() => buildCspPolicy({ ...baseEnv, [key]: value })).toThrow()
    }
  })
})

describe('buildHeadersFile', () => {
  const { policy, isTelegram } = buildCspPolicy(baseEnv)

  it('includes the full policy plus headers a meta tag cannot express', () => {
    const headers = buildHeadersFile({ policy, isTelegram })
    expect(headers).toContain('/*')
    expect(headers).toContain(`Content-Security-Policy: ${policy}; frame-ancestors 'none'`)
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin')
    expect(headers).toContain('X-Frame-Options: DENY')
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000')
    // no includeSubDomains/preload: mail subdomains may exist without web
    expect(headers).not.toMatch(/Strict-Transport-Security:.*(includeSubDomains|preload)/)
  })

  it('locks down Permissions-Policy while keeping WebAuthn and clipboard', () => {
    const headers = buildHeadersFile({ policy, isTelegram })
    expect(headers).toContain('Permissions-Policy:')
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb', 'serial', 'bluetooth', 'browsing-topics']) {
      expect(headers).toContain(`${feature}=()`)
    }
    expect(headers).toContain('publickey-credentials-get=(self)')
    expect(headers).toContain('publickey-credentials-create=(self)')
    // clipboard (copy buttons) must stay allowed
    expect(headers).not.toContain('clipboard')
    // notifications are not controlled by Permissions-Policy; never restrict them
    expect(headers).not.toContain('notifications')
  })

  it('uses COOP same-origin', () => {
    const headers = buildHeadersFile({ policy, isTelegram })
    expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin')
  })

  it('caches content-hashed assets immutably but leaves HTML/SW revalidating', () => {
    const headers = buildHeadersFile({ policy, isTelegram })
    expect(headers).toContain('/assets/*')
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable')
    // single Cache-Control rule only, applying to /assets/* glob
    expect(headers.match(/Cache-Control:/g)).toHaveLength(1)
  })

  it('omits frame-ancestors and X-Frame-Options for the Telegram build', () => {
    const telegram = buildCspPolicy({ ...baseEnv, VITE_IS_TELEGRAM: 'true' })
    const headers = buildHeadersFile(telegram)
    expect(headers).toContain(`Content-Security-Policy: ${telegram.policy}`)
    expect(headers).not.toContain('frame-ancestors')
    expect(headers).not.toContain('X-Frame-Options')
    // HSTS/COOP/Permissions-Policy still apply to the Telegram build
    expect(headers).toContain('Strict-Transport-Security: max-age=31536000')
    expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin')
    expect(headers).toContain('Permissions-Policy:')
  })
})
