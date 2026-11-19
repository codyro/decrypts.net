# 邮箱加密（Mailbox Encryption）

可选的按邮箱端到端加密存储：启用后，Worker 只保存邮箱的**公钥**，每封收到的邮件在入库前将整封原始 MIME 加密；**私钥只存在于浏览器**（URL fragment + localStorage），永不发送到服务器，前端在客户端解密后再解析邮件。

由 Worker 变量 `ENABLE_MAIL_ENCRYPTION` 控制，默认关闭。

## 威胁模型

- 服务器端只保存原始 MIME 的密文（`cfte1.` 信封）。明文保留的元数据只有：发件人/信封来源（`source`）、邮箱地址、`message_id`、时间戳、已读状态。
- 邮件在到达瞬间会以明文经过 Worker：垃圾邮件检查、超大附件移除、自动回复仍会运行（自动回复只使用邮件头和配置内容）。
- **这保护的是静态数据（data at rest）**。恶意或被攻陷的 Worker 仍可在加密前的接收瞬间捕获邮件内容；该功能不防御 Worker 本身被攻陷。

## 加密邮箱跳过的功能

为了不出泄漏内容，配置了加密公钥的邮箱会跳过以下依赖服务器解析正文的功能：

- 邮件转发（站内转发规则与全局转发）
- Webhook 推送
- Telegram 推送（互动查询历史邮件时回复"该邮件已加密，请在网页端查看"，不含内容）
- AI 邮件识别
- 其他 Worker RPC 增强

垃圾邮件/黑名单/未知地址检查和自动回复不受影响。

## 信封格式

```
cfte1. + base64url( ephPubRaw(65B, P-256 uncompressed) || iv(12B) || AES-GCM(ciphertext||tag) )
```

- KDF：ECDH(临时私钥, 收件公钥) → HKDF-SHA256(salt = ephPubRaw, info = `"cf-temp-email/mail-encryption/v1"`) → AES-256-GCM 密钥；AAD = `"cfte1"`。
- 明文 = 1 字节标志（`0` = 原始 UTF-8 MIME，`1` = gzip(UTF-8 MIME)）+ 内容。压缩在加密前进行（仅当同时启用 `ENABLE_MAIL_GZIP` 时）。
- 公钥以 base64url 的 65 字节原始点（uncompressed point）存储和传输；私钥为 base64url PKCS8。

## 密钥处理

- 密钥对**在浏览器中生成**（`P-256`），只有公钥被上传并随地址保存。
- 私钥通过解密链接分享：`https://你的域名/#k=<私钥>&a=<邮箱地址>`。URL fragment 不会被浏览器发送到服务器；前端在应用启动时读取 fragment、校验后存入 localStorage，并立即从地址栏抹除 fragment。
- localStorage 按邮箱地址保存私钥数组（最新在前），轮换密钥后旧邮件仍可用旧密钥解密。
- 前端提供"复制解密链接"按钮，可在其他设备上导入密钥。
- **丢失私钥 = 邮件不可恢复**：服务器无法解密，也没有后门。
- 关闭加密（清除公钥）后新邮件恢复明文存储，但已加密的旧邮件仍保持加密状态。
- localStorage 中的私钥意味着本机 XSS 可以读取邮件明文；请在可信设备上使用，并注意浏览器扩展安全。

## 使用流程

1. 部署者：设置 `ENABLE_MAIL_ENCRYPTION = true`（Worker 变量），并先执行数据库迁移（`Admin -> 快速设置 -> 数据库 -> 升级数据库 Schema` 或 `POST /admin/db_migration`），确保 `address.encryption_public_key` 列存在。
2. 用户：创建邮箱时勾选"启用邮箱加密"，或在登录后于"账号设置"中开启/轮换/关闭加密。
3. 创建时前端自动生成密钥对，上传公钥，并展示解密链接供保存。
4. 管理员：在 `Admin -> 账号` 中，单个创建提供同样的加密选项；批量创建会在浏览器中为每个地址生成一对密钥，导出 CSV 在存在加密地址时包含 `private_key` 和 `decryption_link` 列。
5. Telegram 小程序：小程序内的绑定/创建页提供同样的加密勾选，私钥保存在小程序 webview 的 localStorage 中。Bot `/new` 文本命令没有浏览器环境生成/保存密钥，**不支持**加密（创建的地址均为明文）。加密地址不会收到 Telegram 推送，Bot 邮件查询（`/mails`）只会回复"该邮件已加密"而不含内容——请在网页端或小程序内查看加密邮件（客户端本地解密）。

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

### 读取与解密邮件

`/api/mails`、`/api/mail/:id` 的 `raw` 字段对加密邮件返回 `cfte1.` 信封字符串。`/api/parsed_mails`、`/api/parsed_mail/:id` 对加密邮件返回占位：

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

- 服务端解析接口（`/api/parsed_mails` 等）对加密邮件只返回占位，无法提供主题/正文/附件；Webhook 测试发送与 Telegram 解析同样不可用。
- 非加密邮箱上，发件人可控、原始内容恰好以 `cfte1.` 开头的邮件会在前端显示为锁定状态（这是按设计的行为，以信封前缀判断加密）。
- 私钥保存在 localStorage，清理浏览器数据会丢失密钥（除非已保存解密链接）。
- 加密地址不会收到 Telegram 推送，Bot `/new` 命令也无法创建加密地址。
