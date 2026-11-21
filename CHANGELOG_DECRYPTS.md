<!-- markdownlint-disable-file MD024 -->
# decrypts changelog

This changelog covers **decrypts** ([codyro/decrypts.net](https://github.com/codyro/decrypts.net),
live at [decrypts.net](https://decrypts.net)), a public fork of
[cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email).

It lists the fork's own changes only. Upstream's changes are in
[CHANGELOG.md](CHANGELOG.md) (中文) and [CHANGELOG_EN.md](CHANGELOG_EN.md).

Fork releases are tagged `decrypts-vX.Y.Z` (SemVer) and published on the
[GitHub Releases](https://github.com/codyro/decrypts.net/releases) page. Each
release notes the upstream release tag it is based on.

## Unreleased

### Features

- **Per-mailbox encryption of stored mail, on by default.** Your browser generates the key pair and only the public key is uploaded; each incoming mail — sender, subject, body and attachments — is encrypted before it is stored, mail sent from the mailbox is stored encrypted too, and existing mail can be encrypted in place afterwards. Private keys stay in the browser as non-extractable WebCrypto keys, and every content-leaking side path (forwarding, AI extraction, other-worker RPC) is skipped for encrypted mailboxes, which instead get content-free Telegram and webhook notices. Gated by `ENABLE_MAIL_ENCRYPTION`, with `DEFAULT_MAIL_ENCRYPTION` to default the checkbox to on.
- **Passkey-only account sign-up** (opt-in: Admin → User → User Settings). Create an account with just a discoverable passkey: no email, no password, logged in immediately. Accounts get a server-generated `pk-<random>@passkey.invalid` ID that password login, verification codes and OAuth2 all refuse, and show as "Passkey account". The last passkey of such an account can't be deleted, and a one-time nudge suggests adding a second one. New public endpoints `POST /user_api/passkey/signup_request` and `signup_response` share register's rate limiting, IP blacklist and Turnstile check.
- **Key backups.** Passphrase-protected backup links and files (PBKDF2-SHA256 + AES-GCM) and passkey (WebAuthn PRF) backups for signed-in users, so a mailbox can be recovered on another device. The raw key is shown once; after that, copy-link and export produce wrapped backups only, and a "back up your key" reminder appears while an encrypted mailbox has no protected backup on this device.
- **Open on another device, and burn mailbox.** A locally generated QR code and copy link hand off the mailbox in the URL fragment (`#jwt=…[&kp=…]`), which never reaches the server, and never carries a raw `#k=` key. A "Burn mailbox" danger-zone action deletes the address and all of its server-side data, then removes this browser's keys.
- **Client-side code detection, new-mail alerts and keyboard shortcuts.** Verification codes and sign-in links are found in the browser after decryption, with one-click copy from the inbox list; the tab title shows an unread count and optional notifications never include sender or subject; `c`, `r`, `j`/`k`, `/` and `?` shortcuts cover the common inbox actions.
- **Honest retention display.** The site shows mail and address retention generated from the real auto-cleanup settings, so the copy can't drift from the config.
- **About-page encryption explainer.** A plain-language description of what the encryption does and doesn't protect: not end-to-end from the sender, some metadata still visible, no recovery without the key, not independently audited.
- **Phosphor theme.** A retro terminal look: amber phosphor on near-black in dark mode, soft graphite on warm-grey paper in light mode (softened to reduce glare), self-hosted IBM Plex Mono/Sans, and WCAG AA contrast locked in by tests.
- **Ghost envelope icon.** An SVG favicon and header mark (coloured by the theme accent), with generated PWA, maskable, Apple touch and `.ico` fallbacks replacing upstream's logo.
- **BIMI logo.** `/bimi.svg`, an SVG Tiny PS version of the ghost envelope for a `default._bimi` DNS record.
- **Cleaner, simpler UI.** A quieter interface built around the address bar and the inbox, with settings consolidated into drawers, the public logo-click entry to the admin page removed, and the upstream community links removed from the About modal.

### Fixes

- Run the `user_key_backups` migration as a single-line D1 statement, because `DB.exec()` splits on newlines.
- Bundle faker locally so random address name generation keeps working under the strict Content-Security-Policy.
- Generate the `--app-text-N` theme CSS variables the stylesheets reference.
- Show the day count in the retention sentences.

### Changes

- **Strict Content-Security-Policy**, added at build time: same-origin scripts and styles only (plus Turnstile), no CDNs and no remote fonts, with unit, browser and production-build e2e coverage.
- **CORS allow-list and stricter headers.** New `CORS_ALLOWED_ORIGINS` (unset keeps `*`); pages now send HSTS, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin` and `X-Frame-Options: DENY`; API responses get `nosniff`/`Referrer-Policy`; hashed `/assets/*` are cached immutably.
- The production frontend is same-origin: `VITE_API_BASE` is set at build time (empty), and `index.html` stays identical to upstream.
- Untrack the generated frontend `auto-imports.d.ts`, initialize the local D1 schema on `pnpm dev`, and brand the static app name as decrypts with a single copyright year.

### Docs & tooling

- **mise tasks** for install, dev, lint, test, build, deploy, database migration, live logs and upstream release-tag merges.
- Fork README with upstream credit, fork guidance in `AGENTS.md`, and dated decision/backlog notes under `docs/`.
- GitHub icon links (header and footer) to this fork's repository, and an upstream credit line in About.
- Release tooling: `mise run release` / `release:notes`, a `VERSION` file shown in the footer next to the upstream version, and this changelog.
