# Mailbox Encryption

Optional per-mailbox end-to-end encryption of stored mail: when enabled, the worker holds only the address **public key** and encrypts each incoming mail's whole raw MIME before storing it. The **private key lives only in the browser** (a decryption link shown once at creation + a non-extractable WebCrypto key in IndexedDB), is never sent to any server, and the frontend decrypts and parses mail client-side.

Controlled by the worker variable `ENABLE_MAIL_ENCRYPTION`, off by default.

## Threat model

- The server stores only ciphertext of the raw MIME (a `cfte1.` envelope). Encrypted rows keep no plaintext metadata: `source` is blanked to `''` and `message_id` to `NULL` (the real sender and Message-ID live inside the encrypted MIME headers and are shown by the browser after decryption). Plaintext metadata kept at rest: address, timestamps, read status, size, and the `is_encrypted` flag.
- Mail passes through the worker in plaintext at receipt time: junk checking, oversized-attachment removal, and auto-reply still run (auto-reply only uses headers and configured content).
- **This protects data at rest.** A malicious or compromised worker could still capture mail content at receipt before encryption; the feature does not defend against worker compromise.
- Private keys are stored as **non-extractable WebCrypto `CryptoKey`s**: local XSS can no longer read or export the raw private key, but while the page is open XSS can still invoke the key to decrypt mail — use trusted devices and mind browser extension hygiene; the strict CSP enabled in production builds (see [Cloudflare Pages frontend](/en/guide/ui/pages#content-security-policy)) significantly reduces the XSS risk.
- Clearing browser data (IndexedDB) deletes the private keys unless you saved a plaintext decryption link, a passphrase-protected backup, or a passkey-protected backup; recovering a passphrase-protected backup requires the passphrase, and a passkey backup requires the corresponding passkey.

## Skipped features for encrypted mailboxes

To avoid leaking content, addresses with an encryption public key skip every ingest path that depends on server-side parsing:

- Mail forwarding (internal rules and global forwarding)
- AI email extraction
- Another-worker RPC enhancement

Junk/blacklist/unknown-address checks and auto-reply are unaffected.

## Content-free notifications

These notification paths are no longer skipped entirely, but send content-free notices for encrypted mailboxes:

- The Telegram push sends a fixed "new encrypted mail" message with no sender, subject, body, or attachments; when a mini-app URL is configured, the push still includes the mini-app button. Interactive bot queries of encrypted mail still reply "this mail is encrypted" without content.
- Every enabled webhook (global and per-address, whichever are enabled) is called with a body containing only `{ "encrypted": true, "address": "<address>", "mail_id": <number>, "created_at": "<SQLite UTC timestamp>" }`; the configured body template and filters are bypassed.

## Sent mail (sendbox)

For encrypted addresses, sent mail is likewise stored as a `cfte1.` envelope (the envelope plaintext is the same JSON the plaintext path stores) and flagged `is_encrypted = 1`; on encryption failure the sendbox save is skipped and plaintext is never stored. The web sendbox view decrypts client-side and renders as usual, or shows the row locked when no usable private key is stored; admin and user-center sendbox views have no keys, so encrypted rows always stay locked there.

## The is_encrypted flag

DB v0.0.12 adds an explicit `is_encrypted` column to `raw_mails` and `sendbox` and backfills existing envelopes (run `Admin -> Quick Setup -> Database -> Migrate Database` or `POST /admin/db_migration`). On a migrated database the flag — not the `cfte1.` prefix — decides whether a row is encrypted, so sender-controlled plaintext with a forged prefix is not mistaken for an envelope; un-migrated databases fall back to the prefix check, where such plaintext displays as locked. Rows returned by the mail list, detail, and sendbox APIs all carry `is_encrypted` (0/1), so clients can tell envelopes apart without inspecting the `raw` prefix.

## Envelope format

```
cfte1. + base64url( ephPubRaw(65B, P-256 uncompressed) || iv(12B) || AES-GCM(ciphertext||tag) )
```

- KDF: ECDH(ephemeral private key, recipient public key) → HKDF-SHA256(salt = ephPubRaw, info = `"cf-temp-email/mail-encryption/v1"`) → AES-256-GCM key; AAD = `"cfte1"`.
- Plaintext = 1 flag byte (`0` = raw UTF-8 MIME, `1` = gzip(UTF-8 MIME)) + content. Compression happens before encryption (only when `ENABLE_MAIL_GZIP` is also enabled).
- The public key is stored/transported as base64url of the raw 65-byte uncompressed point; the private key is base64url PKCS8.

## Key handling

- The key pair (P-256) is **generated in the browser**; only the public key is uploaded and stored with the address.
- Private keys are persisted only as **non-extractable WebCrypto `CryptoKey`s** (ECDH P-256) in browser IndexedDB (database `cf-temp-email-keys`); the raw key string is never stored. Multiple keys per address are kept (newest first, deduplicated by public key), so mail encrypted under a rotated key stays readable.
- Legacy plaintext keys in localStorage (`mailPrivateKeys`) are migrated into IndexedDB on first load. Once the migration is verified, a one-time backup prompt offers: set a passphrase to create protected backups and then delete the plaintext copy, "skip and delete now", or "later" (the plaintext copy stays until you answer). When IndexedDB is unavailable (e.g. some private browsing modes), keys live in memory for the session only, the UI shows a warning, and the legacy localStorage plaintext copy is kept (the only durable copy is never deleted into volatile storage).
- **The raw private key / plaintext `#k=` link is shown only once, at creation** (likewise on rotation, import, and admin single creation); the frontend never regenerates the plaintext link afterwards. The later "copy decryption link" / "export" actions emit only the stored passphrase-protected backup (`#kp=`, see below); you can also create a protected backup later in Account Settings via "Create protected backup from my key" by pasting the raw key or a `#k=` link again (verified against the stored public key) — either passphrase- or passkey-protected (see below).
- **Losing the private key with no backup = unrecoverable mail**: the server cannot decrypt and there is no backdoor.
- **Encrypting existing mail is irreversible**: once plaintext rows are replaced by envelopes, only the private key holder can read them; losing the key makes those mails permanently unrecoverable (see the API below).
- Disabling encryption (clearing the public key) stores new mail as plaintext again; previously encrypted mail stays encrypted.
- The admin batch-creation export CSV still contains raw private keys (a creation-time artifact); treat the file as secret.

## Passphrase-protected backup (`#kp=`)

Because of a WebCrypto limitation (a non-extractable key cannot be exported or wrapped), a passphrase-protected backup can only be created while the raw key is still in memory: at creation, rotation, import, or legacy migration — or later by pasting the raw key / link again via "Create protected backup from my key". After creation the backup blob is stored on the key record in IndexedDB.

- KDF: PBKDF2-HMAC-SHA256 (600,000 iterations by default; the importer accepts 100,000–5,000,000) deriving an AES-256-GCM key.
- Blob layout: `version(1B = 0x01) ‖ iterations(4B big-endian u32) ‖ salt(16B) ‖ iv(12B) ‖ AES-256-GCM(ciphertext ‖ 16B tag)`, all base64url; the plaintext is the PKCS8 private key and the AAD is `"cfte-kp1:" + address` (a blob cannot be re-labelled to another address).
- Link: `https://your-domain/#kp=<blob>&a=<address>`; opening it prompts for the passphrase, the fragment is stripped from the address bar immediately, and browsers never send fragments to servers.
- File: JSON `{ "format": "cf-temp-email-key-backup", "version": 1, "address": "<address>", "createdAt": "<ISO time>", "kdf": "PBKDF2-SHA256", "blob": "<base64url blob>" }`.
- Passphrase minimum is 10 characters. Argon2 is not used (no extra runtime dependency).
- Plaintext `#k=` links still import; after import the frontend offers protecting the key with a passphrase (skippable).

Node.js example for unwrapping a backup (same logic as `frontend/src/utils/key-backup.js`):

```js
// unwrap-backup.mjs — unwrap a "#kp=" backup blob with WebCrypto (Node 20+)
const b64uToBytes = (v) => new Uint8Array(Buffer.from(v.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
const bytesToB64u = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function unwrapBackup({ blob, address, passphrase }) {
    const bytes = b64uToBytes(blob);
    if (bytes[0] !== 0x01) throw new Error('Unsupported backup version');
    const iterations = new DataView(bytes.buffer, bytes.byteOffset).getUint32(1, false);
    const salt = bytes.slice(5, 21);
    const iv = bytes.slice(21, 33);
    const ciphertext = bytes.slice(33);
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, 256);
    const aesKey = await crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['decrypt']);
    const pkcs8 = new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('cfte-kp1:' + address) }, aesKey, ciphertext));
    return bytesToB64u(pkcs8); // base64url PKCS8 private key — import it, then drop the string
}
```

## Passkey-protected backup (WebAuthn PRF)

In addition to passphrase-protected backups, a **logged-in user account** can protect the mailbox private key with a **passkey** and store it on the server, then restore it on a new device or after clearing browser data.

- **Who gets it (a deliberate decision)**: requires a user account, the address bound to that account, a passkey registered via that account, and a browser with WebAuthn. New passkey registrations request the WebAuthn `prf` extension; older passkeys or authenticators without PRF report "this passkey/browser doesn't support PRF" **at use time** (registration and login are unaffected).
- **Fallback**: mailbox-only visitors (Address JWT, no user account), or passkeys/browsers without PRF, use the passphrase `#kp=` backup (see above); the two are independent.
- **Not implemented alternative**: a future iteration may offer client-only per-address passkeys (no server-side WebAuthn registration; PRF wrap with an address-JWT-authorized blob store); this version does **not** implement it — the user-account scheme is the only one.
- **Wrapping (entirely in the browser)**: an AES-256-GCM wrapping key is derived from the passkey's PRF assertion output (HKDF-SHA256: ikm = PRF output, salt = the random salt inside the blob, info = `"cf-temp-email/key-wrap/prf-v1|" + address + "|" + keyId`, AAD = `"cfte-kpk1:" + address + "|" + keyId`) and wraps the PKCS8 private key. Only the base64url opaque blob `version(1B = 0x02) ‖ salt(32B) ‖ iv(12B) ‖ AES-256-GCM(ciphertext ‖ 16B tag)`, the passkey credential id and the key id are uploaded. **The server never sees the PRF output, the wrapping key or the private key, and cannot unwrap** — it only validates the blob shape (first byte 0x02, 62–4096 bytes decoded).
- **Same constraint as the passphrase backup**: a non-extractable key cannot be wrapped after the fact, so wrapping only happens while the raw key is still in memory: at creation, rotation, import, or later by pasting the raw key/link again via "Create protected backup from my key" in Account Settings.
- **Restore**: on a new device, log in to the account, open Account Settings for the bound address, and click "Restore Key From Passkey" in the passkey backup list — the browser runs the assertion, unwraps the blob, and stores the private key on this device as a non-extractable key. A failed unwrap (wrong key/passkey or tampering) is reported explicitly.
- **Storage**: DB v0.0.13 adds the `user_key_backups` table (run `Admin -> Quick Setup -> Database -> Migrate Database` or `POST /admin/db_migration`); the server stores only the opaque blob. Backups are removed together when the passkey, the address is deleted, the address is unbound/transferred, or the user is deleted. Caps: 20 per address, 200 per user. See [Mail API](./mail-api.md#passkey-backup-storage) for the storage endpoints.

## User flow

1. Operator: set `ENABLE_MAIL_ENCRYPTION = true` (worker var) and run the database migration first (`Admin -> Quick Setup -> Database -> Migrate Database` or `POST /admin/db_migration`) so the `address.encryption_public_key` column exists.
2. User: check "enable mailbox encryption" when creating an address, or enable/rotate/disable it later in Account Settings. After enabling or rotating, if the address still has plaintext mail, the frontend offers to "encrypt existing mail"; a persistent button for it also lives in Account Settings, with progress display and cancel support.
3. On creation the frontend generates the key pair and uploads the public key, then shows the plaintext decryption link **once** and offers to create a passphrase-protected backup (after which you can copy the protected backup link or download the backup file); when logged in to a user account with the address bound, you can alternatively protect the backup with a passkey (see above). Once the dialog is closed the frontend can no longer produce the plaintext link.
4. Admin: in `Admin -> Account`, single creation offers the same opt-in (same one-time plaintext link display and backup prompt); batch creation generates one key pair per address in the browser, and the export CSV includes `private_key` and `decryption_link` columns when any created address is encrypted (the CSV holds raw private keys — treat it as secret).
5. Telegram mini-app: the bind/create tab in the mini app offers the same opt-in checkbox and stores the private key as a non-extractable WebCrypto key in the mini-app webview's IndexedDB (legacy localStorage plaintext is migrated automatically with a backup prompt). The bot `/new` text command has no browser context to generate/store a key and does **not** support encryption (created addresses are plaintext). Encrypted addresses receive a fixed content-free "new encrypted mail" push (with the mini-app button when configured), and bot mail queries (`/mails`) still answer "this mail is encrypted" without content — view encrypted mail in the web app or mini app, which decrypts client-side.

## API (for scripts / agents)

### Get/set the encryption public key

```
GET  /api/address_encryption          -> { "enabled": true, "publicKey": <b64url|null> }
POST /api/address_encryption          body: { "publicKey": <b64url|null> }
```

- Requires `Authorization: Bearer <address JWT>`.
- Whether the feature is enabled is also exposed publicly via the `enableMailEncryption` field of `GET /open_api/settings` (no JWT needed).
- `publicKey: null` clears the key (subsequent mail is stored plaintext; stored mail stays encrypted).
- When the feature is disabled: `GET` returns `{ "enabled": false, "publicKey": null }` and `POST` returns 400.

### Create an encrypted address

`POST /api/new_address`, `POST /admin/new_address` and `POST /telegram/new_address` (Telegram mini-app) accept an optional `encryption_public_key` field (b64url 65-byte P-256 point). An invalid key, or the feature being disabled, returns 400. Admin batch creation issues one `/admin/new_address` call per address, so each address can carry its own key. The bot `/new` command does not accept this field.

### Encrypt existing mail

Two address-JWT endpoints let a script re-encrypt plaintext rows already stored for the address (this is the browser flow described above: the frontend offers it after enabling/rotating a key, and Account Settings keeps a persistent button with progress and cancel):

```
GET  /api/encrypt_existing/pending?box=inbox|sendbox&limit=<1..50>&after_id=<n>
# -> { "publicKey": <b64url>, "remaining": <plaintext rows left>, "results": [{ "id": <n>, "raw": "<plaintext>" }] }

POST /api/encrypt_existing
# body: { "box": "inbox"|"sendbox", "items": [{ "id": <n>, "raw": "<cfte1. envelope>" }] }
# -> { "success": true, "encrypted": [<id>...], "skipped": [{ "id": <id>, "reason": "invalid_envelope"|"not_found"|"already_encrypted" }] }
```

- Both endpoints return 400 when the feature is disabled or the address has no public key.
- `limit` is 1..50 (default 20); each POST accepts at most 50 items; an envelope must decode to 94 B..2 MiB.
- Each item must be a row owned by the JWT address that is currently plaintext; anything else is skipped (`not_found` also covers other addresses' mail).
- The server only validates the envelope shape, **never decrypts**, and cannot verify which public key an envelope was encrypted to — uploading a well-formed envelope encrypted to the wrong key makes the row unreadable, so encrypt with the returned `publicKey`.
- A successful inbox upload also clears `raw_blob`, sets `is_encrypted = 1`, and blanks `source`/`message_id`.
- The loop is idempotent and resumable: re-running it only encrypts whatever plaintext remains.
- **Browser safety check**: if the public key returned by the server matches none of the keys this device stores for the address, the frontend refuses to run "encrypt existing mail" and **uploads nothing** — restore or import the current private key first (passkey backup, passphrase-protected backup, or decryption link), then try again (otherwise the re-encrypted mail could not be decrypted on this device).

Pseudo-code for the loop (encryption uses the same WebCrypto scheme as the decrypt snippet above):

```js
// Fetch a batch of plaintext rows, encrypt each with the server's publicKey, upload the envelopes
let afterId = 0;
for (;;) {
    const { publicKey, results } = await get(
        `/api/encrypt_existing/pending?box=inbox&limit=20&after_id=${afterId}`);
    if (!results.length) break;
    const items = [];
    for (const row of results) {
        items.push({ id: row.id, raw: await encryptMail(publicKey, row.raw, { gzip: false }) });
    }
    await post('/api/encrypt_existing', { box: 'inbox', items });
    afterId = Math.max(...results.map((row) => row.id));
}
```

### Reading and decrypting mail

For encrypted mail, `/api/mails` and `/api/mail/:id` return the `cfte1.` envelope string in `raw` (with `is_encrypted: 1` on the row); the sendbox APIs (`/api/sendbox`, `/user_api/sendbox`, `/admin/sendbox`, etc.) likewise return envelopes for sent mail of encrypted addresses. `/api/parsed_mails` and `/api/parsed_mail/:id` return a placeholder for encrypted mail:

```json
{ "encrypted": true, "subject": "[Encrypted mail]", "sender": "", "text": "", "html": "", "attachments": [] }
```

Node.js example for decrypting with the private key (same logic as `frontend/src/utils/mail-crypto.js`):

```js
// decrypt.mjs — decrypt a "cfte1." envelope with WebCrypto (Node 20+)
const b64uToBytes = (v) => new Uint8Array(Buffer.from(v.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));

export async function decryptMail(privateKeyB64u, envelope) {
    const privateKey = await crypto.subtle.importKey(
        'pkcs8', b64uToBytes(privateKeyB64u), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
    const bytes = b64uToBytes(envelope.slice('cfte1.'.length));
    const ephPub = bytes.slice(0, 65);
    const iv = bytes.slice(65, 77);
    const ciphertext = bytes.slice(77);
    const ephKey = await crypto.subtle.importKey('raw', ephPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephKey }, privateKey, 256);
    const hkdfKey = await crypto.subtle.importKey('raw', shared, { name: 'HKDF' }, false, ['deriveBits']);
    const aesBits = await crypto.subtle.deriveBits(
        { name: 'HKDF', salt: ephPub, info: new TextEncoder().encode('cf-temp-email/mail-encryption/v1'), hash: 'SHA-256' },
        hkdfKey, 256);
    const aesKey = await crypto.subtle.importKey('raw', aesBits, { name: 'AES-GCM' }, false, ['decrypt']);
    const plaintext = new Uint8Array(await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode('cfte1') }, aesKey, ciphertext));
    const flag = plaintext[0], content = plaintext.slice(1);
    if (flag === 0) return new TextDecoder().decode(content);
    if (flag === 1) return await new Response(new Blob([content]).stream()
        .pipeThrough(new DecompressionStream('gzip'))).text();
    throw new Error(`Unknown content flag: ${flag}`);
}
```

## Limitations

- Server-parsed endpoints (`/api/parsed_mails` etc.) return placeholders for encrypted mail — no subject/body/attachments; webhook test send and Telegram parsing are likewise unavailable, and webhook sender filters cannot match encrypted mail (the content-free push bypasses filters entirely). Because encrypted rows have an empty `source`, server-side capabilities that rely on the stored sender (sender search, per-sender statistics) do not cover encrypted mail.
- On an un-migrated database, sender-controlled mail whose raw content happens to start with `cfte1.` displays as locked (the prefix is mistaken for an envelope). After running the database migration (v0.0.12), encryption is recognised by the explicit `is_encrypted` flag, so such mail renders as plaintext.
- Private keys live in browser IndexedDB; clearing browser data loses the keys unless you saved a plaintext decryption link, a passphrase-protected backup, or a passkey-protected backup (recovering a passphrase-protected backup requires the passphrase, a passkey backup requires the corresponding passkey). A protected backup can only be created while the raw key is still in memory (creation/rotation/import/migration, or by pasting the raw key again later).
- The bot `/new` command cannot create encrypted addresses.
