# Backlog

1. Ship the accumulated `main` (7 commits ahead of origin, nothing deployed since the encryption hardening): cut a release (`VERSION=X.Y.Z mise run release`, a minor — burn account, passkey clarity, mailbox passkey login), then `mise run deploy`, then review in a browser (light and dark, phone and desktop) including the passkey login/setup flows, the Phosphor theme, About/help, code chips, alerts, shortcuts, backup reminder, QR and burn.
2. Done 2026-11-20: auto cleanup on production is mail 7 days, unknown-address mail 1, sent mail 7, inactive addresses 30 (the unbound-address rule is off). The hourly cron is in the local `wrangler.toml`.
3. Sending: onboard `decrypts.net` in Cloudflare Email Service (Workers Paid), check the DMARC record, and set the Admin send limits (suggested 50/day, 1,000/month). The `send_email` binding and `SEND_MAIL_DOMAINS` are already in the local `wrangler.toml`.
4. GitHub OAuth2: set User Info URL `https://api.github.com/user/emails` and User Email Key `$[?(@.primary==true && @.verified==true)].email` in Admin → User → Oauth2 Settings.
5. Done: passkey-only account sign-up. Enable it in Admin → User → User Settings after deploying.
6. Optional: send-access request notifications (Telegram/email), a pending filter in Sender Access Control, and request status for users.
7. Optional: an admin role for the owner (`ADMIN_USER_ROLE` + `USER_ROLES`), an address block list for reserved names, `PREFIX = ""`, secrets moved to `wrangler secret put`, and `[observability]`.
8. Optional: locales other than en/zh for the fork's new strings.
9. Next upstream release (v1.15.0 or later): `mise run upstream:check`, then `mise run upstream:merge`. Upstream `main` already has untagged refactors of address creation and the mail parser (#1251–#1254) that will likely conflict with the encryption changes.
