# Cloudflare Pages 前端

<script setup>
import { ref } from 'vue'
import JSZip from 'jszip';

const domain = ref("")
const downloadUrl = ref("")
const tip = ref("下载")
const errorMessage = ref("")

const resetDownloadUrl = () => {
    if (!downloadUrl.value) {
        return
    }
    window.URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = ""
}

const validateDomain = (value) => {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
        return "请输入以 https:// 开头的后端 API 地址"
    }
    if (/\s/.test(normalizedValue)) {
        return "后端 API 地址不能包含空白字符"
    }
    if (!normalizedValue.startsWith("https://")) {
        return "后端 API 地址必须以 https:// 开头"
    }
    if (normalizedValue.endsWith("/")) {
        return "后端 API 地址末尾不要带 /"
    }
    try {
        const url = new URL(normalizedValue)
        if (url.protocol !== "https:") {
            return "后端 API 地址必须以 https:// 开头"
        }
        if (url.pathname !== "/" || url.search || url.hash) {
            return "请填写后端 API 根地址，不要带路径、参数或锚点"
        }
    } catch {
        return "后端 API 地址格式不正确"
    }
    return ""
}

const generate = async () => {
    const normalizedDomain = domain.value.trim()
    const validationError = validateDomain(normalizedDomain)
    errorMessage.value = validationError
    resetDownloadUrl()
    if (validationError) {
        return
    }
    domain.value = normalizedDomain
    let timeoutId = 0
    try {
        const controller = new AbortController()
        timeoutId = window.setTimeout(() => controller.abort(), 10000)
        const response = await fetch("/ui_install/frontend.zip", {
            signal: controller.signal
        });
        if (!response.ok) {
            errorMessage.value = "下载前端压缩包失败，请稍后重试"
            return
        }
        const arrayBuffer = await response.arrayBuffer();
        var zip = new JSZip();
        await zip.loadAsync(arrayBuffer);
        const indexEntry = zip.file("index.html");
        if (!indexEntry) {
            errorMessage.value = "没有找到 index.html，生成失败"
            return
        }
        const content = await indexEntry.async("string");
        const configPattern = /(<script id="app-config" type="application\/json">)([\s\S]*?)(<\/script>)/;
        const configMatch = content.match(configPattern);
        if (!configMatch) {
            errorMessage.value = "没有找到 app-config，生成失败"
            return
        }
        let appConfig = {};
        try {
            appConfig = JSON.parse(configMatch[2]);
        } catch {
            errorMessage.value = "app-config 格式错误，生成失败"
            return
        }
        if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
            errorMessage.value = "app-config 格式错误，生成失败"
            return
        }
        appConfig.API_BASE = normalizedDomain;
        zip.file("index.html", content.replace(
            configPattern,
            (_, openTag, _config, closeTag) => `${openTag}${JSON.stringify(appConfig)}${closeTag}`
        ));
        const blob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(blob);
        errorMessage.value = ""
        downloadUrl.value = url;
    } catch (error) {
        console.error("Error: ", error);
        if (error instanceof DOMException && error.name === "AbortError") {
            errorMessage.value = "下载超时，请刷新页面后重试"
            return
        }
        errorMessage.value = "生成失败，请刷新页面后重试"
    } finally {
        window.clearTimeout(timeoutId)
    }
}
</script>

1. 点击 `Compute (Workers)` -> `Workers & Pages` -> `Create`

    ![create pages](/ui_install/worker_home.png)

2. 选择 `Pages`，选择 `Use direct upload`

    ![pages](/ui_install/pages.png)

3. 输入部署的 worker 地址，必须填写后端 API 根地址，并且以 `https://` 开头，地址不要带 `/`，点击生成，成功会出现下载按钮，你会得到一个 zip 包
    - 此处 worker 域名为后端 api 的域名，比如我部署在 `https://temp-email-api.awsl.uk`，则填写 `https://temp-email-api.awsl.uk`
    - 如果你的域名是 `https://temp-email-api.xxx.workers.dev`，则填写 `https://temp-email-api.xxx.workers.dev`
    - 不要填写前端 `Pages` 自己的域名，也不要带 `/admin`、`/api` 等路径，否则前端请求会打到错误地址，可能出现 `Cannot read properties of undefined (reading 'map')` 或 `405 Method Not Allowed`
    - 填写前请先在浏览器打开 `https://你的worker域名/open_api/settings`，确认返回 JSON；如果返回 HTML、404、405 或 Cloudflare 挑战页，请先修复 Worker 绑定、变量或安全策略

    > [!warning] 注意
    > `worker.dev` 域名在中国无法访问，请自定义域名
    >
    > 不要给后端 API 域名开启 Under Attack、Bot Fight、Managed Challenge 等会返回浏览器挑战页的安全策略。前端 XHR 请求无法完成这些挑战，常见表现是 `Network Error`。

    <div :class="$style.container">
        <input :class="$style.input" type="text" v-model="domain" placeholder="请输入以 https:// 开头的后端 API 地址"></input>
        <button :class="$style.button" @click="generate">生成</button>
        <a v-if="downloadUrl" :href="downloadUrl" download="frontend.zip">{{ tip }}</a>
    </div>
    <p :class="$style.hint">示例：`https://temp-email-api.example.com`，不要填写前端 Pages 域名，也不要带结尾 `/`。</p>
    <p v-if="errorMessage" :class="$style.error">{{ errorMessage }}</p>

    > [!NOTE]
    > 你也可以手动部署，从这里下载 zip, [frontend.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/frontend.zip)
    >
    > 解压后编辑 `index.html` 中的 `app-config`，完成后重新压缩全部文件并上传。不要把外层目录一起压缩。
    >
    > 如果第一次填错后重新部署仍然报错，请用无痕窗口测试或清理浏览器缓存，避免浏览器继续使用旧的前端资源。

    ```html
    <script id="app-config" type="application/json">
    {
      "API_BASE": "https://temp-email-api.example.com",
      "DEFAULT_LANG": "en"
    }
    </script>
    ```

    `API_BASE` 是后端 API 根地址，不要带结尾 `/`；`DEFAULT_LANG` 支持 `zh`、`en`、`es`、`pt-BR`、`ja`、`de`。还可以设置 `CF_WEB_ANALY_TOKEN`、`IS_TELEGRAM`、`GOOGLE_AD_CLIENT`、`GOOGLE_AD_SLOT`，用途和取值请查看 [前端变量说明](/zh/guide/frontend-vars)。`app-config` 中存在的字段会覆盖构建进 JS 的对应配置，未填写的字段继续使用原配置。

