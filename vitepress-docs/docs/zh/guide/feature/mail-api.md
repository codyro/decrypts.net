# 查看邮件 API

## 邮箱密码登录 JWT 的鉴权与续期

邮箱 API 支持两种 JWT：原有邮箱凭据，以及带 `type: "address_password_login"`、`address`、`address_id`、`iat` 和 `exp` 的密码登录会话。后端继续校验签名和邮箱身份，并要求密码登录会话未过期、签发时间不晚于当前时间、有效期不超过 30 天。

- 邮箱 API 继续使用 `Authorization: Bearer <jwt>`，无需数据库迁移。
- `GET /api/settings` 仅返回 `address`、`send_balance` 和 `new_address_token`。有效密码登录 JWT 剩余不足 7 天时返回新的 30 天 token，否则为 `null`；原有凭据不会续期，已过期 JWT 必须重新登录。
- 仅当 `new_address_token` 非 `null` 时，客户端才应保存它并替换当前 token；为 `null` 时继续使用当前 token。

网页通过一次成功的 settings 请求仅更新当前使用的 JWT。本地缓存继续保存 token 字符串，沿用原来的追加和绑定逻辑，不替换或去重历史 token；切换到已过期的缓存会话后，需要重新登录。JWT 解码仅用于显示邮箱、登录方式和 Token 到期时间，权限由后端校验。

同时启用 `ENABLE_ADDRESS_PASSWORD=true` 和 `ADDRESS_PASSWORD_LOGIN_ONLY=true` 后，密码登录、创建邮箱以及用户、管理员和 Telegram 授权入口签发 30 天密码登录 JWT，可直接用于邮箱 API，并通过 settings 在剩余不足 7 天时续期。关闭 `ENABLE_ADDRESS_PASSWORD` 后，密码登录接口返回 403。邮箱密码功能开启且 `ADDRESS_PASSWORD_LOGIN_ONLY` 关闭时，密码登录继续签发原有凭据。两项配置未同时启用时，创建及其他授权入口继续签发原有凭据。已签发的有效密码会话仍可使用和续期。旧凭据、凭据登录链接与直接 API 访问继续兼容。API 客户端仅在 `new_address_token` 非 `null` 时替换当前 token。修改邮箱密码不会撤销已签发的 JWT，持续在到期前续期的会话没有固定的结束时间。

网页保留会话 Token 查看入口，显示 Token 的实际到期时间。该 Token 生成的自动登录链接和二维码也在同一时间失效。密码模式隐藏旧凭据内容、连接信息和本地旧凭据切换选项。管理列表保留旧缓存条目供手动删除，并隐藏其切换操作。当前已知邮箱仍显示在选择器中。关闭开关后可恢复旧缓存切换。

Telegram 继续使用独立的永久内部绑定 token。仅对验证 Telegram 身份后读取的历史绑定忽略过期时间，并继续验证签名及邮箱身份。新绑定仍须通过正常邮箱鉴权。

## 通过 邮件 API 查看邮件

这是一个 `python` 的例子，使用 `requests` 库查看邮件。

```python
limit = 10
offset = 0
res = requests.get(
    f"https://<你的worker地址>/api/mails?limit={limit}&offset={offset}",
    headers={
        "Authorization": f"Bearer {你的JWT密码}",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
        "Content-Type": "application/json"
    }
)
```

**注意**：`/api/mails` 按设计返回的是原始 RFC822 数据（如 `source`/`raw`），不保证直接包含 `subject`、`text`、`html` 等已解析字段。若要直接读取正文，请在客户端侧解析 `raw`（例如 `mail-parser-wasm`、`postal-mime`）。

## admin 邮件 API

支持 `address` 过滤

