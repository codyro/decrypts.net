# Mailbox Encryption

Optional per-mailbox end-to-end encryption of stored mail: when enabled, the worker holds only the address **public key** and encrypts each incoming mail's whole raw MIME before storing it. The **private key lives only in the browser** (URL fragment + localStorage), is never sent to any server, and the frontend decrypts and parses mail client-side.

Controlled by the worker variable `ENABLE_MAIL_ENCRYPTION`, off by default.

## Threat model

- The server stores only ciphertext of the raw MIME (a `cfte1.` envelope). Plaintext metadata kept at rest: sender/envelope source (`source`), address, `message_id`, timestamps, read status.
- Mail passes through the worker in plaintext at receipt time: junk checking, oversized-attachment removal, and auto-reply still run (auto-reply only uses headers and configured content).
- **This protects data at rest.** A malicious or compromised worker could still capture mail content at receipt before encryption; the feature does not defend against worker compromise.

## Skipped features for encrypted mailboxes

To avoid leaking content, addresses with an encryption public key skip every ingest path that depends on server-side parsing:

- Mail forwarding (internal rules and global forwarding)
- Webhook push
- Telegram push (interactive mail viewing replies "this mail is encrypted" without content)
- AI email extraction
- Another-worker RPC enhancement

Junk/blacklist/unknown-address checks and auto-reply are unaffected.

## Envelope format

```
cfte1. + base64url( ephPubRaw(65B, P-256 uncompressed) || iv(12B) || AES-GCM(ciphertext||tag) )
```

- KDF: ECDH(ephemeral private key, recipient public key) → HKDF-SHA256(salt = ephPubRaw, info = `"cf-temp-email/mail-encryption/v1"`) → AES-256-GCM key; AAD = `"cfte1"`.
- Plaintext = 1 flag byte (`0` = raw UTF-8 MIME, `1` = gzip(UTF-8 MIME)) + content. Compression happens before encryption (only when `ENABLE_MAIL_GZIP` is also enabled).
- The public key is stored/transported as base64url of the raw 65-byte uncompressed point; the private key is base64url PKCS8.

## Key handling

- The key pair (P-256) is **generated in the browser**; only the public key is uploaded and stored with the address.
- The private key is shared via a decryption link: `https://your-domain/#k=<privateKey>&a=<address>`. Browsers never send URL fragments to servers; the frontend reads the fragment at startup, validates it, stores it in localStorage, and immediately strips the fragment from the address bar.
- localStorage keeps an array of private keys per address (newest first), so mail encrypted under a rotated key stays readable as long as its private key is still stored.
- The frontend offers a "copy decryption link" button to import the key on another device.
- **Losing the private key = unrecoverable mail**: the server cannot decrypt and there is no backdoor.
- Disabling encryption (clearing the public key) stores new mail as plaintext again; previously encrypted mail stays encrypted.
- A private key in localStorage means local XSS could read mail plaintext; use trusted devices and mind browser extension hygiene.

## User flow

1. Operator: set `ENABLE_MAIL_ENCRYPTION = true` (worker var) and run the database migration first (`Admin -> Quick Setup -> Database -> Migrate Database` or `POST /admin/db_migration`) so the `address.encryption_public_key` column exists.
2. User: check "enable mailbox encryption" when creating an address, or enable/rotate/disable it later in Account Settings.
3. On creation the frontend generates the key pair, uploads the public key, and shows a decryption link to save.
4. Admin: in `Admin -> Account`, single creation offers the same opt-in; batch creation generates one key pair per address in the browser, and the export CSV includes `private_key` and `decryption_link` columns when any created address is encrypted.
5. Telegram mini-app: the bind/create tab in the mini app offers the same opt-in checkbox and stores the private key in the mini-app webview. The bot `/new` text command has no browser context to generate/store a key and does **not** support encryption (created addresses are plaintext). Encrypted addresses never receive Telegram push, and bot mail queries (`/mails`) answer "this mail is encrypted" without content — view encrypted mail in the web app or mini app, which decrypts client-side.

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

### Reading and decrypting mail

`/api/mails` and `/api/mail/:id` return the `cfte1.` envelope string in `raw` for encrypted mail. `/api/parsed_mails` and `/api/parsed_mail/:id` return a placeholder for encrypted mail:

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

- Server-parsed endpoints (`/api/parsed_mails` etc.) return placeholders for encrypted mail — no subject/body/attachments; webhook test send and Telegram parsing are likewise unavailable.
- On a non-encrypted address, sender-controlled mail whose raw content happens to start with `cfte1.` displays as locked (by design: encryption is detected by the envelope prefix).
- Private keys live in localStorage; clearing browser data loses the keys unless you saved a decryption link.
- Encrypted addresses never receive Telegram push, and the bot `/new` command cannot create encrypted addresses.
