# AGENTS.md

This file provides shared guidance to coding agents working in this repository.

## This repo is the decrypts.net fork (read first)

This is **decrypts.net**, a public fork of [cloudflare_temp_email](https://github.com/dreamhunter2333/cloudflare_temp_email). The sections after this one are upstream's guidance and still apply. Where they conflict, this section wins.

### Remotes and branches
- `origin` = `git@github.com:codyro/decrypts.net.git`. `main` is the **build/deploy branch** and the repo's default branch.
- `upstream` = `dreamhunter2333/cloudflare_temp_email`. Its push URL is set to `no-push-to-upstream`. **Never push to upstream** and never open PRs there unless the owner asks.
- Branch work from `main` into short-lived branches, then land it back with a fast-forward (rebase the branch onto `main` first if needed). **Never rewrite or force-push `main`.**
- Push only when the owner asks: `mise run push` runs the tests and then `git push origin main`.

### Merging upstream (release tags only)
- Merge **upstream release tags** (`vX.Y.Z`), never upstream's untagged `main`. Use `mise run upstream:check`, then `mise run upstream:merge` (or `TAG=v1.15.0 mise run upstream:merge`). It does `git merge --no-ff <tag>`. **Never rebase `main` onto upstream.**
- After a merge, run `mise run test`. If the merge touched the worker or the frontend, also run `mise run test:e2e`.
- Expected conflicts and how to resolve them:
  - `README.md`: keep the fork's. `README_EN.md` / `README_JA.md` stay deleted.
  - `CHANGELOG.md` / `CHANGELOG_EN.md`: take upstream's side, plus any fork lines already there. Don't add new fork entries to these files (see below).
  - `AGENTS.md`: keep this section and take upstream's changes below it.
  - `.github/workflows/sync.yaml` stays deleted. The fork does not auto-sync.
  - Upstream refactors that move code the fork changed (address creation, mail parser, `common.ts`): re-apply the fork's changes in the new location. Don't drop them. The fork's features are listed in `README.md`. The encryption code paths are `worker/src/utils/mail_crypto.ts`, `mail_encryption.ts`, `key_backup.ts`, `worker/src/email/storage.ts`, `worker/src/mails_api/address_encryption.ts` and `encrypt_existing.ts`, and `frontend/src/utils/mail-*.js` / `key-backup*.js`.
- **DB versions diverge from upstream.** The fork uses `v0.0.11` for `address.encryption_public_key`, `v0.0.12` for the `is_encrypted` flag and `v0.0.13` for `user_key_backups`. Upstream's `v0.0.11` is `address.expires_at`, which arrives with v1.15.0.
  - Never reuse or renumber a version that has shipped. Add upstream's schema changes as a **new** fork version (e.g. `v0.0.14`) in `worker/src/admin_api/db_api.ts`.
  - Gate every migration step on a column/table existence check (`PRAGMA table_info` / `CREATE ... IF NOT EXISTS`), so databases that are already further along still get upstream's columns.
  - Also add a dated `db/*.sql` patch and update `db/schema.sql`.
- D1 `exec()` treats every newline as a statement separator. Keep each `DB.exec()` statement on a single line, or use `prepare(...).run()`.

### Fork invariants (don't regress these)
- **Mailbox encryption** (see `vitepress-docs/docs/en/guide/feature/mail-encryption.md`):
  - Keys are generated in the browser and kept as non-extractable WebCrypto keys. The server only ever stores public keys and ciphertext.
  - Never emit a raw `#k=` key after creation. Links and QR codes use the URL fragment, never the query string.
  - Encrypted mailboxes get only content-free notifications, and every content-leaking side path stays skipped.
  - Sendbox/backups never fall back to plaintext.
- **Strict CSP** (`frontend/vite-plugin-csp.js`): no remote scripts, styles or fonts, and no CDNs. Bundle dependencies locally and lazy-load the heavy ones. Don't loosen the policy to make something work.
- **Phosphor theme** (`docs/changes/phosphor-theme.md`):
  - Colours come only from `frontend/src/theme/tokens.ts` → `--app-*` CSS vars, with no hard-coded colours. Light and dark token keys must match.
  - WCAG AA contrast is enforced by `frontend/src/theme/__tests__/contrast.test.ts`.
  - Sender HTML in mail content must never inherit theme styles.
- **User-facing copy:** add new strings to `frontend/src/i18n/message-registry.ts` with `en` + `zh`. Other locales fall back to English. Don't overstate what encryption protects; keep copy consistent with the About page.
- **No public pointers to `/admin`.** The header Admin link only shows once authenticated.

### Config and local dev
- `worker/wrangler.toml` is **gitignored** and holds production secrets. Never commit it or paste its values anywhere. It is derived from `wrangler.toml.template`.
- In `wrangler.toml`, top-level keys such as `send_email` must come **before** the first `[table]` (e.g. `[assets]`), and `[triggers]` gets its own table. A key placed under a table header silently belongs to that table.
- Local dev:
  - `mise run dev` runs the worker on :8787 with local D1. `.dev.vars` overrides vars (Turnstile test keys, encryption on).
  - `mise run dev:frontend` runs Vite. `frontend/.env.development.local` points it at :8787.
  - The production build uses `frontend/.env` with an empty `VITE_API_BASE`, because the worker serves `frontend/dist` from the same origin.
- Deploy: `mise run deploy` runs the tests, then the production frontend build, then `wrangler deploy`. After a schema change, run the production migration via Admin → Database → Migrate or `ADMIN_AUTH=… mise run db:migrate`. After pulling new dependencies, mise tasks run `pnpm install` first.

### Changelogs
- Fork changes go into **`CHANGELOG_DECRYPTS.md`** under `## Unreleased` (English only). Do **not** add fork entries to `CHANGELOG.md` / `CHANGELOG_EN.md` any more; those are upstream's files. Existing fork entries in them stay as they are, because `main` is never rewritten.

### Releases
- Fork releases are tagged **`decrypts-vX.Y.Z`** (annotated, SemVer: major = breaking config/DB steps needing manual action, minor = features, patch = fixes). The `decrypts-` prefix keeps them out of `v*`, which `mise run upstream:check`/`upstream:merge` rely on.
- The repo-root **`VERSION`** file holds the fork version (single line); both `package.json` files keep upstream's version, so upstream merges don't conflict.
- Cut a release with **`mise run release`** (`VERSION=X.Y.Z`; `DRY_RUN=1` rehearses on a throwaway worktree, `SKIP_E2E=1` skips e2e). It runs tests, renames `## Unreleased`, commits, tags, builds the assets into `release/` and publishes to GitHub Releases.
- **Never `git push --tags`** — it would copy all of upstream's `v*` tags into the fork. The release script pushes `main` plus the one new tag with `git push --atomic origin main refs/tags/decrypts-vX.Y.Z`.

### Project notes
- `docs/decisions.md`: dated decisions (deploy branch, encryption design, key export, theme). Add a line when you make a lasting decision.
- `docs/backlog.md`: open work and owner to-dos.
- `docs/changes/*.md`: specs for larger changes.
- The commit and docs (zh + en) rules in the sections below still apply to fork work. Fork changelog entries are the exception: they go to `CHANGELOG_DECRYPTS.md` only (see "Changelogs" above).

## Agent Skills

- Keep project skills in `.agents/skills/` as the source of truth.
- `.claude/skills` is a symlink to `../.agents/skills` for Claude Code compatibility.

## Project Structure

- **Backend**: `worker/` — Cloudflare Workers API using Hono framework. Entry: `worker/src/worker.ts`, APIs under `worker/src/*_api/`.
- **Frontend**: `frontend/` — Vue 3 + Naive UI app deployed to Cloudflare Pages. Routes in `frontend/src/router/`.
- **Pages middleware**: `pages/functions/_middleware.js` — Routes API calls to Worker backend.
- **Mail parser**: `mail-parser-wasm/` — Rust WASM email parser.
- **SMTP/IMAP proxy**: `smtp_proxy_server/` — Python proxy server.
- **DB schema/migrations**: `db/` — SQLite via Cloudflare D1, dated migration patches.
- **Docs**: `vitepress-docs/` — VitePress documentation site (zh + en).
- **E2E tests**: `e2e/` — Playwright tests in Docker Compose (API, browser, SMTP proxy).
- **Changelogs**: `CHANGELOG.md` (中文) + `CHANGELOG_EN.md` (English).

## Build & Dev Commands

Run inside each subfolder with `pnpm`:

| Folder | Dev | Build | Lint | Deploy |
|--------|-----|-------|------|--------|
| `worker/` | `pnpm dev` | `pnpm build` | `pnpm lint` | `pnpm deploy` |
| `frontend/` | `pnpm dev` | `pnpm build` | — | `pnpm deploy` |
| `vitepress-docs/` | `pnpm dev` | `pnpm build` | — | — |
| `mail-parser-wasm/` | — | `wasm-pack build --release` | — | — |

SMTP proxy: `pip install -r smtp_proxy_server/requirements.txt` then `python smtp_proxy_server/main.py`.

## E2E Tests

Tests run in Docker Compose with Playwright. From `e2e/`:

```bash
npm test              # Build, run all tests, exit
npm run test:down     # Clean up containers
```

Test suites under `e2e/`: `api/`, `browser/`, `webhook/` (Webhook UI), `smtp-proxy/`, `wasm/`, and `unit/`, each with its own `tests/` directory. Shared fixtures stay in `fixtures/`; WASM-specific configuration, fixtures, and scripts stay in `wasm/`.

The Docker frontend serves over **HTTPS** (self-signed cert) with Vite proxy to worker — required for WebAuthn (`navigator.credentials`) and `crypto.subtle` which need a secure context. Browser tests use `ignoreHTTPSErrors: true`.

Key patterns for browser tests:
- Frontend hashes passwords with SHA-256 (`crypto.subtle`) before sending — API test registration must use pre-hashed passwords if UI login is needed.
- VueUse `useStorage('key', '')` with string default uses **raw string** serialization — set localStorage with raw value, not `JSON.stringify()`.
- WebAuthn browser tests use CDP virtual authenticator (`WebAuthn.enable` + `WebAuthn.addVirtualAuthenticator`).

## Architecture

### Worker Auth Flow (`worker/src/worker.ts`)

Three auth layers applied via Hono middleware, each using different headers:

| Path prefix | Header | Purpose |
|-------------|--------|---------|
| `/api/*` | `Authorization: Bearer <jwt>` | Address (mailbox) credential |
| `/user_api/*` | `x-user-token` | User account JWT |
| `/admin/*` | `x-admin-auth` | Admin password |
| (any) | `x-user-access-token` | User role-based access token |
| (any) | `x-custom-auth` | Optional global access password |
| (any) | `x-lang` | Language preference (`en`/`zh`) |

Public endpoints (no auth): `/open_api/*`, `/user_api/login`, `/user_api/register`, `/user_api/passkey/authenticate_*`, `/user_api/oauth2/*`.

### Worker Email Flow (`worker/src/email/`)

Cloudflare Email Worker entry: `email()` in `worker/src/email/index.ts`. Processing pipeline:
1. Parse raw email → check junk → check address exists
2. Auto-reply if configured → forward if configured → webhook if enabled
3. Store in D1 database

### Frontend State (`frontend/src/store/index.js`, `frontend/src/api/index.js`)

Global state via VueUse `useStorage` for persistence. The `api` module wraps axios with auto-attached auth headers and fingerprinting. API base URL comes from `VITE_API_BASE` env var (empty = same origin).

## Coding Style

- `worker/` uses TypeScript + ESLint; `frontend/` uses Vue SFCs.
- Keep existing naming patterns: `*_api/` folders, `utils/`, `models/`.
- ESM imports only (`type: module`).
- Prefer `const` for request data. Parse request JSON directly with `const settings = await c.req.json<T>()`; let the existing global error handler handle parsing failures. Do not add local `try/catch` or `.catch(() => null)` just to suppress or repackage those errors. Keep business validation and necessary recovery logic; JSON editor parsing may catch errors to show invalid drafts.

## Commits & PRs

- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `perf:`.
- Commit messages, PR titles, and PR descriptions must be written in English.
- PR descriptions should explain scope and include screenshots for UI changes.
- Use squash merge for PRs.

## Post-Task Checklist (IMPORTANT)

After completing any feature, bug fix, or improvement, **always check**:

1. **CHANGELOG.md** (中文) and **CHANGELOG_EN.md** (English) — both must be updated under the current `(main)` version section with the change entry. Follow the existing format: `- feat/fix/docs: |模块| 描述`.
2. **Documentation** — if the change involves new environment variables, new API endpoints, or configuration changes, update the corresponding docs in `vitepress-docs/docs/zh/` and `vitepress-docs/docs/en/`. Key files:
   - `guide/worker-vars.md` — Worker environment variables
   - `guide/ui/` — Frontend deployment docs
   - `guide/feature/` — Feature-specific docs
   - `api/` — API reference docs
3. **Both languages** — docs and changelogs exist in Chinese and English; always update both.

## Config

- Worker settings in `worker/wrangler.toml` (see `wrangler.toml.template` for bindings).
- Frontend uses `VITE_*` env vars. Don't commit secrets.
