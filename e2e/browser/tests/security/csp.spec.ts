import { test, expect, request as apiRequest } from '@playwright/test';
import { generateKeyPair } from '../../../../frontend/src/utils/mail-crypto.js';
import {
  FRONTEND_URL_PREVIEW,
  WORKER_URL,
  TEST_DOMAIN,
  createTestAddress,
  seedTestMail,
  deleteAddress,
} from '../../../fixtures/test-helpers';

/**
 * Verifies the strict Content-Security-Policy emitted by vite-plugin-csp
 * against the PRODUCTION frontend build served by `vite preview`
 * (frontend-preview compose service, CSP meta tag active; the _headers file
 * is a Pages/Workers deployment feature and is checked by inspection).
 *
 * The external Turnstile script cannot be exercised inside the sandboxed
 * docker network, so its origin directives are verified by policy inspection
 * only (see frontend/vite-plugin-csp.js and the unit tests).
 */

test.skip(!FRONTEND_URL_PREVIEW, 'frontend-preview service is not configured');

const EXPECTED_POLICY = "default-src 'self';"
  + " script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com;"
  + " style-src 'self' 'unsafe-inline';"
  + " img-src 'self' data: blob: https:;"
  + " font-src 'self' data:;"
  + " media-src 'self' https: data: blob:;"
  + " connect-src 'self';"
  + " frame-src 'self' https://challenges.cloudflare.com;"
  + " worker-src 'self' blob:;"
  + " object-src 'none';"
  + " base-uri 'self';"
  + " form-action 'self';"
  + " manifest-src 'self'";

const COLLECT_VIOLATIONS = () => {
  (window as any).__cspViolations = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    (window as any).__cspViolations.push({
      violatedDirective: (event as SecurityPolicyViolationEvent).violatedDirective,
      blockedURI: (event as SecurityPolicyViolationEvent).blockedURI,
    });
  });
};

// The mail body renders either into a ShadowRoot or, when Shadow DOM is
// unavailable, into light DOM (ShadowHtmlComponent v-html fallback). Each
// probe below searches both, inline in the page (no eval/new Function,
// which the CSP correctly blocks).

test('serves the strict CSP meta, renders, and blocks injected inline scripts', async ({ page }) => {
  await page.addInitScript(COLLECT_VIOLATIONS);
  await page.goto(`${FRONTEND_URL_PREVIEW}/en/`);

  // The production build carries the exact strict policy (no extras configured)
  const meta = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(meta).toHaveCount(1);
  const content = await meta.getAttribute('content');
  expect(content).toBe(EXPECTED_POLICY);
  expect(content).not.toContain("'unsafe-eval'");
  expect(content).not.toMatch(/script-src[^;]*'unsafe-inline'/);

  // The app boots and renders under the policy
  await expect(page.getByRole('button', { name: /create email address|创建邮箱/i }).first())
    .toBeVisible({ timeout: 15_000 });

  // An injected inline <script> is blocked by script-src and must not run.
  // (Direct eval()/new Function probes are not usable here: Playwright
  // evaluates in an isolated world that bypasses CSP eval guards. The
  // absence of 'unsafe-eval' in the asserted policy string covers eval.)
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__cspInlineRan = true';
    document.body.appendChild(script);
  });
  expect(await page.evaluate(() => (window as any).__cspInlineRan)).toBeUndefined();

  // The inline script attempt was reported as a script-src violation
  const violations = await page.evaluate(() => (window as any).__cspViolations);
  expect(violations.some((v: any) => v.violatedDirective.startsWith('script-src'))).toBe(true);

  // No OTHER violation occurred while booting the app legitimately
  const unexpected = violations.filter((v: any) => !v.violatedDirective.startsWith('script-src'));
  expect(unexpected).toEqual([]);
});

