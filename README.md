<!-- markdownlint-disable-file MD033 -->
# decrypts — your ghost address 👻

<p align="center">
  <a href="https://decrypts.net"><img alt="live site" src="https://img.shields.io/badge/live-decrypts.net-FFB000?labelColor=0B0B0C"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-grey"></a>
  <a href="https://github.com/dreamhunter2333/cloudflare_temp_email"><img alt="based on cloudflare_temp_email" src="https://img.shields.io/badge/based%20on-cloudflare__temp__email-grey?logo=github"></a>
</p>

**decrypts** is disposable email that runs entirely on Cloudflare (Workers, D1 and Email Routing), with optional **per-mailbox encryption**. Mail is stored encrypted and decrypted only in your browser. It has a retro "Phosphor" terminal look.

Try it at **[decrypts.net](https://decrypts.net)**, or host your own.

> decrypts is a fork of [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) by [Dream Hunter](https://github.com/dreamhunter2333) and its contributors. Almost everything that makes it a working mail service comes from that project. See [Credits](#credits).
>
> For learning and personal use. Don't use it for anything illegal.

## What this fork adds

**Encrypted mailboxes**
- **Encryption per mailbox, on by default.** Your browser makes a P-256 key pair. The worker gets only the public key and encrypts each incoming mail (the whole MIME message: sender, subject, body and attachments) with AES-256-GCM before storing it. Sent mail is stored encrypted too.
- **Keys stay in the browser.** Private keys are non-extractable WebCrypto keys in IndexedDB. The raw key is shown once, at creation.
- **Backups:** a passphrase-protected link or file (PBKDF2, 600k rounds), or a passkey backup for account holders (WebAuthn PRF). The server never sees the passphrase or the passkey secret.
- **Open on another device:** a QR code that carries the login and the *protected* backup in the URL fragment, which never reaches the server.
- **Encrypt existing mail** after turning encryption on, and a **burn mailbox** button that deletes the address, its mail and this browser's keys.
- **Notifications with no content:** Telegram and webhooks say only "new encrypted mail". Forwarding and AI extraction are switched off for encrypted mailboxes.

**Quality of life**
- **Verification codes and links** are found in the browser after decryption, with one-click copy from the inbox list. Nothing leaves the browser.
- **New-mail alerts:** an unread count in the tab title and optional notifications, which never include the sender or subject.
- **Keyboard shortcuts:** `c` copy address, `r` refresh, `j`/`k` move, `/` search, `?` help.
- **Retention shown on the site**, generated from the real auto-cleanup settings so it can't drift.
- A **"back up your key" reminder**, and an About page that explains what encryption does and doesn't protect.

**Look and hardening**
- The **Phosphor theme:** amber on near-black in dark mode, soft graphite on warm-grey paper in light mode, self-hosted IBM Plex fonts, and WCAG AA contrast enforced by tests.
- A **strict Content-Security-Policy:** same-origin scripts only (plus Turnstile), no CDNs and no remote fonts.

**Tooling:** [`mise`](https://mise.jdx.dev) tasks for install, dev, test, deploy, logs, migrations and upstream release merges.

## What the encryption does *not* do

Please read this before relying on it:

- **It's not end-to-end from the sender.** Email arrives over the normal email system. The sender's provider and Cloudflare Email Routing handle it unencrypted, and the worker sees each message briefly before encrypting it. It protects mail **at rest**: a leaked or seized database is useless without your key.
- **You're trusting the code the site serves.** A compromised or dishonest server could read new mail as it arrives, or ship code that steals keys.
- **Some metadata stays visible:** your address, when mail arrived, its size and whether it's been read. Mail you *send* leaves as normal, unencrypted email.
- **If you lose your key, the mail is gone.** There's no recovery and no backdoor.
- It uses standard browser cryptography, but **it has not been independently audited**.

Details: [mail encryption docs](vitepress-docs/docs/en/guide/feature/mail-encryption.md).

## Everything from upstream

All of cloudflare_temp_email still works. That includes:
- Rust WASM mail parsing.
- Sending through the Cloudflare `send_email` binding, Resend or SMTP.
- User accounts with OAuth2 and passkey login, and roles.
- A full admin console, attachments (with optional S3), spam and blocklist rules, and forwarding.
- The Telegram bot and mini app, the SMTP/IMAP proxy, webhooks and Turnstile.
- Scheduled cleanup and the agent mail skill.

See the [upstream docs](https://temp-mail-docs.awsl.uk) for the full list and configuration reference.

## Self-hosting

You need a Cloudflare account, a domain on Cloudflare with **Email Routing**, and [`mise`](https://mise.jdx.dev). mise installs Node and pnpm at the pinned versions. Sending to arbitrary recipients needs Workers Paid.

```sh
git clone https://github.com/codyro/decrypts.net.git && cd decrypts.net
mise install && mise run install

# Worker config (gitignored): bindings, domains, secrets
cp worker/wrangler.toml.template worker/wrangler.toml

# Create the database and load the schema
cd worker
pnpm exec wrangler d1 create temp-email-db       # put the id into wrangler.toml
pnpm exec wrangler d1 execute temp-email-db --remote --file=../db/schema.sql
cd ..

mise run deploy   # tests, then the frontend build, then the worker deploy (it serves the frontend)
```

Then route your domain's email to the worker (**Email Routing → catch-all → Send to Worker**), and open `/admin` to finish setup. The upstream [CLI guide](https://temp-mail-docs.awsl.uk/en/guide/cli/pre-requisite.html) covers each step in detail.

Settings this fork adds, in `wrangler.toml` `[vars]`:

| Variable | Effect |
|---|---|
| `ENABLE_MAIL_ENCRYPTION = true` | Turns on per-mailbox encryption |
| `DEFAULT_MAIL_ENCRYPTION = true` | The "encrypt received mail" box starts ticked |
| `ENABLE_INDEX_ABOUT = true` | Shows the About link, with the encryption and retention explainer |

To make cleanup run, add `[triggers] crons = ["15 * * * *"]` and set the rules under Admin → auto cleanup.

**Upgrading an existing install:** deploy, then run the database migration from Admin → Database → Migrate, or with `ADMIN_AUTH=… mise run db:migrate`.

### mise tasks

| Task | What it does |
|---|---|
| `mise run dev` / `dev:frontend` | Local worker on :8787 / Vite dev server |
| `mise run test` | Worker lint and frontend unit tests |
| `mise run build` | Production frontend build and a worker dry-run |
| `mise run deploy` | Test, build and deploy to Cloudflare |
| `mise run db:migrate` | Run the database migration on production (needs `ADMIN_AUTH`) |
| `mise run logs` | Live worker logs |
| `mise run test:e2e` | Full Docker end-to-end suite |
| `mise run upstream:check` / `upstream:merge` | Check for, or merge, a new upstream **release tag** |
| `mise run push` | Test, then push `main` |
| `mise run release` | Cut a fork release (`VERSION=X.Y.Z`; `DRY_RUN=1` rehearses) |

## Releases

Fork releases are tagged `decrypts-vX.Y.Z` (SemVer; the `decrypts-` prefix keeps them apart from upstream's own `vX.Y.Z` tags) and published to [GitHub Releases](https://github.com/codyro/decrypts.net/releases). Each release notes the upstream release tag it is based on. Assets:

- `decrypts-frontend-X.Y.Z.zip` — the production frontend. It's a **same-origin build** (`VITE_API_BASE` empty), the exact build the worker's `[assets]` serving expects, so it matches how decrypts.net itself is deployed.
- `decrypts-worker-X.Y.Z.js` — the minified worker bundle, built with `wrangler deploy --dry-run` against `wrangler.toml.template` (placeholders only — never the real, secret-holding `wrangler.toml`).
- `decrypts-db-X.Y.Z.zip` — `db/schema.sql` plus every `db/*.sql` migration patch.
- `SHA256SUMS` — checksums for the three files above.

To cut a release, be on a clean, up-to-date `main` and run:

```sh
VERSION=1.0.1 mise run release        # DRY_RUN=1 rehearses without changing anything
```

## Staying in sync with upstream

This fork tracks upstream **release tags**, not upstream's `main`. Merges never rebase, so the history stays stable for deploys.

```sh
mise run upstream:check            # is there a newer vX.Y.Z?
mise run upstream:merge            # merge the newest tag (or TAG=v1.15.0)
mise run test
```

Bugs specific to decrypts belong in [this repo's issues](https://github.com/codyro/decrypts.net/issues). Anything that reproduces on stock cloudflare_temp_email belongs [upstream](https://github.com/dreamhunter2333/cloudflare_temp_email/issues).

## Credits

decrypts stands on [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email) by **[Dream Hunter](https://github.com/dreamhunter2333)** and [its contributors](https://github.com/dreamhunter2333/cloudflare_temp_email/graphs/contributors). That project does the mail parsing, storage, accounts, admin, Telegram, the proxy and most of the rest. If you find decrypts useful, please star the upstream project too.

Upstream's own READMEs (中文 / English / 日本語) are in the [original repository](https://github.com/dreamhunter2333/cloudflare_temp_email#readme), and its community is on [Telegram](https://t.me/cloudflare_temp_email).

## License

[MIT](LICENSE). Copyright (c) 2023 Dream Hunter, plus the fork's changes under the same license.
