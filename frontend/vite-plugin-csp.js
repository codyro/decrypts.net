// Build-time Content-Security-Policy for the frontend.
//
// Single source of truth for the production CSP: this plugin builds the
// policy once, injects it as a <meta http-equiv="Content-Security-Policy">
// into the built index.html, and writes a Cloudflare `_headers` file with
// the same policy plus headers a meta tag cannot express.
//
// Hardening context: the mailbox key store lives in the browser, so an XSS
// must not be able to run scripts. The policy therefore never allows
// 'unsafe-eval' or script 'unsafe-inline'. Documented relaxations:
// - 'wasm-unsafe-eval' in script-src: vite-plugin-wasm instantiates the
//   mail-parser WASM module at runtime.
// - 'unsafe-inline' in style-src only: Naive UI and Vue inject <style>
//   tags at runtime, and sanitised mail HTML keeps inline styles. Styles
//   cannot exfiltrate the key store the way scripts can.
// - img-src https: data: blob:: mail HTML renders remote https images
//   (after per-mail consent) and cid: inline images are rewritten to
//   blob: URLs by the mail parser.
// - frame-src 'self': the optional mail iframe uses srcdoc, which inherits
//   the page origin and therefore matches 'self'.
//
// Escape hatches (build env):
// - VITE_CSP_DISABLED=true            emit no meta tag and no _headers
// - VITE_CSP_EXTRA_SCRIPT_SRC         space-separated source expressions
// - VITE_CSP_EXTRA_CONNECT_SRC        appended to the given directive
// - VITE_CSP_EXTRA_IMG_SRC
// - VITE_CSP_EXTRA_FRAME_SRC
// Extra values are validated so config cannot inject extra directives.
//
// Conditional origins:
// - Telegram build (VITE_IS_TELEGRAM=true): adds https://telegram.org to
//   script-src and omits frame-ancestors 'none' from _headers (the app is
//   embedded in Telegram clients' iframes).
// - Cloudflare web analytics (VITE_CF_WEB_ANALY_TOKEN set): beacon script
//   (static.cloudflareinsights.com) and RUM endpoint (cloudflareinsights.com).
// - Google AdSense (VITE_GOOGLE_AD_CLIENT set): ads script
//   (pagead2.googlesyndication.com) plus googlesyndication/doubleclick
//   frame and connect origins used by ad iframes.
// - VITE_API_BASE pointing at another origin adds that origin to connect-src.

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { loadEnv } from 'vite'