4. 选择 `Pages`，点击 `Create Pages`, 修改名称，上传下载的 zip 包

    > [!warning] 重要：SPA 模式
    > 本项目是单页应用（SPA），**必须在部署时展开高级选项，将「未找到处理」设置为 `Single-page application (SPA)`**。
    > 否则刷新页面或直接访问 `/admin` 等子路径时会返回 404。
    >
    > ![pages spa setting](/ui_install/pages-spa-setting.jpg)

    然后点击 `Deploy`

    ![pages1](/ui_install/pages-1.png)

5. 打开 刚刚部署的 `Pages`，点击 `Custom Domain`  这里可以添加自己的域名，你也可以使用自动生成的 `*.pages.dev` 的域名。能打开域名说明部署成功。

    ![pages domain](/ui_install/pages-domain.png)

## Content-Security-Policy

前端生产构建会自动启用严格的内容安全策略（`vite-plugin-csp`）：构建时把 `<meta http-equiv="Content-Security-Policy">` 注入 `index.html`，并生成 `dist/_headers`——Cloudflare Pages 与部署 Worker 静态资源（`[assets]`，见 [CLI 部署 Worker](/zh/guide/cli/worker#部署带有前端页面的-worker-可选)）都会应用其中的响应头。`_headers` 包含与 meta 相同的策略并追加 `frame-ancestors 'none'`，以及 `X-Content-Type-Options: nosniff` 和 `Referrer-Policy: strict-origin-when-cross-origin`。

默认策略字符串：

```
default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; media-src 'self' https: data: blob:; connect-src 'self'; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; manifest-src 'self'
```

说明：

- 策略**永不**包含 `unsafe-eval` 或 script 的 `unsafe-inline`。
- 有意的放宽项：
    - `wasm-unsafe-eval`：`vite-plugin-wasm` 在运行时实例化邮件解析 WASM 模块。
    - `style-src 'unsafe-inline'`：Naive UI / Vue 在运行时注入 `<style>` 标签，消毒后的邮件 HTML 也保留内联样式；样式无法像脚本一样窃取邮箱密钥。
    - `img-src https:`：邮件 HTML 中的远程 https 图片（`cid:` 内联图片会被邮件解析器重写为 `blob:` URL）。
    - `https://challenges.cloudflare.com`：Turnstile 人机验证组件的脚本与 iframe。
- 开发服务器（`pnpm dev`）不受影响，策略只在生产构建注入（HMR 依赖内联脚本与 `ws://`）。
- 根据构建环境变量自动追加的来源：
    - Telegram 小程序构建（`VITE_IS_TELEGRAM=true`）：script-src 增加 `https://telegram.org`，且 `_headers` 不包含 `frame-ancestors 'none'`（小程序运行在 Telegram 客户端的 iframe 中）。
    - `VITE_CF_WEB_ANALY_TOKEN`：Cloudflare Web Analytics 信标脚本（`static.cloudflareinsights.com`）与 RUM 端点（`cloudflareinsights.com`）。
    - `VITE_GOOGLE_AD_CLIENT`：Google AdSense 脚本及广告 iframe 使用的 frame/connect 来源。
    - `VITE_API_BASE` 指向其他域名时：connect-src 自动加入该 API 来源（同域部署无需配置）。
- 需要加入更多第三方脚本/嵌入时，使用以下构建环境变量（空格分隔多个来源，取值会被校验，不能注入额外指令）：

    | 变量名 | 作用 |
    | ------ | ---- |
    | `VITE_CSP_EXTRA_SCRIPT_SRC` | 追加到 `script-src` |
    | `VITE_CSP_EXTRA_CONNECT_SRC` | 追加到 `connect-src` |
    | `VITE_CSP_EXTRA_IMG_SRC` | 追加到 `img-src` |
    | `VITE_CSP_EXTRA_FRAME_SRC` | 追加到 `frame-src` |

> [!warning] 注意
> 该策略会阻止未经声明的第三方脚本与内联脚本。如果你通过自定义 `index.html`、反向代理注入等方式加入了额外脚本，页面可能因此异常；确需关闭时可设置 `VITE_CSP_DISABLED=true` 重新构建（不注入 meta 标签、不生成 `_headers`）。

<style module>
.container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}
.input {
    border: 2px solid deepskyblue;
    margin-right: 10px;
    width: 75%;
    border-radius: 5px;
}

.button {
    background-color: deepskyblue;
    padding: 5px 10px;
    border-radius: 5px;
    margin-right: 10px;
}

.button:hover {
    background-color: green;
}

.hint {
    margin-top: 8px;
    color: var(--vp-c-text-2);
}

.error {
    margin-top: 8px;
    color: #d03050;
}
</style>
