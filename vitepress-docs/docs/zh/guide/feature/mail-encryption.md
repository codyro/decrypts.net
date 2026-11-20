# 邮箱加密（Mailbox Encryption）

可选的按邮箱端到端加密存储：启用后，Worker 只保存邮箱的**公钥**，每封收到的邮件在入库前将整封原始 MIME 加密；**私钥只存在于浏览器**（创建时一次性展示的解密链接 + IndexedDB 中不可导出的 WebCrypto 密钥），永不发送到服务器，前端在客户端解密后再解析邮件。

由 Worker 变量 `ENABLE_MAIL_ENCRYPTION` 控制，默认关闭。

## 威胁模型

- 服务器端只保存原始 MIME 的密文（`cfte1.` 信封）。加密行不再明文保存元数据：`source` 置空、`message_id` 置为 `NULL`（真实发件人和 Message-ID 在加密后的 MIME 头内，由浏览器解密后展示）。明文保留的元数据只有：邮箱地址、时间戳、已读状态、大小和 `is_encrypted` 标记。
- 邮件在到达瞬间会以明文经过 Worker：垃圾邮件检查、超大附件移除、自动回复仍会运行（自动回复只使用邮件头和配置内容）。
- **这保护的是静态数据（data at rest）**。恶意或被攻陷的 Worker 仍可在加密前的接收瞬间捕获邮件内容；该功能不防御 Worker 本身被攻陷。
- 私钥以**不可导出（non-extractable）的 WebCrypto `CryptoKey`** 存储：本机 XSS 无法再读取或导出原始私钥，但在页面打开期间 XSS 仍可调用该密钥解密邮件——请在可信设备上使用并注意浏览器扩展安全；前端生产构建启用的严格 CSP（见 [Cloudflare Pages 前端](/zh/guide/ui/pages#content-security-policy)）显著降低了 XSS 风险。
- 清理浏览器数据（IndexedDB）会删除私钥，除非已保存明文解密链接、口令保护备份或通行密钥保护备份；找回口令保护备份需要口令，通行密钥保护备份需要对应的通行密钥。

## 加密邮箱跳过的功能

为了不出泄漏内容，配置了加密公钥的邮箱会跳过以下依赖服务器解析正文的功能：

- 邮件转发（站内转发规则与全局转发）
- AI 邮件识别
- 其他 Worker RPC 增强

垃圾邮件/黑名单/未知地址检查和自动回复不受影响。

## 无内容通知

以下通知链路不再整体跳过，但对加密邮箱只发送不含任何内容的通知：

- Telegram 推送发送固定的"收到新的加密邮件"提示，不含发件人、主题、正文和附件；配置了小程序地址时仍附带小程序按钮。Bot 互动查询历史加密邮件时仍只回复"该邮件已加密"而不含内容。
- 每一个已启用的 Webhook（全局与按地址，凡启用者）都会被调用，但请求体只包含 `{ "encrypted": true, "address": "<邮箱地址>", "mail_id": <数字>, "created_at": "<SQLite UTC 时间戳>" }`，配置的 Body 模板与过滤规则全部被绕过。

## 发件箱（sendbox）

加密地址的已发送邮件原文同样以 `cfte1.` 信封存储（信封明文与明文路径存储的 JSON 完全相同），并标记 `is_encrypted = 1`；加密失败时跳过发件箱保存，绝不回退明文。网页端发件箱在客户端解密后照常展示，缺少可用私钥时显示为锁定；管理端和用户中心的发件箱视图没有私钥，加密行始终显示为锁定。

## is_encrypted 标记

数据库 v0.0.12 为 `raw_mails` 和 `sendbox` 增加显式 `is_encrypted` 列并回填历史信封（执行 `Admin -> 快速设置 -> 数据库 -> 升级数据库 Schema` 或 `POST /admin/db_migration`）。已迁移数据库以该标记判定加密，发件人伪造 `cfte1.` 前缀的明文不会被误认为加密邮件；未迁移数据库回退到前缀检测，伪造前缀的明文会显示为锁定。邮件列表、详情和发件箱接口的行都带 `is_encrypted` 字段（0/1），客户端无需检查 `raw` 前缀即可区分。

## 信封格式

```
cfte1. + base64url( ephPubRaw(65B, P-256 uncompressed) || iv(12B) || AES-GCM(ciphertext||tag) )
```

- KDF：ECDH(临时私钥, 收件公钥) → HKDF-SHA256(salt = ephPubRaw, info = `"cf-temp-email/mail-encryption/v1"`) → AES-256-GCM 密钥；AAD = `"cfte1"`。
- 明文 = 1 字节标志（`0` = 原始 UTF-8 MIME，`1` = gzip(UTF-8 MIME)）+ 内容。压缩在加密前进行（仅当同时启用 `ENABLE_MAIL_GZIP` 时）。
- 公钥以 base64url 的 65 字节原始点（uncompressed point）存储和传输；私钥为 base64url PKCS8。

## 密钥处理

- 密钥对**在浏览器中生成**（`P-256`），只有公钥被上传并随地址保存。
- 私钥只以**不可导出的 WebCrypto `CryptoKey`**（ECDH P-256）持久化在浏览器 IndexedDB（数据库 `cf-temp-email-keys`），任何时刻都不保存原始密钥字符串。每个地址可存多把密钥（最新在前，按公钥去重），轮换后旧邮件仍可用旧密钥解密。
- 旧版本保存在 localStorage（`mailPrivateKeys`）的明文密钥会在首次加载时自动迁移到 IndexedDB。迁移校验通过后弹出一次性备份提示，用户可以选择：设置口令生成保护备份后删除明文副本、"跳过并立即删除"，或"稍后"（明文副本保留到做出选择为止）。IndexedDB 不可用（如部分隐私模式）时，密钥只保存在内存中于本次会话使用，界面会显示警告，且旧版 localStorage 明文副本会被保留（不会把唯一的持久副本删进易失存储）。
- **原始私钥 / 明文 `#k=` 链接只在创建时展示一次**（创建、轮换、导入、管理端单个创建同理），之后前端不再生成明文链接。之后的"复制解密链接"与"导出"只输出已存的口令保护备份（`#kp=`，见下文）；也可以在账号设置中通过"由我的密钥创建保护备份"重新粘贴原始密钥或 `#k=` 链接（与已存公钥校验匹配后）补建口令或通行密钥保护备份（见下文）。
- **丢失私钥且没有任何备份 = 邮件不可恢复**：服务器无法解密，也没有后门。
- **加密已有邮件不可逆**：明文行一旦被替换为信封，只有私钥持有者才能读取；丢失私钥后这些邮件将永久不可恢复（详见下文 API）。
- 关闭加密（清除公钥）后新邮件恢复明文存储，但已加密的旧邮件仍保持加密状态。
- 管理端批量创建导出的 CSV 仍包含明文私钥（创建阶段的产物），请将该文件视为机密妥善保管。

## 口令保护备份（`#kp=`）

由于 WebCrypto 的限制（不可导出的密钥无法再被导出或包裹），口令保护备份只能在原始密钥仍在内存时创建：创建、轮换、导入或旧版迁移时，以及之后通过"由我的密钥创建保护备份"重新粘贴原始密钥/链接时。创建后备份 blob 随密钥记录一起存储在 IndexedDB。

- KDF：PBKDF2-HMAC-SHA256（默认 600,000 次迭代；导入端接受 100,000–5,000,000）派生 AES-256-GCM 密钥。
- blob 二进制布局：`version(1B = 0x01) ‖ iterations(4B 大端 u32) ‖ salt(16B) ‖ iv(12B) ‖ AES-256-GCM(密文 ‖ 16B tag)`，整体 base64url；明文为 PKCS8 私钥，AAD = `"cfte-kp1:" + 邮箱地址`（备份不能改绑到其他地址）。
- 链接：`https://你的域名/#kp=<blob>&a=<邮箱地址>`；打开后前端提示输入口令导入，fragment 会被立即从地址栏抹除，且浏览器不会把 fragment 发送到服务器。
- 文件：JSON `{ "format": "cf-temp-email-key-backup", "version": 1, "address": "<邮箱地址>", "createdAt": "<ISO 时间>", "kdf": "PBKDF2-SHA256", "blob": "<base64url blob>" }`。
- 口令最少 10 个字符。未使用 Argon2（避免引入额外运行时依赖）。
- 明文 `#k=` 链接仍可导入；导入后前端会提示为该密钥设置口令保护（可跳过）。

用 Node.js 解包备份的示例（与 `frontend/src/utils/key-backup.js` 逻辑一致）：

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
    return bytesToB64u(pkcs8); // base64url PKCS8 私钥：立即导入使用后丢弃该字符串
}
```

## 通行密钥保护备份（WebAuthn PRF）

除口令保护备份外，**登录用户账号**还可以把邮箱私钥用**通行密钥（Passkey）**保护后存储在服务器上，换设备或清理浏览器数据后可用通行密钥恢复。

- **适用条件（有意取舍）**：需要用户账号、该地址已绑定到该账号、通过该账号注册过通行密钥，以及支持 WebAuthn 的浏览器。新注册的通行密钥会在注册选项中请求 WebAuthn `prf` 扩展；不支持 PRF 的旧通行密钥或验证器在**使用时**才报告"此通行密钥/浏览器不支持 PRF"（注册与登录不受影响）。
- **不适用时的回退**：仅使用邮箱（地址 JWT、无用户账号）的访客，或不支持 PRF 的通行密钥/浏览器，使用口令 `#kp=` 备份（见上文），两者相互独立。
- **未实现的备选方案**：未来迭代可能提供"仅客户端的单地址通行密钥"方案（不走服务器端 WebAuthn 注册，用地址 JWT 授权的 blob 存储做 PRF 包裹）；当前版本**未实现**，仅支持用户账号方案。
- **包裹过程（全部在浏览器内）**：用通行密钥的 PRF 断言输出派生 AES-256-GCM 包裹密钥（HKDF-SHA256：ikm = PRF 输出，salt = blob 内的随机 salt，info = `"cf-temp-email/key-wrap/prf-v1|" + 地址 + "|" + 密钥ID`，AAD = `"cfte-kpk1:" + 地址 + "|" + 密钥ID`），包裹 PKCS8 私钥。上传到服务器的只有 base64url 编码的不透明 blob `version(1B = 0x02) ‖ salt(32B) ‖ iv(12B) ‖ AES-256-GCM(密文 ‖ 16B tag)`、通行密钥凭据 ID 和密钥 ID。**服务器永远看不到 PRF 输出、包裹密钥和私钥，无法解包**，只能校验 blob 外形（首字节 0x02、解码后 62–4096 字节）。
- **与口令备份相同的约束**：不可导出的密钥无法事后包裹，包裹只能在原始密钥仍在内存时进行：创建、轮换、导入，或之后在账号设置"由我的密钥创建保护备份"中重新粘贴原始密钥/链接。
- **恢复**：在新设备登录账号后，打开该地址的账号设置，在通行密钥备份列表点"从通行密钥恢复密钥"——浏览器执行断言、解包 blob，并把私钥以不可导出密钥存入本机 IndexedDB。解包失败（密钥/通行密钥不匹配或篡改）会明确报错。
- **存储**：数据库 v0.0.13 新增 `user_key_backups` 表（执行 `Admin -> 快速设置 -> 数据库 -> 升级数据库 Schema` 或 `POST /admin/db_migration`）；服务器只存不透明 blob。删除通行密钥、删除地址、解绑/转让地址、删除用户时备份一并清理。容量上限：每地址 20 条、每用户 200 条。存储接口详见 [邮件 API](./mail-api.md#通行密钥备份存储)。

## 使用流程

1. 部署者：设置 `ENABLE_MAIL_ENCRYPTION = true`（Worker 变量），并先执行数据库迁移（`Admin -> 快速设置 -> 数据库 -> 升级数据库 Schema` 或 `POST /admin/db_migration`），确保 `address.encryption_public_key` 列存在。
2. 用户：创建邮箱时勾选"启用邮箱加密"，或在登录后于"账号设置"中开启/轮换/关闭加密。开启或轮换后，如果该邮箱仍有明文邮件，前端会提示"加密已有邮件"；账号设置中也始终提供该按钮，执行时显示进度并支持取消。
3. 创建时前端自动生成密钥对并上传公钥，随后**一次性**展示明文解密链接，并提示设置口令创建保护备份（创建后可复制保护备份链接或下载备份文件）；已登录用户账号且地址已绑定时，也可以改用通行密钥创建保护备份（见上文）。关闭对话框后前端不再能生成明文链接。
4. 管理员：在 `Admin -> 账号` 中，单个创建提供同样的加密选项（同样一次性展示明文链接并提示备份）；批量创建会在浏览器中为每个地址生成一对密钥，导出 CSV 在存在加密地址时包含 `private_key` 和 `decryption_link` 列（CSV 含明文私钥，请视为机密）。
5. Telegram 小程序：小程序内的绑定/创建页提供同样的加密勾选，私钥以不可导出的 WebCrypto 密钥保存在小程序 webview 的 IndexedDB 中（旧版 localStorage 明文会自动迁移并提示备份）。Bot `/new` 文本命令没有浏览器环境生成/保存密钥，**不支持**加密（创建的地址均为明文）。加密地址会收到一条固定的"收到新的加密邮件"无内容推送（配置了小程序地址时附带小程序按钮），Bot 邮件查询（`/mails`）仍只回复"该邮件已加密"而不含内容——请在网页端或小程序内查看加密邮件（客户端本地解密）。

## API（供脚本 / Agent 使用）

### 查询/设置加密公钥

```
GET  /api/address_encryption          -> { "enabled": true, "publicKey": <b64url|null> }
POST /api/address_encryption          body: { "publicKey": <b64url|null> }
```

- 需要 `Authorization: Bearer <地址JWT>`。
- 功能是否启用也可通过公开接口 `GET /open_api/settings` 的 `enableMailEncryption` 字段查询（无需 JWT）。
- `publicKey` 为 `null` 时清除公钥（后续邮件明文存储；已存邮件保持加密）。
- 功能未启用时 `GET` 返回 `{ "enabled": false, "publicKey": null }`，`POST` 返回 400。

### 创建带加密的邮箱

`POST /api/new_address`、`POST /admin/new_address` 和 `POST /telegram/new_address`（Telegram 小程序）都支持可选字段 `encryption_public_key`（b64url 65 字节 P-256 公钥）。非法公钥或功能未启用时返回 400。管理端批量创建是逐地址调用 `/admin/new_address`，因此每个地址都可以带各自的公钥。Bot `/new` 命令不支持该字段。

### 加密已有邮件

两个地址 JWT 接口供脚本把该邮箱已存储的明文邮件重新加密（浏览器流程即上文所述：开启/轮换密钥后前端主动提示，账号设置中也有常驻按钮，支持进度显示与取消）：

```
GET  /api/encrypt_existing/pending?box=inbox|sendbox&limit=<1..50>&after_id=<n>
# -> { "publicKey": <b64url>, "remaining": <剩余明文数>, "results": [{ "id": <n>, "raw": "<明文>" }] }

POST /api/encrypt_existing
# body: { "box": "inbox"|"sendbox", "items": [{ "id": <n>, "raw": "<cfte1. 信封>" }] }
# -> { "success": true, "encrypted": [<id>...], "skipped": [{ "id": <id>, "reason": "invalid_envelope"|"not_found"|"already_encrypted" }] }
```

- 功能未启用或地址未设置公钥时两个接口均返回 400。
- `limit` 取值 1..50（默认 20）；每次 POST 最多 50 项；信封解码后须在 94 B..2 MiB 之间。
- 每一项必须是当前 JWT 地址名下、当前为明文状态的行，否则被跳过（`not_found` 也覆盖其他地址的邮件）。
- 服务器只校验信封格式，**永不解密**，也无法验证信封是用哪把公钥加密的——上传一个格式正确但用错误公钥加密的信封会让该行不可读，请先用返回的 `publicKey` 加密。
- 收件箱行上传成功后还会清空 `raw_blob`、置 `is_encrypted = 1`，并将 `source` 置空、`message_id` 置为 `NULL`。
- 整个流程幂等、可断点续跑：重复执行只会加密剩余的明文邮件。
- **浏览器安全校验**：如果服务器返回的公钥与本设备为该地址保存的所有密钥都不匹配，前端会拒绝执行"加密已有邮件"且**不上传任何内容**——请先通过通行密钥备份、口令保护备份或解密链接恢复/导入当前私钥再重试（否则加密后的邮件将无法在本设备上解密）。

循环逻辑的伪代码（加密部分与上文解密示例使用同一套 WebCrypto 方案）：

```js
// 每轮取一批明文，用服务器返回的 publicKey 加密后上传
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

### 读取与解密邮件

`/api/mails`、`/api/mail/:id` 的 `raw` 字段对加密邮件返回 `cfte1.` 信封字符串（行内带 `is_encrypted: 1`）；发件箱接口（`/api/sendbox`、`/user_api/sendbox`、`/admin/sendbox` 等）对加密地址的发件记录同样返回信封。`/api/parsed_mails`、`/api/parsed_mail/:id` 对加密邮件返回占位：

```json
{ "encrypted": true, "subject": "[Encrypted mail]", "sender": "", "text": "", "html": "", "attachments": [] }
```

用私钥解密的 Node.js 示例（与前端 `frontend/src/utils/mail-crypto.js` 逻辑一致）：

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

## 限制

- 服务端解析接口（`/api/parsed_mails` 等）对加密邮件只返回占位，无法提供主题/正文/附件；Webhook 测试发送与 Telegram 解析同样不可用，Webhook 发件人过滤条件也无法匹配加密邮件（无内容推送整体绕过过滤规则）。加密行的 `source` 为空，依赖发件人的服务端能力（如按发件人搜索、按发件人统计）不包含加密邮件。
- 未迁移数据库上，发件人可控、原始内容恰好以 `cfte1.` 开头的明文会显示为锁定状态（此前缀会被误认为是信封）。执行数据库迁移（v0.0.12）后以显式 `is_encrypted` 标记判定加密，这类邮件会按明文正常展示。
- 私钥保存在浏览器 IndexedDB，清理浏览器数据会丢失密钥（除非已保存明文解密链接、口令保护备份或通行密钥保护备份；找回口令保护备份需要口令，通行密钥保护备份需要对应通行密钥）。保护备份只能在原始密钥仍在内存时创建（创建/轮换/导入/迁移，或之后重新粘贴原始密钥补建）。
- Bot `/new` 命令无法创建加密地址。