```python
import requests

url = "https://<你的worker地址>/admin/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address 为可选参数
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**注意**：`/admin/mails` 与 `/api/mails` 一致，返回的是邮件数据库中的 raw MIME 内容；如需正文/主题等可读字段，请在客户端自行解析 `raw`。

**注意**：后端 API 已移除关键词过滤功能。如需按内容过滤邮件，请使用前端界面的过滤输入框，该功能可过滤当前显示的页面。

## 邮箱加密 API

启用 `ENABLE_MAIL_ENCRYPTION` 并升级数据库后可使用，详见[邮箱加密](./mail-encryption.md)。

查询当前地址的加密公钥：

```
GET /api/address_encryption
# -> { "enabled": true, "publicKey": <base64url P-256 公钥或 null> }
```

设置或清除公钥（请求体为 `{ "publicKey": <base64url|null> }`，需要 `Authorization: Bearer <地址JWT>`）：

```
POST /api/address_encryption
```

- `publicKey` 为 `null` 表示清除；之后新邮件按明文存储，已加密邮件保持加密
- 加密邮箱收到的邮件，`/api/mails` / `/api/mail/:id` 的 `raw` 返回 `cfte1.` 密文信封，需用私钥在客户端解密（解密示例见[邮箱加密](./mail-encryption.md)）；发件箱接口对加密地址的发件记录同样返回信封
- 邮件、发件箱列表和详情接口的行都带 `is_encrypted` 字段（0/1），无需检查 `raw` 前缀即可判断该行是否加密
- 已有明文邮件可通过 `GET /api/encrypt_existing/pending` + `POST /api/encrypt_existing` 重新加密，详见[邮箱加密](./mail-encryption.md)
- `/api/parsed_mails` / `/api/parsed_mail/:id` 对加密邮件返回占位：`encrypted: true`、`subject: "[Encrypted mail]"`（中文界面为 `[加密邮件]`）、`text`/`html` 为空、`attachments` 为 `[]`

## 邮件已读状态 API

启用 `ENABLE_MAIL_READ_STATUS` 并升级数据库后可使用。历史邮件的 `is_unread` 为 `NULL`，视为已读；新邮件为 `1`。用户在网页邮件列表中点击未读邮件后会将其设为已读，也可以在邮件详情中手动切换状态；刷新页面不会自动标记：

- `PATCH /api/mails/:id/read`：设置当前地址下单封邮件的状态，请求体为 `{ "isUnread": true }`（未读）或 `{ "isUnread": false }`（已读）

## admin 获取单封邮件 API

无需邮箱 JWT，通过邮件 ID 获取单封邮件，并使用 `x-admin-auth` 认证。
返回结构与 `/admin/mails` 中的单条记录一致：gzip 压缩的原始邮件会解压到 `raw`，响应不包含 `raw_blob`。

```python
import requests

mail_id = 1
url = f"https://<你的worker地址>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.get(url, headers=headers)

print(response.json())
```

## admin 删除邮件 API

通过邮件 ID 删除单封邮件。

```python
import requests

mail_id = 1
url = f"https://<你的worker地址>/admin/mails/{mail_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 删除邮箱地址 API