// Characters that would let a config value break out of a directive value:
// ';' starts a new directive, quotes/source-expression syntax and newlines
// could terminate or forge source expressions.
const FORBIDDEN_IN_SOURCE = /[;'"`<>\\]/

const parseExtraSources = (value, name) => {
  if (!value) return []
  // Reject control characters in the raw value before splitting: a newline
  // would merely act as a separator, but a config value containing control
  // characters is not a valid source list and should fail loudly.
  if (/[\r\n]/.test(String(value))) {
    throw new Error(`${name} must not contain newlines`)
  }
  const sources = String(value).split(/\s+/).filter(Boolean)
  for (const source of sources) {
    if (FORBIDDEN_IN_SOURCE.test(source)) {
      throw new Error(
        `${name} contains an invalid source "${source}": ` +
        `';', quotes, backslashes and newlines are not allowed`
      )
    }
  }
  return sources
}

// Extract the origin of VITE_API_BASE so XHR/fetch to the API works when it
// is deployed on another domain (empty VITE_API_BASE = same origin, covered
// by 'self'). Non-URL values (e.g. "/api") are ignored: 'self' covers them.
export const parseApiBaseOrigin = (apiBase) => {
  if (!apiBase) return null
  try {
    const url = new URL(apiBase)
    return url.origin === 'null' ? null : url.origin
  } catch {
    return null
  }
}

const join = (sources) => sources.filter(Boolean).join(' ')

/**
 * Build the CSP from a build-time env map.
 * Returns { enabled, policy, isTelegram } where `policy` is the full CSP
 * string without frame-ancestors (a meta tag ignores it; the _headers file
 * appends it unless this is a Telegram build).
 */
export const buildCspPolicy = (env = {}) => {
  if (String(env.VITE_CSP_DISABLED || '') === 'true') {
    return { enabled: false, policy: null, isTelegram: false }
  }

  const isTelegram = String(env.VITE_IS_TELEGRAM || '') === 'true'
  const hasAnalytics = Boolean(env.VITE_CF_WEB_ANALY_TOKEN)
  const hasAds = Boolean(env.VITE_GOOGLE_AD_CLIENT)
  const apiOrigin = parseApiBaseOrigin(env.VITE_API_BASE)

  const scriptSrc = [
    `'self'`,
    `'wasm-unsafe-eval'`,
    `https://challenges.cloudflare.com`,
    // Turnstile widget: api.js from challenges.cloudflare.com (index.html)
    // renders an iframe from the same origin.
    isTelegram && `https://telegram.org`,
    hasAnalytics && `https://static.cloudflareinsights.com`,
    hasAds && `https://pagead2.googlesyndication.com`,
    ...parseExtraSources(env.VITE_CSP_EXTRA_SCRIPT_SRC, 'VITE_CSP_EXTRA_SCRIPT_SRC'),
  ]

  const connectSrc = [
    `'self'`,
    apiOrigin,
    // Web analytics beacon posts RUM data here.
    hasAnalytics && `https://cloudflareinsights.com`,
    // AdSense fetches ads through these host families.
    hasAds && `https://*.googlesyndication.com https://*.doubleclick.net`,
    ...parseExtraSources(env.VITE_CSP_EXTRA_CONNECT_SRC, 'VITE_CSP_EXTRA_CONNECT_SRC'),
  ]

  const frameSrc = [
    // 'self' covers the srcdoc mail iframe (inherits the page origin);
    // Turnstile renders its challenge iframe from challenges.cloudflare.com.
    `'self'`,
    `https://challenges.cloudflare.com`,
    hasAds && `https://*.googlesyndication.com https://*.doubleclick.net`,
    ...parseExtraSources(env.VITE_CSP_EXTRA_FRAME_SRC, 'VITE_CSP_EXTRA_FRAME_SRC'),
  ]

  const directives = [
    `default-src 'self'`,
    `script-src ${join(scriptSrc)}`,
    // Naive UI / Vue runtime-injected <style> tags and sanitised mail HTML
    // inline styles. Styles only; scripts never get 'unsafe-inline'.
    `style-src 'self' 'unsafe-inline'`,
    // Remote https images in mail HTML, cid: inline images rewritten to
    // blob:, and data: images used by the remote-content blocker.
    `img-src ${join([
      `'self'`, `data:`, `blob:`, `https:`,
      ...parseExtraSources(env.VITE_CSP_EXTRA_IMG_SRC, 'VITE_CSP_EXTRA_IMG_SRC'),
    ])}`,
    `font-src 'self' data:`,
    // Mail HTML may embed remote audio/video.
    `media-src 'self' https: data: blob:`,
    `connect-src ${join(connectSrc)}`,
    `frame-src ${join(frameSrc)}`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `manifest-src 'self'`,
  ]

  return { enabled: true, policy: directives.join('; '), isTelegram }
}

export const buildHeadersFile = ({ policy, isTelegram }) => {
  // frame-ancestors cannot be expressed by a meta tag, so the meta policy
  // omits it; the _headers file adds it unless the app is embedded by
  // Telegram clients (which require frame-ancestors * or the client origin).
  const fullPolicy = isTelegram ? policy : `${policy}; frame-ancestors 'none'`
  return [
    '/*',
    `  Content-Security-Policy: ${fullPolicy}`,
    `  X-Content-Type-Options: nosniff`,
    `  Referrer-Policy: strict-origin-when-cross-origin`,
    '',
  ].join('\n')
}

export default function cspPlugin() {
  let result = null
  return {
    name: 'vite-plugin-csp',
    // Dev-server (HMR uses inline scripts and ws://) must not get the CSP.
    apply: 'build',
    configResolved(config) {
      const env = { ...process.env, ...loadEnv(config.mode, config.root, 'VITE_') }
      result = buildCspPolicy(env)
      if (!result.enabled) {
        config.logger.info('[csp] VITE_CSP_DISABLED=true, no CSP emitted')
      }
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!result?.enabled) return null
        return [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: result.policy },
            injectTo: 'head-prepend',
          },
        ]
      },
    },
    writeBundle(options) {
      if (!result?.enabled || !options.dir) return
      writeFileSync(resolve(options.dir, '_headers'), buildHeadersFile(result))
    },
  }
}