test('HTML mail renders remote/data images and inline styles without CSP violations', async ({ page }) => {
  const api = await apiRequest.newContext();
  let jwt = '';
  const consoleMessages: string[] = [];
  page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => consoleMessages.push(`pageerror: ${err.message}`));
  try {
    const mailbox = await createTestAddress(api, 'csp-mail');
    jwt = mailbox.jwt;
    const subject = `CSP mail ${Date.now()}`;
    await seedTestMail(api, mailbox.address, {
      subject,
      html: '<p id="csp-styled" style="color: rgb(12, 34, 56)">styled body</p>'
        + '<img src="https://example.com/remote-image.png" alt="remote">'
        + '<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7" alt="inline">',
    });

    await page.setViewportSize({ width: 1360, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem('useIframeShowMail', 'false');
      localStorage.setItem('preferShowTextMail', 'false');
      (window as any).__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as any).__cspViolations.push({
          violatedDirective: (event as SecurityPolicyViolationEvent).violatedDirective,
          blockedURI: (event as SecurityPolicyViolationEvent).blockedURI,
        });
      });
    });
    await page.goto(`${FRONTEND_URL_PREVIEW}/en/?jwt=${jwt}`);
    const summary = page.getByRole('listitem').filter({ hasText: subject });
    await expect(summary).toBeVisible({ timeout: 15_000 });
    await summary.click();

    // Wait until the app finished loading the mailbox (same gate as
    // mail-body-colors.spec.ts), then the reader renders the HTML body.
    await expect(page.getByText('loading...', { exact: true })).not.toBeVisible();
    const styled = page.locator('#csp-styled');
    await expect(styled, consoleMessages.join('\n')).toBeVisible();
    await expect(styled, consoleMessages.join('\n')).toHaveCSS('color', 'rgb(12, 34, 56)');

    // Remote https image is present and allowed by the policy (loading the
    // external host may fail inside the docker network, but must not be a
    // CSP violation); the data: image must actually decode.
    const remote = page.locator('img[alt="remote"]');
    await expect(remote, consoleMessages.join('\n')).toBeAttached();
    expect(await remote.getAttribute('src'), consoleMessages.join('\n'))
      .toMatch(/^https:\/\/example\.com\//);
    const inline = page.locator('img[alt="inline"]');
    await expect(inline, consoleMessages.join('\n')).toBeAttached();
    await expect
      .poll(() => inline.evaluate(img => img.naturalWidth), { timeout: 5_000 })
      .toBeGreaterThan(0);

    // No CSP violation on the whole legit mail flow
    const violations = await page.evaluate(() => (window as any).__cspViolations);
    expect(violations, consoleMessages.join('\n')).toEqual([]);
  } finally {
    try {
      if (jwt) await deleteAddress(api, jwt);
    } finally {
      await api.dispose();
    }
  }
});

test('mailbox-encrypted mail still decrypts under the CSP', async ({ page }) => {
  const api = await apiRequest.newContext();
  let jwt = '';
  const consoleMessages: string[] = [];
  page.on('console', msg => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => consoleMessages.push(`pageerror: ${err.message}`));
  try {
    const { publicKey, privateKey } = await generateKeyPair();
    const res = await api.post(`${WORKER_URL}/api/new_address`, {
      data: {
        name: `cspenc${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        domain: TEST_DOMAIN,
        encryption_public_key: publicKey,
      },
    });
    if (!res.ok()) throw new Error(`Failed to create address: ${res.status()} ${await res.text()}`);
    const { jwt: createdJwt, address } = await res.json();
    jwt = createdJwt;

    const subject = `CSP decrypt ${Date.now()}`;
    await seedTestMail(api, address, { subject, text: 'csp decrypted body' });

    await page.addInitScript(COLLECT_VIOLATIONS);
    await page.goto(
      `${FRONTEND_URL_PREVIEW}/en/?jwt=${jwt}`
      + `#k=${encodeURIComponent(privateKey)}&a=${encodeURIComponent(address)}`,
    );
    await expect.poll(() => new URL(page.url()).hash).toBe('');
    // Dismiss the "protect this key" offer (same as mail-encryption.spec.ts)
    await page.keyboard.press('Escape');

    const summary = page.locator('.mail-summary-subject').first();
    await expect(summary).toContainText(subject, { timeout: 15_000 });
    await summary.click();
    await expect(page.locator('.mail-content-renderer')).toContainText('csp decrypted body');

    const violations = await page.evaluate(() => (window as any).__cspViolations);
    expect(violations, consoleMessages.join('\n')).toEqual([]);
  } finally {
    try {
      if (jwt) await deleteAddress(api, jwt);
    } finally {
      await api.dispose();
    }
  }
});
