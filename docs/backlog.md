# Backlog

1. Before deploying the worker with `ENABLE_MAIL_ENCRYPTION = true`, the user runs the three production D1 migrations in order: `2026-11-18-mailbox-encryption.sql`, `2026-11-19-encrypted-flag.sql`, `2026-11-20-key-backups.sql`. Then Admin → Database → Migrate (DB version v0.0.13).
2. Visual review of the UI redesign and the encryption screens on `fork/main`, by the user.
3. Optional: passkey wrapping for mailbox-only users (no account). Currently they fall back to passphrase backups.
4. Optional: locales other than en/zh for the new encryption strings.
5. Push `fork/main` to the user's own remote once it is added. Never push to `origin`.
