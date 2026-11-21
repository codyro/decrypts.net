# Mail API

## Mailbox Password JWT Validation and Renewal

Mailbox APIs accept legacy mailbox credentials and password sessions containing `type: "address_password_login"`, `address`, `address_id`, `iat`, and `exp`. The backend verifies signatures and mailbox identity, and requires password sessions to be unexpired, issued no later than the current time, and valid for no more than 30 days.

- Mailbox APIs retain `Authorization: Bearer <jwt>` without a database migration.
- `GET /api/settings` returns only `address`, `send_balance`, and `new_address_token`. A valid password-session JWT with less than seven days remaining receives a new 30-day token; otherwise the field is `null`. Legacy credentials do not renew, and expired sessions must log in again.
- Clients must replace their current token only when `new_address_token` is non-null; when it is `null`, keep using the current token.

The web client updates only the active JWT from one successful settings response. The local cache retains token strings and its existing append and bind behavior, without replacing or deduplicating historical tokens. Switching to an expired cached session requires logging in again. JWT decoding is only for mailbox, login-method, and token-expiry display; authorization remains on the backend.

With both `ENABLE_ADDRESS_PASSWORD=true` and `ADDRESS_PASSWORD_LOGIN_ONLY=true`, password login, mailbox creation, and authorized user, admin, and Telegram access issue 30-day password-session JWTs for mailbox API access and renewal through settings below seven days. With `ENABLE_ADDRESS_PASSWORD=false`, password login returns 403. With mailbox passwords enabled and `ADDRESS_PASSWORD_LOGIN_ONLY=false`, password login issues legacy credentials. Creation and other authorized entry points issue legacy credentials whenever password-only mode is ineffective. Previously issued valid sessions remain usable and renewable. Legacy credentials, credential-login links, and direct API access remain compatible. API clients must replace their current token only when `new_address_token` is non-null. Changing the mailbox password does not revoke issued JWTs. A session renewed before every expiry has no fixed end date.

The UI keeps session-token access and shows the token expiry time. Auto-login links and QR codes using that token expire at the same time. Password-only mode hides legacy credential contents, connection details, and legacy mailbox-switching options. The management table retains legacy cache entries for manual removal and hides their switch action. The selector still shows the known current mailbox. Disabling the switch restores legacy cache switching.

Telegram retains its separate permanent internal binding tokens. Expiry is ignored only for stored historical bindings read after Telegram authentication, with signature and mailbox identity still checked. New bindings require normal mailbox authentication.

## Viewing Emails via Mail API

This is a `python` example using the `requests` library to view emails.

```python
limit = 10
offset = 0
res = requests.get(
    f"https://<your-worker-address>/api/mails?limit={limit}&offset={offset}",
    headers={
        "Authorization": f"Bearer {your-JWT-password}",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
        "Content-Type": "application/json"
    }
)
```

**Note**: `/api/mails` returns raw RFC822 data by design (for example `source`/`raw`), and it does not guarantee parsed fields such as `subject`, `text`, or `html`. Parse the raw source on the client side (for example with `mail-parser-wasm` or `postal-mime`) if you need readable message content.

## Admin Mail API

Supports `address` filter

