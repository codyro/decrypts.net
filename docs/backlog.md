# Backlog

1. Deploy `fork/main` with `mise run deploy`, then review it in a browser (light and dark, phone and desktop). Nothing since the encryption hardening has been checked visually: the Phosphor theme, About/help, code chips, alerts, shortcuts, backup reminder, QR and burn.
2. Admin → auto cleanup: enable the rules (suggested: mail 7 days, unknown-address mail 1, sent mail 7, inactive addresses 30). The hourly cron is set in the local `wrangler.toml`. The website shows whatever is enabled.
3. Sending: onboard `decrypts.net` in Cloudflare Email Service (Workers Paid), check the DMARC record, and set the Admin send limits (suggested 50/day, 1,000/month). The `send_email` binding and `SEND_MAIL_DOMAINS` are already in the local `wrangler.toml`.
4. GitHub OAuth2: set User Info URL `https://api.github.com/user/emails` and User Email Key `$[?(@.primary==true && @.verified==true)].email` in Admin → User → Oauth2 Settings.
5. Optional: passkey-first account sign-up (with PRF key backup at sign-up).
6. Optional: send-access request notifications (Telegram/email), a pending filter in Sender Access Control, and request status for users.
7. Optional: an admin role for the owner (`ADMIN_USER_ROLE` + `USER_ROLES`), an address block list for reserved names, `PREFIX = ""`, secrets moved to `wrangler secret put`, and `[observability]`.
8. Optional: locales other than en/zh for the fork's new strings.
9. Push `fork/main` to the user's own remote once it is added. Never push to `origin`.