通过邮箱地址 ID 删除邮箱地址（同时删除该地址关联的邮件、发件权限和用户绑定）。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/delete_address/{address_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 清空收件箱 API

通过邮箱地址 ID 清空该地址的所有收件。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/clear_inbox/{address_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## admin 清空发件箱 API

通过邮箱地址 ID 清空该地址的所有发件。

```python
import requests

address_id = 1
url = f"https://<你的worker地址>/admin/clear_sent_items/{address_id}"

headers = {
        "x-admin-auth": "<你的Admin密码>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.delete(url, headers=headers)

print(response.json())
```

## user 邮件 API

::: warning 注意：用户 JWT vs 地址 JWT
这些接口使用**用户 JWT**（注册后通过 `/user_api/login` 获得），使用 `x-user-token` header。绑定邮箱时还需要同时提供地址 JWT。

**请勿与地址 JWT 混淆**：
- 地址 JWT 使用 `Authorization: Bearer <jwt>` 访问 `/api/*` 接口
- 用户 JWT 使用 `x-user-token: <jwt>` 访问 `/user_api/*` 接口
:::

### 绑定邮箱到用户账号

这里的“绑定”是把已有邮箱关联到当前登录的用户账号，之后可在用户中心管理；Telegram 绑定请参考 [Telegram Bot](./telegram.md#每用户邮件推送)。

`POST /user_api/bind_address` 必须同时携带两个凭据：

| 请求头 | 内容 |
| --- | --- |
| `x-user-token` | 当前用户账号的 JWT，通过 `POST /user_api/login` 的响应字段 `jwt` 获取 |
| `Authorization` | `Bearer <地址JWT>`，使用[创建邮箱](./new-address-api.md)返回的 `jwt` 或邮箱登录后的地址 JWT |

无需请求体；用户和邮箱身份分别从这两个 JWT 读取，不接受通过请求体指定 `user_id`、`address_id` 或邮箱地址。若站点设置了访问密码，还需携带 `x-custom-auth`。

```python
import requests

response = requests.post(
    "https://<你的worker地址>/user_api/bind_address",
    headers={
        "x-user-token": "<你的用户JWT Token>",
        "Authorization": "Bearer <你的地址JWT>",
        # "x-custom-auth": "<你的网站密码>",
    },
)
print(response.json())  # {"success": True}
```

成功返回 `{"success": true}`；重复绑定到同一用户也返回成功。邮箱已绑定其他用户或已达到该用户可绑定邮箱数量上限时返回 400。

### 用户绑定地址列表

`GET /user_api/bind_address` 使用服务端分页，支持以下查询参数：

未携带分页参数时返回默认第一页，不支持一次获取全部绑定地址。

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `limit` | `20` | 每页数量，范围为 1–100 |
| `offset` | `0` | 分页偏移量 |
| `query` | 空 | 可选，按邮箱地址关键字筛选当前用户已绑定的地址；最长 100 个字符，不可包含 `%` 或 `_`，非法查询返回 400 |

响应中的 `results` 仅包含当前页。仅 `offset=0` 时查询筛选后的总数，后续页面的 `count` 为 `0`，客户端应保留第一页返回的总数。

```python
import requests

url = "https://<你的worker地址>/user_api/bind_address"
headers = {
    "x-user-token": "<你的用户JWT Token>",
}
querystring = {
    "limit": "20",
    "offset": "0",
}
response = requests.get(url, headers=headers, params=querystring)
print(response.json())
```

### 获取已绑定邮箱的地址 JWT

`GET /user_api/bind_address_jwt/:address_id` 使用用户 JWT，只有当前用户绑定的邮箱才可获取。`address_id` 取自上方绑定地址列表的 `results[].id`。返回的 `jwt` 可用于 `Authorization: Bearer <jwt>` 调用 `/api/*` 邮箱接口。

```python
import requests

address_id = 1
response = requests.get(
    f"https://<你的worker地址>/user_api/bind_address_jwt/{address_id}",
    headers={
        "x-user-token": "<你的用户JWT Token>",
        # "x-custom-auth": "<你的网站密码>",
    },
)
print(response.json())  # {"jwt": "..."}
```

### 解绑邮箱

`POST /user_api/unbind_address` 使用用户 JWT，请求体为 `{"address_id": 1}`，成功返回 `{"success": true}`。此操作只移除当前用户与邮箱的关联，不删除邮箱或邮件，也不撤销已签发的地址 JWT。解绑前请保存邮箱凭据，以便之后继续访问或重新绑定。

```python
import requests

response = requests.post(
    "https://<你的worker地址>/user_api/unbind_address",
    headers={
        "x-user-token": "<你的用户JWT Token>",
        # "x-custom-auth": "<你的网站密码>",
    },
    json={"address_id": 1},
)
print(response.json())  # {"success": True}
```

### 注销账户

::: danger 永久删除
注销会永久删除当前登录的用户账户**及其绑定的所有邮箱和全部邮件**，以及账户的通行密钥、角色和密钥备份，且无法撤销。
:::

仅当管理员设置 `ENABLE_USER_BURN_ACCOUNT = true` 时可用（未启用时两个接口均返回 403）。需要用户 JWT（`x-user-token`），并与 `/user_api/register` 一样受速率限制，且必须重新验证身份：账户密码（SHA-256 哈希，与登录一致）或通行密钥断言，外加输入精确的确认短语（`burn my account`，中文界面为“销毁我的账户”）。

```
POST /user_api/burn_account/challenge
     # body: { "domain": "<rpID, 例如 example.com>" }
     # -> WebAuthn 认证选项，allowCredentials 仅限该用户注册过的通行密钥。
     #    challenge 为服务器签发的 JWT（purpose 为 "burn_account"，绑定该
     #    用户，5 分钟有效）。

POST /user_api/burn_account
     # body: { "confirm": "burn my account",
     #         "password": "<sha256 哈希>",          # 密码账户
     #         "credential": <webauthn assertion>,  # 或用通行密钥
     #         "origin": "<origin>", "domain": "<rpID>" }  # 使用断言时必填
     # -> { "success": true, "deleted_addresses": ["a@x.com", ...] }
```

- 仅通行密钥账户（见[通行密钥注册](#通行密钥注册)）必须使用针对注销 challenge 验证通过的通行密钥断言确认，且凭据必须属于当前用户（使用其他用户的通行密钥返回 401）。密码账户可以使用密码或通行密钥断言。
- 确认短语错误返回 400；密码错误或断言无效/缺失返回 401。
- `deleted_addresses` 列出了被删除的全部邮箱，浏览器据此移除这些邮箱在本地的私钥和已保存的登录信息。注销后，旧的用户 JWT 与被删邮箱的地址 JWT 均不再有效。
- 管理端删除（`DELETE /admin/users/:user_id`）会清理同样的每用户数据（`users_address`、`user_key_backups`、`user_passkeys`、`user_roles`、`users`）；默认保持原有的“仅解绑邮箱”行为，仅当请求体设置 `"burn_addresses": true` 时才会连同绑定的邮箱及其数据一并删除。

```python
import requests

response = requests.post(
    "https://<你的worker地址>/user_api/burn_account",
    headers={"x-user-token": "<你的用户JWT Token>"},
    json={
        "confirm": "burn my account",
        "password": "<账户密码的 sha256 哈希>",
        "origin": "https://<你的前端地址>",
    },
)
print(response.json())  # {"success": True, "deleted_addresses": [...]}
```

### 通行密钥注册

公开接口（无需用户 JWT），仅使用通行密钥创建账户——无需邮箱和密码。两个接口都需要管理员在 管理后台 → 用户设置 中同时开启**允许用户注册**与**允许通行密钥注册**（否则返回 403），并与 `/user_api/register` 一样受速率限制。

```
POST /user_api/passkey/signup_request
     # body: { "domain": "<rpID, 例如 example.com>", "cf_token": "<turnstile token>" }
     # -> WebAuthn 注册选项：residentKey "required"、userVerification "preferred"，
     #    user.name/displayName 为“<站点标题> account <随机后缀>”，请求 prf 扩展。
     #    challenge 为服务器 JWT，绑定新账户的 pk-<随机>@passkey.invalid 伪邮箱
     #    （5 分钟有效）。

POST /user_api/passkey/signup_response
     # body: { "origin": "<origin>", "credential": <WebAuthn attestation> }
     # -> { "jwt": "<user JWT>" } — 一个批次内创建用户、通行密钥与默认角色，
     #    并立即登录。
```

- 伪邮箱使用保留的 `.invalid` 顶级域，永远无法收信；密码登录、验证码与 OAuth2 登录均拒绝以 `.invalid` 结尾的邮箱。
- 存储的密码为占位值 `!passkey-only`，任何密码登录都无法匹配；通行密钥是唯一的登录方式。删除此类账户的最后一个通行密钥会被拒绝（400）。
- 设置了 `USER_DEFAULT_ROLE` 时自动分配默认角色。之后登录使用常规通行密钥认证接口（凭据可发现，因此 `allowCredentials` 仍为空）。

### 通行密钥备份存储

`/user_api/key_backups` 存储**通行密钥（WebAuthn PRF）保护备份**（邮箱加密私钥被 PRF 派生密钥包裹后的不透明 blob），用于登录用户账号在新设备上恢复解密密钥。仅当启用 `ENABLE_MAIL_ENCRYPTION` 时可用（未启用时返回 400）；需要用户 JWT（`x-user-token`），且地址必须已绑定到当前账号。

```
GET    /user_api/key_backups?address=<邮箱地址>
       # -> [{ "id": <n>, "address": "<地址>", "key_id": "<b64url 公钥>",
       #      "passkey_id": "<凭据ID>", "blob": "<b64url blob>",
       #      "created_at": "<UTC时间>", "updated_at": "<UTC时间>" }]

PUT    /user_api/key_backups
       # body: { "address": "<地址>", "key_id": "<b64url 公钥>",
       #         "passkey_id": "<本人通行密钥凭据ID>", "blob": "<b64url blob>" }
       # -> { "success": true }

DELETE /user_api/key_backups/:id
       # -> { "success": true }
```

- 所有接口仅操作当前用户自己的数据；`GET` 要求 `address` 已绑定到当前用户（未绑定返回 400）。
- `PUT` 校验：地址已绑定到当前用户且设置了加密公钥；`key_id` 是合法的 P-256 公钥点（也允许是旧的/已轮换的密钥）；`passkey_id` 必须是当前用户注册过的通行密钥；`blob` 为 unpadded base64url，解码后首字节为 `0x02`、长度 62–4096 字节。服务器**只校验 blob 外形、永不解密**（见 [邮箱加密 - 通行密钥保护备份](./mail-encryption.md#通行密钥保护备份-webauthn-prf)）。
- 容量上限：每地址 20 条、每用户 200 条；对已存在的 `(address, key_id, passkey_id)` 元组重复 `PUT`（更新 blob）始终允许，只有新元组计入上限，超限返回 409。
- 删除通行密钥、删除地址、解绑/转让地址、删除用户时，对应备份会被一并清理（数据库 v0.0.13 新增 `user_key_backups` 表，需先执行数据库迁移）。

```bash
# 上传一个通行密钥保护备份（blob 由浏览器 WebAuthn PRF 包裹生成）
curl -X PUT "https://<你的worker地址>/user_api/key_backups" \
  -H "x-user-token: <你的用户JWT Token>" \
  -H "Content-Type: application/json" \
  -d '{"address": "xxxx@awsl.uk", "key_id": "<b64url 公钥>", "passkey_id": "<凭据ID>", "blob": "<b64url blob>"}'
```

### 用户邮件列表

支持 `address` 过滤

```python
import requests

url = "https://<你的worker地址>/user_api/mails"

querystring = {
    "limit":"20",
    "offset":"0",
    # address 为可选参数
    "address":"xxxx@awsl.uk"
}

headers = {
        "x-user-token": "<你的用户JWT Token>",
        # "x-custom-auth": "<你的网站密码>", # 如果启用了私有站点密码
    }

response = requests.get(url, headers=headers, params=querystring)

print(response.json())
```

**注意**：`/user_api/mails` 同样返回原始 RFC822 内容；请在客户端解析后提取 `subject`、`text`、`html`。

**注意**：后端 API 已移除关键词过滤功能。如需按内容过滤邮件，请使用前端界面的过滤输入框，该功能可过滤当前显示的页面。