```python
import requests

url = "https://<your-worker-address>/admin/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address is optional parameter
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**Note**: `/admin/mails` follows the same design as `/api/mails`: it returns stored raw MIME data. If you need readable subject/body, parse the raw content on the client side.

**Note**: Keyword filtering has been removed from the backend API. If you need to filter emails by content, please use the frontend filter input in the UI, which filters the currently displayed page.

## Mailbox Encryption API

Requires `ENABLE_MAIL_ENCRYPTION` and the database migration; see [Mailbox Encryption](./mail-encryption.md).

Get the encryption public key of the current address:

```
GET /api/address_encryption
# -> { "enabled": true, "publicKey": <base64url P-256 public key or null> }
```

Set or clear the key (body is `{ "publicKey": <base64url|null> }`, requires `Authorization: Bearer <address JWT>`):

```
POST /api/address_encryption
```

- `publicKey: null` clears the key; new mail is then stored as plaintext while already encrypted mail stays encrypted
- For encrypted addresses, `/api/mails` / `/api/mail/:id` return the `cfte1.` ciphertext envelope in `raw`; decrypt it client-side with the private key (see the decrypt snippet in [Mailbox Encryption](./mail-encryption.md)). The sendbox APIs likewise return envelopes for sent mail of encrypted addresses.
- Rows returned by the mail, sendbox, list, and detail APIs all carry an `is_encrypted` field (0/1), so clients can tell encrypted rows apart without inspecting the `raw` prefix.
- Existing plaintext mail can be re-encrypted via `GET /api/encrypt_existing/pending` + `POST /api/encrypt_existing`; see [Mailbox Encryption](./mail-encryption.md).
- `/api/parsed_mails` / `/api/parsed_mail/:id` return a placeholder for encrypted mail: `encrypted: true`, `subject: "[Encrypted mail]"`, empty `text`/`html`, and `attachments: []`

## Mail Read Status API

Enable `ENABLE_MAIL_READ_STATUS` and upgrade the database first. Historical mail has `is_unread = NULL` and is treated as read; new mail has `is_unread = 1`. Opening unread mail from the web mail list marks it as read, and its detail view can switch the state manually. Refreshing the page does not mark it as read:

- `PATCH /api/mails/:id/read`: set one mail belonging to the current address; use `{ "isUnread": true }` for unread or `{ "isUnread": false }` for read

## Admin Get Mail API

Fetch a single mail by mail ID without a mailbox JWT. Authenticate with `x-admin-auth`.
The response matches one entry returned by `/admin/mails`: gzip-compressed raw content is decompressed into `raw`, and `raw_blob` is excluded.

```python
import requests

mail_id = 1
url = f"https://<your-worker-address>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.get(url, headers=headers)

print(response.json())
```

## Admin Delete Mail API

Delete a single mail by mail ID.

```python
import requests

mail_id = 1
url = f"https://<your-worker-address>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Delete Address API

Delete an email address by address ID (also deletes associated mails, sender permissions, and user bindings).

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/delete_address/{address_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Clear Inbox API

Clear all received mails for an address by address ID.

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/clear_inbox/{address_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## Admin Clear Sent Items API

Clear all sent mails for an address by address ID.

```python
import requests

address_id = 1
url = f"https://<your-worker-address>/admin/clear_sent_items/{address_id}"

headers = {
        "x-admin-auth": "<your-Admin-password>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## User Mail API

::: warning Note: User JWT vs Address JWT
These endpoints use a **User JWT** (obtained via `/user_api/login` after registration), with the `x-user-token` header. Binding an address also requires an Address JWT in the same request.

**Do not confuse with Address JWT**:
- Address JWT uses `Authorization: Bearer <jwt>` to access `/api/*` endpoints
- User JWT uses `x-user-token: <jwt>` to access `/user_api/*` endpoints
:::

### Bind an Email Address to a User Account

Binding associates an existing mailbox with the currently logged-in user account so it can be managed in the user center. For Telegram bindings, see [Telegram Bot](./telegram.md#per-user-mail-push).

`POST /user_api/bind_address` requires both credentials:

| Header | Value |
| --- | --- |
| `x-user-token` | The current account's User JWT, from the `jwt` field returned by `POST /user_api/login` |
| `Authorization` | `Bearer <Address-JWT>`, using the `jwt` returned when [creating a mailbox](./new-address-api.md) or the Address JWT obtained after mailbox login |

No request body is required. User and mailbox identities come from these two JWTs; `user_id`, `address_id`, and email addresses cannot be supplied through the request body. Include `x-custom-auth` if the site requires an access password.

```python
import requests

response = requests.post(
    "https://<your-worker-address>/user_api/bind_address",
    headers={
        "x-user-token": "<your-user-JWT-token>",
        "Authorization": "Bearer <your-address-JWT>",
        # "x-custom-auth": "<your-site-password>",
    },
)
print(response.json())  # {"success": True}
```

Success returns `{"success": true}`; binding the same address to the same user again also succeeds. An address already bound to another user or a user who has reached their address limit results in 400.

### Bound Address List

`GET /user_api/bind_address` uses server-side pagination and accepts these query parameters:

Requests without pagination parameters return the default first page. Fetching all bound addresses in one request is not supported.

| Parameter | Default | Description |
| --- | --- | --- |
| `limit` | `20` | Page size, from 1 to 100 |
| `offset` | `0` | Pagination offset |
| `query` | Empty | Optional email address keyword filter for the current user's bound addresses; at most 100 characters, without `%` or `_` (invalid queries return 400) |

The `results` array contains only the current page. The filtered total is queried only when `offset=0`; later pages return `count: 0`, so clients should retain the total from the first page.

```python
import requests

url = "https://<your-worker-address>/user_api/bind_address"
headers = {
    "x-user-token": "<your-user-JWT-token>",
}
querystring = {
    "limit": "20",
    "offset": "0",
}
response = requests.get(url, headers=headers, params=querystring)
print(response.json())
```

### Get an Address JWT for a Bound Mailbox

`GET /user_api/bind_address_jwt/:address_id` uses the User JWT and only returns credentials for mailboxes bound to the current user. Obtain `address_id` from `results[].id` in the bound address list above. Use the returned `jwt` as `Authorization: Bearer <jwt>` for `/api/*` mailbox endpoints.

```python
import requests

address_id = 1
response = requests.get(
    f"https://<your-worker-address>/user_api/bind_address_jwt/{address_id}",
    headers={
        "x-user-token": "<your-user-JWT-token>",
        # "x-custom-auth": "<your-site-password>",
    },
)
print(response.json())  # {"jwt": "..."}
```

### Unbind an Email Address

`POST /user_api/unbind_address` uses the User JWT with a body of `{"address_id": 1}` and returns `{"success": true}` on success. It removes only the current user's association with the mailbox, without deleting the mailbox or its messages or revoking issued Address JWTs. Save the mailbox credential before unbinding to retain access or bind it again later.

```python
import requests

response = requests.post(
    "https://<your-worker-address>/user_api/unbind_address",
    headers={
        "x-user-token": "<your-user-JWT-token>",
        # "x-custom-auth": "<your-site-password>",
    },
    json={"address_id": 1},
)
print(response.json())  # {"success": True}
```

### Burn account

::: danger Permanent deletion
Burning permanently deletes the signed-in user account **and every mailbox bound to it, with all of their mail**, plus the account's passkeys, roles and key backups. It cannot be undone.
:::

Available only when the administrator sets `ENABLE_USER_BURN_ACCOUNT = true` (both endpoints return 403 otherwise). Requires the User JWT (`x-user-token`), is rate limited like `/user_api/register`, and always requires fresh re-authentication: the account password (SHA-256 hex, same as login) or a passkey assertion, plus an exact confirmation phrase (`burn my account`).

```
POST /user_api/burn_account/challenge
     # body: { "domain": "<rpID, e.g. example.com>" }
     # -> WebAuthn authentication options whose allowCredentials are limited
     #    to this user's registered passkeys. The challenge is a signed JWT
     #    (purpose "burn_account", bound to this user, 5 min validity).

POST /user_api/burn_account
     # body: { "confirm": "burn my account",
     #         "password": "<sha256 hex>",            # password accounts
     #         "credential": <webauthn assertion>,    # passkey instead
     #         "origin": "<origin>", "domain": "<rpID>" }  # with credential
     # -> { "success": true, "deleted_addresses": ["a@x.com", ...] }
```

- Passkey-only accounts (see [Passkey Sign-up](#passkey-sign-up)) must confirm with a passkey assertion verified against the burn challenge; the credential must belong to the current user (another user's passkey returns 401). Password accounts may use either their password or a passkey assertion.
- A wrong confirmation phrase returns 400; a wrong password or a bad/missing assertion returns 401.
- `deleted_addresses` lists every mailbox that was deleted, so the browser can remove its local private keys and saved logins for them. After the burn, the old User JWT and the Address JWTs of the deleted mailboxes no longer work.
- Admin deletion (`DELETE /admin/users/:user_id`) removes the same per-user rows (`users_address`, `user_key_backups`, `user_passkeys`, `user_roles`, `users`); it keeps the historical behaviour of unlinking bound mailboxes unless the request body sets `"burn_addresses": true`, which deletes the bound mailboxes with their data as well.

```python
import requests

response = requests.post(
    "https://<your-worker-address>/user_api/burn_account",
    headers={"x-user-token": "<your-user-JWT-token>"},
    json={
        "confirm": "burn my account",
        "password": "<sha256 hex of the account password>",
        "origin": "https://<your-frontend-address>",
    },
)
print(response.json())  # {"success": True, "deleted_addresses": [...]}
```

### Passkey Sign-up

Public endpoints (no User JWT) that create an account with only a passkey — no email and no password. Both require the administrator to enable **Allow User Register** and **Allow Passkey Sign-up** in Admin → User Settings (otherwise they return 403), and they are rate limited like `/user_api/register`.

```
POST /user_api/passkey/signup_request
     # body: { "domain": "<rpID, e.g. example.com>", "cf_token": "<turnstile token>" }
     # -> WebAuthn registration options: residentKey "required", userVerification "preferred",
     #    user.name/displayName "<site title> account <suffix>", prf extension requested.
     #    The challenge is a server JWT binding the new account's
     #    pk-<random>@passkey.invalid pseudo-email (5 min validity).

POST /user_api/passkey/signup_response
     # body: { "origin": "<origin>", "credential": <WebAuthn attestation> }
     # -> { "jwt": "<user JWT>" } — the account is created (user, passkey and
     #    default role in one batch) and logged in immediately.
```

- The pseudo-email uses the reserved `.invalid` TLD and can never receive mail; password login, verification codes and OAuth2 login reject any email ending in `.invalid`.
- The stored password is the sentinel `!passkey-only`, which no password login can match; the passkey is the only sign-in method. Deleting the last passkey of such an account is refused (400).
- `USER_DEFAULT_ROLE` is assigned when set. Subsequent logins use the regular passkey authenticate endpoints (the credential is discoverable, so `allowCredentials` stays empty).

### Passkey backup storage

`/user_api/key_backups` stores **passkey (WebAuthn PRF) protected backups** — opaque blobs of the mailbox encryption private key wrapped by a PRF-derived key — so a logged-in user account can restore the decryption key on a new device. Available only when `ENABLE_MAIL_ENCRYPTION` is enabled (returns 400 otherwise); requires the User JWT (`x-user-token`) and the address must be bound to the current account.

```
GET    /user_api/key_backups?address=<address>
       # -> [{ "id": <n>, "address": "<address>", "key_id": "<b64url public key>",
       #      "passkey_id": "<credential id>", "blob": "<b64url blob>",
       #      "created_at": "<UTC timestamp>", "updated_at": "<UTC timestamp>" }]

PUT    /user_api/key_backups
       # body: { "address": "<address>", "key_id": "<b64url public key>",
       #         "passkey_id": "<own passkey credential id>", "blob": "<b64url blob>" }
       # -> { "success": true }

DELETE /user_api/key_backups/:id
       # -> { "success": true }
```

- All endpoints only ever touch the current user's own data; `GET` requires the `address` to be bound to the current user (400 otherwise).
- `PUT` validation: the address is bound to the current user and has an encryption public key; `key_id` is a valid P-256 public key point (an older/rotated key is allowed); `passkey_id` must be one of the current user's registered passkeys; `blob` is unpadded base64url whose decoded first byte is `0x02` and whose decoded length is 62–4096 bytes. The server **only validates the blob shape and never decrypts it** (see [Mailbox Encryption - Passkey-protected backup](./mail-encryption.md#passkey-protected-backup-webauthn-prf)).
- Caps: 20 per address, 200 per user; re-`PUT`-ing an existing `(address, key_id, passkey_id)` tuple (updating the blob) is always allowed — only new tuples count against the caps; exceeding a cap returns 409.
- Deleting the passkey, deleting the address, unbinding/transferring the address, or deleting the user removes the corresponding backups (DB v0.0.13 adds the `user_key_backups` table; run the database migration first).

```bash
# Upload a passkey-protected backup (the blob is wrapped by the browser via WebAuthn PRF)
curl -X PUT "https://<your-worker-address>/user_api/key_backups" \
  -H "x-user-token: <your-user-JWT-token>" \
  -H "Content-Type: application/json" \
  -d '{"address": "xxxx@awsl.uk", "key_id": "<b64url public key>", "passkey_id": "<credential id>", "blob": "<b64url blob>"}'
```

### User Mail List

Supports `address` filter

```python
import requests

url = "https://<your-worker-address>/user_api/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address is optional parameter
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-user-token": "<your-user-JWT-token>",
        # "x-custom-auth": "<your-website-password>", # If private site password is enabled
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**Note**: `/user_api/mails` also returns raw RFC822 content from storage; parse it in your client to extract `subject`, `text`, and `html`.

**Note**: Keyword filtering has been removed from the backend API. If you need to filter emails by content, please use the frontend filter input in the UI, which filters the currently displayed page.
