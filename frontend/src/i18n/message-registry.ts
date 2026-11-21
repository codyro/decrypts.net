export const MESSAGE_REGISTRY = {
  "components.FilterEditor": {
    "hint": { "zh": "未设置条件时全部通过", "en": "No conditions: match everything" },
    "visual": { "zh": "可视化", "en": "Visual" },
    "invalid": { "zh": "规则无效，请检查结构、操作符、选项和正则；最多 8 层、100 个节点", "en": "Invalid rule: check structure, operators, options and regex. Maximum 8 levels and 100 nodes." },
    "and": { "zh": "与：全部满足", "en": "AND: all match" },
    "or": { "zh": "或：任一满足", "en": "OR: any match" },
    "not": { "zh": "非：取反", "en": "NOT: negate" },
    "logic": { "zh": "规则类型", "en": "Rule type" },
    "condition": { "zh": "匹配条件", "en": "Condition" },
    "remove": { "zh": "移除", "en": "Remove" },
    "field": { "zh": "字段", "en": "Field" },
    "operator": { "zh": "操作符", "en": "Operator" },
    "value": { "zh": "匹配值", "en": "Value" },
  },
  "components.WebhookComponent": {
    "filter": { "zh": "过滤条件", "en": "Filter" },
    "filterHelp": { "zh": "可输入 header.List-ID 等字段。文本默认忽略大小写；正则使用 JavaScript 语法，flags 可选 i、m、s。", "en": "Custom headers: e.g. header.List-ID. Text ignores case by default; regex uses JavaScript syntax with optional i, m, s flags." },
    "filter_from": { "zh": "发件人", "en": "Sender" },
    "filter_to": { "zh": "实际收件邮箱", "en": "Delivery address" },
    "filter_subject": { "zh": "主题", "en": "Subject" },
    "filter_text": { "zh": "纯文本正文", "en": "Plain text" },
    "filter_html": { "zh": "HTML 正文", "en": "HTML body" },
    "filter_equals": { "zh": "等于", "en": "Equals" },
    "filter_contains": { "zh": "包含", "en": "Contains" },
    "filter_startsWith": { "zh": "开头匹配", "en": "Starts with" },
    "filter_endsWith": { "zh": "结尾匹配", "en": "Ends with" },
    "filter_regex": { "zh": "正则匹配", "en": "Regular expression" },
    "filter_caseSensitive": { "zh": "区分大小写", "en": "Case sensitive" },
    "filter_flags": { "zh": "正则标志", "en": "Regex flags" },
    "filterSkipped": { "zh": "条件不匹配，未发送 Webhook", "en": "Conditions did not match; webhook not sent" },
    "filterMatched": { "zh": "条件匹配（仅检查，未发送）", "en": "Conditions match (check only; not sent)" },
    "checkFilter": { "zh": "仅检查规则", "en": "Check only" },
    "filterCheckTip": { "zh": "仅检查是否匹配，不发送 Webhook。“测试”按原配置真实发送，不检查过滤条件。", "en": "Checks matching only; no webhook is sent. Test sends using the existing settings without applying filters." },
    "randomMail": { "en": "Random email", "zh": "随机邮件" },
    "specifiedMail": { "en": "Specify ID", "zh": "指定 ID" },
    "mailId": { "en": "Email ID", "zh": "邮件 ID" },
    "invalidMailId": { "en": "Enter a valid positive integer email ID", "zh": "请输入有效的正整数邮件 ID" },
    "cancel": { "en": "Cancel", "zh": "取消" },
    "enable": {
      "en": "Enable",
      "zh": "启用"
    },
    "fillInDemoTip": {
      "en": "Please modify the URL and other settings to your own",
      "zh": "请修改URL和其他设置为您自己的配置"
    },
    "notEnabled": {
      "en": "Webhook is not enabled for you",
      "zh": "Webhook 未开启，请联系管理员开启"
    },
    "presets": {
      "en": "Presets",
      "zh": "示例模板"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "successTip": {
      "en": "Success",
      "zh": "成功"
    },
    "test": {
      "en": "Test",
      "zh": "测试"
    },
    "urlMissing": {
      "en": "URL is required",
      "zh": "URL 不能为空"
    }
  },
  "components.MailBox": {
    "attachments": {
      "en": "Show Attachments",
      "zh": "查看附件"
    },
    "autoRefresh": {
      "en": "Auto Refresh",
      "zh": "自动刷新"
    },
    "backToList": {
      "en": "Back to List",
      "zh": "返回列表"
    },
    "cancelMultiAction": {
      "en": "Cancel Multi Action",
      "zh": "取消多选"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteMailTip": {
      "en": "Are you sure you want to delete mail?",
      "zh": "确定要删除邮件吗?"
    },
    "downloadMail": {
      "en": "Download Mail",
      "zh": "下载邮件"
    },
    "emptyInbox": {
      "en": "Your inbox is empty",
      "zh": "收件箱为空"
    },
    "emptyInboxHint": {
      "en": "New mail appears here. Refresh, or turn on auto refresh.",
      "zh": "新邮件会显示在这里。可手动刷新或开启自动刷新。"
    },
    "noFilterMatch": {
      "en": "No mail on this page matches the filter.",
      "zh": "当前页没有匹配的邮件。"
    },
    "forwardMail": {
      "en": "Forward",
      "zh": "转发"
    },
    "keywordQueryTip": {
      "en": "Filter current page",
      "zh": "过滤当前页"
    },
    "multiAction": {
      "en": "Multi Action",
      "zh": "多选"
    },
    "nextMail": {
      "en": "Next",
      "zh": "下一封"
    },
    "pleaseSelectMail": {
      "en": "Please select mail",
      "zh": "请选择邮件"
    },
    "prevMail": {
      "en": "Previous",
      "zh": "上一封"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    },
    "refresh": {
      "en": "Refresh",
      "zh": "刷新"
    },
    "refreshAfter": {
      "en": "Refresh After {msg} Seconds",
      "zh": "{msg}秒后刷新"
    },
    "reply": {
      "en": "Reply",
      "zh": "回复"
    },
    "saveToS3": {
      "en": "Save to S3",
      "zh": "保存到S3"
    },
    "selectAll": {
      "en": "Select All of This Page",
      "zh": "全选本页"
    },
    "showHtmlMail": {
      "en": "Show Html Mail",
      "zh": "显示HTML邮件"
    },
    "showTextMail": {
      "en": "Show Text Mail",
      "zh": "显示纯文本邮件"
    },
    "success": {
      "en": "Success",
      "zh": "成功"
    },
    "unselectAll": {
      "en": "Unselect All",
      "zh": "取消全选"
    },
    "shortcuts": {
      "en": "Keyboard shortcuts",
      "zh": "键盘快捷键"
    },
    "addressCopied": {
      "en": "Address copied",
      "zh": "地址已复制"
    },
    "copyAddressFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    },
    "newMailNotificationTitle": {
      "en": "New mail",
      "zh": "新邮件"
    },
    "newMailNotificationBody": {
      "en": "New mail for {address}",
      "zh": "{address} 收到了新邮件"
    }
  },
  "components.AiExtractInfo": {
    "authCode": {
      "en": "Verification Code",
      "zh": "验证码"
    },
    "authLink": {
      "en": "Authentication Link",
      "zh": "认证链接"
    },
    "copyFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    },
    "copySuccess": {
      "en": "Copied successfully",
      "zh": "复制成功"
    },
    "open": {
      "en": "Open",
      "zh": "打开"
    },
    "otherLink": {
      "en": "Other Link",
      "zh": "其他链接"
    },
    "serviceLink": {
      "en": "Service Link",
      "zh": "服务链接"
    },
    "subscriptionLink": {
      "en": "Subscription Link",
      "zh": "订阅链接"
    }
  },
  "components.PasskeyWrapControls": {
    "protectWithPasskey": {
      "en": "Protect with Passkey",
      "zh": "使用通行密钥保护"
    },
    "loginHint": {
      "en": "Log in to an account to use passkey backups (mailbox-only users: use the passphrase backup).",
      "zh": "登录账号后可使用通行密钥备份（仅邮箱用户：请使用密码备份）。"
    },
    "bindHint": {
      "en": "Bind this address to your account first to enable passkey backups.",
      "zh": "请先将此地址绑定到你的账号，以使用通行密钥备份。"
    },
    "noPasskeys": {
      "en": "No passkeys are registered on your account yet. Register one in User Settings, or use the passphrase backup.",
      "zh": "你的账号尚未注册通行密钥。请先在用户设置中注册，或使用密码备份。"
    },
    "noKeyMaterial": {
      "en": "No usable key material: paste a valid raw decryption link or private key first.",
      "zh": "没有可用的密钥材料：请先粘贴有效的原始解密链接或私钥。"
    },
    "invalidKey": {
      "en": "The pasted key is not a valid private key or decryption link",
      "zh": "粘贴的内容不是有效的私钥或解密链接"
    },
    "prfUnsupported": {
      "en": "This passkey/browser doesn't support PRF — register a new passkey or use a passphrase backup.",
      "zh": "此通行密钥/浏览器不支持 PRF——请注册新的通行密钥或使用密码备份。"
    },
    "cancelled": {
      "en": "Passkey prompt cancelled.",
      "zh": "已取消通行密钥验证。"
    },
    "wrapFailed": {
      "en": "Could not create the passkey backup: {msg}",
      "zh": "无法创建通行密钥备份：{msg}"
    },
    "success": {
      "en": "Passkey-protected backup uploaded",
      "zh": "已上传通行密钥保护的备份"
    }
  },
  "components.KeyBackupPanel": {
    "rawLinkShownOnceWarning": {
      "en": "The raw decryption link below is shown only once. Anyone with it can read the encrypted mail of this address, and it cannot be recovered if lost. Prefer creating a passphrase-protected backup below.",
      "zh": "下面的明文解密链接只显示一次。任何获得此链接的人都可以阅读此地址的加密邮件，丢失后无法恢复。建议优先在下方创建受密码保护的备份。"
    },
    "copyRawLink": {
      "en": "Copy Decryption Link",
      "zh": "复制解密链接"
    },
    "rawLinkCopied": {
      "en": "Decryption link copied",
      "zh": "解密链接已复制"
    },
    "createBackupTip": {
      "en": "Optionally protect this key with a passphrase to create a backup link and backup file you can store safely.",
      "zh": "可选：使用密码保护此密钥，生成可安全保存的备份链接和备份文件。"
    },
    "passphrase": {
      "en": "Backup passphrase",
      "zh": "备份密码"
    },
    "confirmPassphrase": {
      "en": "Confirm passphrase",
      "zh": "确认密码"
    },
    "passphraseMismatch": {
      "en": "Passphrases do not match",
      "zh": "两次输入的密码不一致"
    },
    "passphraseTooShort": {
      "en": "The backup passphrase must be at least {min} characters",
      "zh": "备份密码至少需要 {min} 个字符"
    },
    "createBackup": {
      "en": "Create Protected Backup",
      "zh": "创建受保护的备份"
    },
    "backupCreated": {
      "en": "Protected backup created. Store the link or file below somewhere safe — the passphrase cannot be recovered.",
      "zh": "受保护的备份已创建。请将下面的链接或文件妥善保存——密码无法找回。"
    },
    "copyProtectedLink": {
      "en": "Copy Protected Link",
      "zh": "复制受保护的链接"
    },
    "protectedLinkCopied": {
      "en": "Protected backup link copied",
      "zh": "受保护的备份链接已复制"
    },
    "downloadBackupFile": {
      "en": "Download Backup File",
      "zh": "下载备份文件"
    },
    "copyFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    }
  },
  "components.KeyBackupReminder": {
    "title": {
      "en": "Your key exists only in this browser.",
      "zh": "您的密钥仅保存在此浏览器中。"
    },
    "body": {
      "en": "If you clear site data or lose this device, this mailbox's mail can't be recovered. Create a protected backup.",
      "zh": "如果清除站点数据或丢失此设备，此邮箱的邮件将无法恢复。请创建受保护的备份。"
    },
    "createBackup": {
      "en": "Create backup",
      "zh": "创建备份"
    },
    "savedLink": {
      "en": "I saved my decryption link",
      "zh": "我已保存解密链接"
    },
    "remindLater": {
      "en": "Remind me later",
      "zh": "稍后提醒"
    }
  },
  "components.OpenDeviceQrPanel": {
    "showQr": {
      "en": "Show QR",
      "zh": "显示二维码"
    },
    "hideQr": {
      "en": "Hide QR",
      "zh": "隐藏二维码"
    },
    "qrWarning": {
      "en": "Anyone who scans this can open your mailbox. Only show it to your own devices.",
      "zh": "任何扫描此二维码的人都可以打开您的邮箱。仅向您自己的设备展示。"
    },
    "copyLink": {
      "en": "Copy link",
      "zh": "复制链接"
    },
    "linkCopied": {
      "en": "Link copied",
      "zh": "链接已复制"
    },
    "copyFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    },
    "qrUnavailable": {
      "en": "Could not generate the QR code.",
      "zh": "无法生成二维码。"
    },
    "keyBackupMissing": {
      "en": "This mailbox is encrypted but has no protected backup, so the QR code only carries the login credential — the decryption key must be restored separately. Create a protected backup to include the key in the link.",
      "zh": "此邮箱已加密但尚无受保护的备份，因此二维码仅包含登录凭证——解密密钥需要单独恢复。创建受保护的备份后，链接才会一并携带密钥。"
    },
    "createBackup": {
      "en": "Create backup",
      "zh": "创建备份"
    }
  },
  "components.KeyBackupHost": {
    "createdTitle": {
      "en": "End-to-End Encryption Enabled",
      "zh": "已启用端到端加密"
    },
    "createdTip": {
      "en": "Save the decryption link below somewhere safe. Opening it on another device imports the decryption key there. Anyone with this link can read your encrypted mail.",
      "zh": "请妥善保存下面的解密链接，在其他设备上打开该链接即可导入解密密钥。任何获得此链接的人都可以阅读你的加密邮件。"
    },
    "keyStoreMemoryWarning": {
      "en": "Browser protected storage (IndexedDB) is unavailable: decryption keys are kept only for this session and will be lost when this tab closes. Save your backup or decryption link now.",
      "zh": "浏览器受保护存储（IndexedDB）不可用：解密密钥仅保留到本次会话结束，关闭标签页后将丢失。请立即保存备份或解密链接。"
    },
    "encryptMailKeyLostWarning": {
      "en": "Warning: if you lose the private key, encrypted mail becomes unrecoverable. The server cannot decrypt it for you.",
      "zh": "警告：如果丢失私钥，加密邮件将无法恢复，服务器也无法替你解密。"
    },
    "wrappedImportTitle": {
      "en": "Import Protected Key Backup",
      "zh": "导入受保护的密钥备份"
    },
    "wrappedImportTip": {
      "en": "Enter the backup passphrase for {address} to import its decryption key.",
      "zh": "请输入 {address} 的备份密码以导入解密密钥。"
    },
    "wrongPassphrase": {
      "en": "Incorrect passphrase or tampered backup. Please try again.",
      "zh": "密码错误或备份已被篡改，请重试。"
    },
    "invalidBackup": {
      "en": "This key backup is invalid or corrupted.",
      "zh": "此密钥备份无效或已损坏。"
    },
    "importSuccess": {
      "en": "Decryption key imported",
      "zh": "解密密钥已导入"
    },
    "cancel": {
      "en": "Cancel",
      "zh": "取消"
    },
    "import": {
      "en": "Import",
      "zh": "导入"
    },
    "rawOfferTitle": {
      "en": "Protect This Key?",
      "zh": "保护此密钥？"
    },
    "rawOfferTip": {
      "en": "A decryption key for {address} was just imported. Protect it with a backup passphrase so you can recover it later?",
      "zh": "刚刚导入了 {address} 的解密密钥。是否使用备份密码对其进行保护，以便日后恢复？"
    },
    "skip": {
      "en": "Skip",
      "zh": "跳过"
    },
    "passphraseMismatch": {
      "en": "Passphrases do not match",
      "zh": "两次输入的密码不一致"
    },
    "passphraseTooShort": {
      "en": "The backup passphrase must be at least {min} characters",
      "zh": "备份密码至少需要 {min} 个字符"
    },
    "createBackup": {
      "en": "Create Protected Backup",
      "zh": "创建受保护的备份"
    },
    "backupCreated": {
      "en": "Protected backup created",
      "zh": "受保护的备份已创建"
    },
    "legacyTitle": {
      "en": "Protect Your Decryption Keys",
      "zh": "保护你的解密密钥"
    },
    "legacyTip": {
      "en": "Your decryption keys were moved to protected browser storage. A legacy plaintext copy still exists in this browser and stays there until you decide what to do with it.",
      "zh": "你的解密密钥已迁移到浏览器受保护存储中，但旧版明文副本仍保留在此浏览器中，在你做出决定之前它会一直保留。"
    },
    "legacyChoosePassphrase": {
      "en": "Set a backup passphrase",
      "zh": "设置备份密码"
    },
    "legacyChooseDelete": {
      "en": "Skip and delete the plaintext copies now",
      "zh": "跳过并立即删除明文副本"
    },
    "legacyDeleteConfirm": {
      "en": "Delete the plaintext copies without creating backups? Make sure you already saved a decryption key or backup elsewhere.",
      "zh": "确定不创建备份并删除明文副本吗？请确保你已在其他地方保存了解密密钥或备份。"
    },
    "legacyChooseLater": {
      "en": "Later",
      "zh": "稍后"
    },
    "legacyProtected": {
      "en": "All keys are now protected with a passphrase and the plaintext copies were deleted.",
      "zh": "所有密钥已受密码保护，明文副本已删除。"
    },
    "legacyDeleted": {
      "en": "The plaintext copies were deleted.",
      "zh": "明文副本已删除。"
    },
    "back": {
      "en": "Back",
      "zh": "返回"
    }
  },
  "components.MailContentRenderer": {
    "from": {
      "en": "From",
      "zh": "发件人"
    },
    "to": {
      "en": "To",
      "zh": "收件人"
    },
    "mailDetails": {
      "en": "Mail details",
      "zh": "邮件详情"
    },
    "moreActions": {
      "en": "More actions",
      "zh": "更多操作"
    },
    "more": { "en": "More", "zh": "更多" },
    "attachments": {
      "en": "Attachments",
      "zh": "附件"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteMailTip": {
      "en": "Are you sure you want to delete mail?",
      "zh": "确定要删除邮件吗?"
    },
    "downloadMail": {
      "en": "Download Mail",
      "zh": "下载邮件"
    },
    "forward": {
      "en": "Forward",
      "zh": "转发"
    },
    "fullscreen": {
      "en": "Fullscreen",
      "zh": "全屏"
    },
    "markAsRead": {
      "en": "Mark as Read",
      "zh": "标为已读"
    },
    "markAsUnread": {
      "en": "Mark as Unread",
      "zh": "标为未读"
    },
    "loadRemoteImages": {
      "en": "Load Images",
      "zh": "加载图片"
    },
    "remoteImagesBlocked": {
      "en": "{count} remote resources blocked to protect your privacy",
      "zh": "已阻止 {count} 项外部资源以保护隐私"
    },
    "reply": {
      "en": "Reply",
      "zh": "回复"
    },
    "saveToS3": {
      "en": "Save to S3",
      "zh": "保存到S3"
    },
    "showHtmlMail": {
      "en": "Show HTML Mail",
      "zh": "显示HTML邮件"
    },
    "showTextMail": {
      "en": "Show Text Mail",
      "zh": "显示纯文本邮件"
    },
    "size": {
      "en": "Size",
      "zh": "大小"
    },
    "lockedMissingKey": {
      "en": "This mail is encrypted and the decryption key is not on this device.",
      "zh": "此邮件已端到端加密，此设备上没有解密密钥。"
    },
    "lockedDecryptFailed": {
      "en": "This mail could not be decrypted with the stored key.",
      "zh": "无法使用已存储的密钥解密此邮件。"
    },
    "unlockInputPlaceholder": {
      "en": "Paste private key or decryption link",
      "zh": "粘贴私钥或解密链接"
    },
    "unlock": {
      "en": "Unlock",
      "zh": "解锁"
    },
    "unlockSuccess": {
      "en": "Decryption key saved",
      "zh": "解密密钥已保存"
    },
    "unlockInvalid": {
      "en": "Invalid decryption key or link",
      "zh": "解密密钥或链接无效"
    },
    "unlockNeedsPassphrase": {
      "en": "This is a passphrase-protected key backup. Enter its passphrase in the prompt to import the key.",
      "zh": "这是一个受密码保护的密钥备份，请在弹出的提示中输入密码以导入密钥。"
    },
    "copyCode": {
      "en": "Copy verification code",
      "zh": "复制验证码"
    },
    "codeCopied": {
      "en": "Verification code copied",
      "zh": "验证码已复制"
    },
    "copyCodeFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    }
  },
  "components.ShortcutsOverlay": {
    "title": {
      "en": "Keyboard shortcuts",
      "zh": "键盘快捷键"
    },
    "copyAddress": {
      "en": "Copy current address",
      "zh": "复制当前地址"
    },
    "refresh": {
      "en": "Refresh the inbox",
      "zh": "刷新收件箱"
    },
    "nextPrev": {
      "en": "Next / previous mail",
      "zh": "下一封 / 上一封邮件"
    },
    "openMail": {
      "en": "Open selected mail",
      "zh": "打开选中的邮件"
    },
    "closeMail": {
      "en": "Close the open mail",
      "zh": "关闭打开的邮件"
    },
    "focusFilter": {
      "en": "Filter the mail list",
      "zh": "搜索/过滤邮件列表"
    },
    "showShortcuts": {
      "en": "Show this help",
      "zh": "显示此帮助"
    },
    "disabledInInputs": {
      "en": "Shortcuts are disabled while typing in a field or when a dialog is open.",
      "zh": "在输入框中打字或对话框打开时，快捷键不可用。"
    }
  },
  "components.Turnstile": {    "refresh": {
      "en": "Refresh",
      "zh": "刷新"
    }
  },
  "components.SendBox": {
    "cancelMultiAction": {
      "en": "Cancel Multi Action",
      "zh": "取消多选"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteMailTip": {
      "en": "Are you sure you want to delete mail?",
      "zh": "确定要删除邮件吗?"
    },
    "emptySent": {
      "en": "No sent emails",
      "zh": "发件箱为空"
    },
    "multiAction": {
      "en": "Multi Action",
      "zh": "多选"
    },
    "pleaseSelectMail": {
      "en": "Please select a mail to view.",
      "zh": "请选择一封邮件查看。"
    },
    "refresh": {
      "en": "Refresh",
      "zh": "刷新"
    },
    "selectAll": {
      "en": "Select All of This Page",
      "zh": "全选本页"
    },
    "showCode": {
      "en": "Change View Original Code",
      "zh": "切换查看元数据"
    },
    "success": {
      "en": "Success",
      "zh": "成功"
    },
    "unselectAll": {
      "en": "Unselect All",
      "zh": "取消全选"
    }
  },
  "components.AddressSelect": {
    "selectMailbox": {
      "en": "Select Mailbox",
      "zh": "选择邮箱"
    },
    "copied": {
      "en": "Copied",
      "zh": "已复制"
    },
    "copy": {
      "en": "Copy",
      "zh": "复制"
    },
    "localAddresses": {
      "en": "Local Email Addresses",
      "zh": "本地邮箱地址"
    },
    "linkedMailboxes": {
      "en": "Linked Mailboxes",
      "zh": "已绑定邮箱"
    }
  },
  "components.AddressCredentialModal": {
    "passwordOnlyTip": {
      "en": "Sign in with the mailbox password to view a session token.",
      "zh": "请使用邮箱密码登录后查看当前会话 Token。"
    },
    "sessionToken": {
      "en": "Session Token",
      "zh": "会话 Token"
    },
    "expiresAt": {
      "en": "Expires at",
      "zh": "到期时间"
    },
    "sessionTokenTip": {
      "en": "This token expires at the time shown above. Sign in again after expiry. Auto-login links and QR codes use the same token and expire with it.",
      "zh": "此 Token 在上述时间到期，过期后请重新登录。自动登录链接和二维码使用同一个 Token，并在同一时间失效。"
    },
    "addressCredential": {
      "en": "Address Credential",
      "zh": "地址凭证"
    },
    "addressCredentialLabel": {
      "en": "Mailbox access credential",
      "zh": "邮箱访问凭证"
    },
    "addressPassword": {
      "en": "Mailbox Password",
      "zh": "邮箱密码"
    },
    "agentAccess": {
      "en": "AI Agent",
      "zh": "AI Agent"
    },
    "agentAccessTip": {
      "en": "Use this mailbox from an AI agent with the Address JWT and parsed-mail APIs.",
      "zh": "AI Agent 可使用 Address JWT 和 parsed-mail API 读取这个邮箱。"
    },
    "agentConfig": {
      "en": "Agent config",
      "zh": "Agent 配置"
    },
    "agentSkill": {
      "en": "Agent skill",
      "zh": "Agent skill"
    },
    "apiBase": {
      "en": "API Base",
      "zh": "API 地址"
    },
    "autoLoginLink": {
      "en": "Auto-login link",
      "zh": "自动登录链接"
    },
    "decryptionLink": {
      "en": "Decryption link (auto-login + key)",
      "zh": "解密链接（自动登录 + 密钥）"
    },
    "decryptionLinkTip": {
      "en": "Anyone with this link can log in and read the encrypted mail of this address. Do not share it.",
      "zh": "任何获得此链接的人都可以登录并阅读此地址的加密邮件，请勿分享。"
    },
    "mailEncryption": {
      "en": "End-to-end encryption",
      "zh": "端到端加密"
    },
    "privateKey": {
      "en": "Private key",
      "zh": "私钥"
    },
    "privateKeyWarning": {
      "en": "Anyone with this key or the links below can read the encrypted mail of this address. If the key is lost, the mail cannot be recovered by anyone, including the server. Save it now.",
      "zh": "任何持有此私钥或下方链接的人都可以阅读此地址的加密邮件。如果丢失私钥，邮件将无法被任何人（包括服务器）恢复。请立即保存。"
    },
    "decryptionOnlyLink": {
      "en": "Decryption link (key only)",
      "zh": "解密链接（仅密钥）"
    },
    "autoLoginQrCode": {
      "en": "Scan to open on mobile",
      "zh": "手机扫码打开"
    },
    "autoLoginQrCodeTip": {
      "en": "Anyone with this QR code can access this mailbox. Do not share it.",
      "zh": "任何获取此二维码的人都可以访问该邮箱，请勿分享。"
    },
    "copyFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    },
    "copySection": {
      "en": "Copy",
      "zh": "复制"
    },
    "copySuccess": {
      "en": "Copied",
      "zh": "已复制"
    },
    "currentAddress": {
      "en": "Email address",
      "zh": "邮箱地址"
    },
    "docs": {
      "en": "Docs",
      "zh": "文档"
    },
    "imapHost": {
      "en": "IMAP host",
      "zh": "IMAP 主机"
    },
    "imapPort": {
      "en": "IMAP port",
      "zh": "IMAP 端口"
    },
    "password": {
      "en": "Password",
      "zh": "密码"
    },
    "plainOrProxyTls": {
      "en": "Plain or proxy TLS",
      "zh": "明文或代理层 TLS"
    },
    "security": {
      "en": "Security",
      "zh": "安全"
    },
    "smtpHost": {
      "en": "SMTP host",
      "zh": "SMTP 主机"
    },
    "smtpImapAccess": {
      "en": "SMTP / IMAP",
      "zh": "SMTP / IMAP"
    },
    "smtpImapTip": {
      "en": "Use these values in mail clients after the administrator configures the SMTP/IMAP proxy. The password can be the Address JWT shown here, or the mailbox password when you have it.",
      "zh": "管理员配置 SMTP/IMAP 代理后，可在邮件客户端中使用这些信息。密码可使用这里展示的 Address JWT，也可使用你持有的邮箱密码。"
    },
    "smtpPort": {
      "en": "SMTP port",
      "zh": "SMTP 端口"
    },
    "starttls": {
      "en": "STARTTLS",
      "zh": "STARTTLS"
    },
    "tip": {
      "en": "Use these credentials only with clients and agents you trust.",
      "zh": "请只在可信的客户端和 Agent 中使用这些凭证。"
    },
    "title": {
      "en": "Address Credentials & Connection Methods",
      "zh": "地址凭证与连接方式"
    },
    "username": {
      "en": "Username",
      "zh": "用户名"
    }
  },
  "views.user.UserMailBox": {
    "addressQueryTip": {
      "en": "Leave blank to query all addresses",
      "zh": "留空查询所有地址"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    }
  },
  "views.Index": {
    "about": {
      "en": "About",
      "zh": "关于"
    },
    "mailboxSettings": {
      "en": "Mailbox Settings",
      "zh": "邮箱设置"
    },
    "appearance": {
      "en": "Appearance",
      "zh": "外观"
    },
    "auto_reply": {
      "en": "Auto Reply",
      "zh": "自动回复"
    },
    "enterSimpleMode": {
      "en": "Simple Mode",
      "zh": "极简模式"
    },
    "inbox": {
      "en": "Inbox",
      "zh": "收件箱"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    },
    "s3Attachment": {
      "en": "S3 Attachment",
      "zh": "S3附件"
    },
    "saveToS3Success": {
      "en": "save to s3 success",
      "zh": "保存到s3成功"
    },
    "sendbox": {
      "en": "Sent",
      "zh": "发件箱"
    },
    "sendmail": {
      "en": "Send Mail",
      "zh": "发送邮件"
    },
    "webhookSettings": {
      "en": "Webhook Settings",
      "zh": "Webhook 设置"
    }
  },
  "views.Footer": {
    "copyright": {
      "en": "Copyright",
      "zh": "版权所有"
    }
  },
  "views.user.UserSettings": {
    "passkeySection": {
      "en": "Passkeys",
      "zh": "通行密钥"
    },
    "passkeyTip": {
      "en": "Sign in with your device instead of a password.",
      "zh": "使用设备验证代替密码登录。"
    },
    "accountSection": {
      "en": "Account",
      "zh": "账户"
    },
    "logoutTip": {
      "en": "Sign out of the user center on this browser.",
      "zh": "在此浏览器上退出用户中心。"
    },
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "createPasskey": {
      "en": "Create Passkey",
      "zh": "创建 Passkey"
    },
    "created_at": {
      "en": "Created At",
      "zh": "创建时间"
    },
    "deletePasskey": {
      "en": "Delete Passkey",
      "zh": "删除 Passkey"
    },
    "logout": {
      "en": "Logout",
      "zh": "退出登录"
    },
    "logoutConfirm": {
      "en": "Are you sure you want to logout?",
      "zh": "确定要退出登录吗？"
    },
    "passkeyCreated": {
      "en": "Passkey created successfully",
      "zh": "Passkey 创建成功"
    },
    "passkeyNamePlaceholder": {
      "en": "Please enter the passkey name or leave it empty to generate a random one",
      "zh": "请输入 Passkey 名称或者留空自动生成"
    },
    "passkey_name": {
      "en": "Passkey Name",
      "zh": "Passkey 名称"
    },
    "passordTip": {
      "en": "The server will only receive the hash value of the password, and will not receive the plaintext password, so it cannot view or retrieve your password. If the administrator enables email verification, you can reset the password in incognito mode",
      "zh": "服务器只会接收到密码的哈希值，不会接收到明文密码，因此无法查看或者找回您的密码, 如果管理员启用了邮件验证您可以在无痕模式重置密码"
    },
    "renamePasskey": {
      "en": "Rename Passkey",
      "zh": "重命名 Passkey"
    },
    "renamePasskeyNamePlaceholder": {
      "en": "Please enter the new passkey name",
      "zh": "请输入新的 Passkey 名称"
    },
    "showPasskeyList": {
      "en": "Show Passkey List",
      "zh": "查看 Passkey 列表"
    },
    "updated_at": {
      "en": "Updated At",
      "zh": "更新时间"
    }
  },
  "views.Header": {
    "admin": {
      "en": "Admin Console",
      "zh": "管理后台"
    },
    "accessHeader": {
      "en": "Access Password",
      "zh": "访问密码"
    },
    "accessTip": {
      "en": "Please enter the correct access password",
      "zh": "请输入站点访问密码"
    },
    "dark": {
      "en": "Dark",
      "zh": "深色"
    },
    "mailbox": {
      "en": "Mailbox",
      "zh": "邮箱"
    },
    "light": {
      "en": "Light",
      "zh": "浅色"
    },
    "menu": {
      "en": "Menu",
      "zh": "菜单"
    },
    "preferences": {
      "en": "Preferences",
      "zh": "偏好设置"
    },
    "ok": {
      "en": "OK",
      "zh": "确定"
    },
    "status": {
      "en": "Status",
      "zh": "状态"
    },
    "sourceOnGithub": {
      "en": "Source on GitHub",
      "zh": "GitHub 源码"
    },
    "title": {
      "en": "decrypts",
      "zh": "decrypts"
    },
    "userCenter": {
      "en": "User Center",
      "zh": "用户中心"
    }
  },
  "views.user.BindAddress": {
    "logout": {
      "en": "Logout",
      "zh": "退出登录"
    }
  },
  "views.Admin": {
    "about": {
      "en": "About",
      "zh": "关于"
    },
    "accessHeader": {
      "en": "Admin Password",
      "zh": "管理员密码"
    },
    "accessTip": {
      "en": "Please enter the admin password",
      "zh": "请输入管理员密码"
    },
    "mailbox_management": {
      "en": "Mailbox Management",
      "zh": "邮箱管理"
    },
    "mailbox_list": {
      "en": "Mailboxes",
      "zh": "邮箱列表"
    },
    "mailbox_create": {
      "en": "Create Email Address",
      "zh": "创建邮箱"
    },
    "mailbox_settings": {
      "en": "Global Mailbox Settings",
      "zh": "全局邮箱设置"
    },
    "adminAccount": {
      "en": "Admin",
      "zh": "管理员"
    },
    "aiExtractSettings": {
      "en": "AI Extract Settings",
      "zh": "AI 提取设置"
    },
    "appearance": {
      "en": "Appearance",
      "zh": "外观"
    },
    "confirm": {
      "en": "Confirm",
      "zh": "确认"
    },
    "database": {
      "en": "Database",
      "zh": "数据库"
    },
    "ipBlacklistSettings": {
      "en": "IP Blacklist",
      "zh": "IP 黑名单"
    },
    "loginMethod": {
      "en": "Login Method",
      "zh": "登录方式"
    },
    "loginViaDisabledCheck": {
      "en": "Disabled Password Check",
      "zh": "已禁用密码检查"
    },
    "loginViaPassword": {
      "en": "Admin Password Login",
      "zh": "管理员密码登录"
    },
    "loginViaUserAdmin": {
      "en": "User Account (Admin Role)",
      "zh": "用户账号（管理员权限）"
    },
    "logout": {
      "en": "Logout",
      "zh": "退出登录"
    },
    "logoutConfirmContent": {
      "en": "Are you sure you want to log out of the admin console?",
      "zh": "确定要退出管理后台吗？"
    },
    "logoutConfirmTitle": {
      "en": "Confirm Logout",
      "zh": "确认退出"
    },
    "logoutSuccess": {
      "en": "Logout successful",
      "zh": "退出成功"
    },
    "mailWebhook": {
      "en": "Mail Webhook",
      "zh": "邮件 Webhook"
    },
    "mails": {
      "en": "Emails",
      "zh": "邮件"
    },
    "maintenance": {
      "en": "Maintenance",
      "zh": "维护"
    },
    "ok": {
      "en": "OK",
      "zh": "确定"
    },
    "qucickSetup": {
      "en": "Quick Setup",
      "zh": "快速设置"
    },
    "redeemCodes": {
      "en": "Redemption Codes",
      "zh": "兑换码"
    },
    "roleAddressConfig": {
      "en": "Role Address Config",
      "zh": "角色地址配置"
    },
    "sendBox": {
      "en": "Sent",
      "zh": "发件箱"
    },
    "sendMail": {
      "en": "Send Mail",
      "zh": "发送邮件"
    },
    "senderAccess": {
      "en": "Sender Access Control",
      "zh": "发件权限控制"
    },
    "statistics": {
      "en": "Statistics",
      "zh": "统计"
    },
    "telegram": {
      "en": "Telegram Bot",
      "zh": "电报机器人"
    },
    "unknow": {
      "en": "Mails with unknow receiver",
      "zh": "无收件人邮件"
    },
    "user": {
      "en": "User",
      "zh": "用户"
    },
    "userOauth2Settings": {
      "en": "Oauth2 Settings",
      "zh": "Oauth2 设置"
    },
    "user_management": {
      "en": "User Management",
      "zh": "用户管理"
    },
    "user_settings": {
      "en": "User Settings",
      "zh": "用户设置"
    },
    "webhookSettings": {
      "en": "Webhook Settings",
      "zh": "Webhook 设置"
    },
    "workerconfig": {
      "en": "Worker Config",
      "zh": "Worker 配置"
    }
  },
  "views.admin.RedeemCodes": {
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "amount": {
      "en": "Sending credits",
      "zh": "发信额度"
    },
    "batchCreate": {
      "en": "Batch Generate",
      "zh": "批量生成"
    },
    "countLimit": {
      "en": "Generate 1-{max} codes at a time.",
      "zh": "每次可生成 1-{max} 个兑换码。"
    },
    "createdResult": {
      "en": "Redemption codes generated: {created}.",
      "zh": "已生成兑换码：{created} 个。"
    },
    "copy": {
      "en": "Copy",
      "zh": "复制"
    },
    "copied": {
      "en": "Redemption code copied",
      "zh": "兑换码已复制"
    },
    "copyFailed": {
      "en": "Unable to copy the redemption code",
      "zh": "复制兑换码失败"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteConfirm": {
      "en": "Delete this redemption code?",
      "zh": "确定删除这个兑换码吗？"
    },
    "downloadCsv": {
      "en": "Download CSV",
      "zh": "下载 CSV"
    },
    "edit": {
      "en": "Edit",
      "zh": "编辑"
    },
    "emptyPrefix": {
      "en": "No prefix",
      "zh": "无前缀"
    },
    "emptyPrefixTip": {
      "en": "Leave empty to redeem a mailbox without a prefix",
      "zh": "留空即兑换无前缀邮箱地址"
    },
    "enabled": {
      "en": "Enabled",
      "zh": "启用"
    },
    "expiresAt": {
      "en": "Expires at",
      "zh": "有效期至"
    },
    "expired": {
      "en": "Expired",
      "zh": "已过期"
    },
    "export": {
      "en": "Export",
      "zh": "导出"
    },
    "exportLimit": {
      "en": "Export rows (maximum {max})",
      "zh": "导出条数（上限 {max}）"
    },
    "generationCount": {
      "en": "Number to generate",
      "zh": "生成数量"
    },
    "generate": {
      "en": "Generate",
      "zh": "生成"
    },
    "invalidExpiration": {
      "en": "Select a future expiration time",
      "zh": "请选择未来的有效期"
    },
    "invalidPrefix": {
      "en": "Use only letters and digits, up to {max} characters. Leave empty for no prefix.",
      "zh": "前缀仅支持英文字母和数字，最多 {max} 个字符；留空表示无前缀。"
    },
    "roleRequired": {
      "en": "Select a role",
      "zh": "请选择角色"
    },
    "code": {
      "en": "Redemption code",
      "zh": "兑换码"
    },
    "no": {
      "en": "No",
      "zh": "否"
    },
    "prefix": {
      "en": "Address prefix",
      "zh": "地址前缀"
    },
    "redeemedAt": {
      "en": "Redeemed at",
      "zh": "兑换时间"
    },
    "redeemedUser": {
      "en": "Recipient account",
      "zh": "兑换账号"
    },
    "resultAddress": {
      "en": "Redeemed mailbox",
      "zh": "已兑换邮箱"
    },
    "role": {
      "en": "Role",
      "zh": "角色"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "saved": {
      "en": "Saved",
      "zh": "保存成功"
    },
    "search": {
      "en": "Search",
      "zh": "查询"
    },
    "searchPlaceholder": {
      "en": "Search redemption code",
      "zh": "搜索兑换码"
    },
    "targetAddress": {
      "en": "Recipient mailbox",
      "zh": "兑换邮箱"
    },
    "type": {
      "en": "Type",
      "zh": "类型"
    },
    "typeFilter": {
      "en": "Redemption code type",
      "zh": "兑换码类型"
    },
    "typeAddress": {
      "en": "Custom mailbox",
      "zh": "专属邮箱"
    },
    "typeBalance": {
      "en": "Sending credits",
      "zh": "发信额度"
    },
    "typeRole": {
      "en": "Role benefits",
      "zh": "角色权益"
    },
    "valid": {
      "en": "Active",
      "zh": "有效"
    },
    "yes": {
      "en": "Yes",
      "zh": "是"
    }
  },
  "views.User": {
    "address_management": {
      "en": "Mailbox Management",
      "zh": "邮箱管理"
    },
    "bind_address": {
      "en": "Link Email Address",
      "zh": "绑定邮箱地址"
    },
    "send_mail": {
      "en": "Send Mail",
      "zh": "发送邮件"
    },
    "user_mail_box_tab": {
      "en": "Inbox",
      "zh": "收件箱"
    },
    "user_settings": {
      "en": "User Settings",
      "zh": "用户设置"
    }
  },
  "views.user.UserSendBox": {
    "noAddress": {
      "en": "Select a bound email address to continue",
      "zh": "请选择一个已绑定的邮箱地址"
    },
    "sendbox": {
      "en": "Sent",
      "zh": "发件箱"
    }
  },
  "views.user.UserLogin": {
    "cannotForgotPassword": {
      "en": "Mail verification is disabled or register is disabled, cannot reset password, please contact administrator",
      "zh": "未开启邮箱验证或未开启注册功能，无法重置密码，请联系管理员"
    },
    "email": {
      "en": "Account Email",
      "zh": "用户邮箱"
    },
    "forgotPassword": {
      "en": "Forgot Password",
      "zh": "忘记密码"
    },
    "login": {
      "en": "Login",
      "zh": "登录"
    },
    "loginWith": {
      "en": "Login with {provider}",
      "zh": "使用 {provider} 登录"
    },
    "loginWithPasskey": {
      "en": "Login with Passkey",
      "zh": "使用 Passkey 登录"
    },
    "password": {
      "en": "Password",
      "zh": "密码"
    },
    "pleaseCompleteTurnstile": {
      "en": "Please complete turnstile",
      "zh": "请完成人机验证"
    },
    "pleaseInput": {
      "en": "Please enter the account email and password",
      "zh": "请输入用户邮箱和密码"
    },
    "pleaseInputCode": {
      "en": "Please input code",
      "zh": "请输入验证码"
    },
    "pleaseInputEmail": {
      "en": "Please enter the account email",
      "zh": "请输入用户邮箱"
    },
    "pleaseLogin": {
      "en": "Please login",
      "zh": "请登录"
    },
    "register": {
      "en": "Register",
      "zh": "注册"
    },
    "resetPassword": {
      "en": "Reset Password",
      "zh": "重置密码"
    },
    "sendVerificationCode": {
      "en": "Send Verification Code",
      "zh": "发送验证码"
    },
    "verifyCode": {
      "en": "Verification Code",
      "zh": "验证码"
    },
    "verifyCodeSent": {
      "en": "Verification Code Sent, expires in {timeout} seconds",
      "zh": "验证码已发送, {timeout} 秒后失效"
    },
    "waitforVerifyCode": {
      "en": "Wait for {timeout} seconds",
      "zh": "等待{timeout}秒"
    }
  },
  "views.user.UserBar": {
    "currentUser": {
      "en": "Current User",
      "zh": "当前用户"
    },
    "fetchUserSettingsError": {
      "en": "Login password is invalid or account not exist, it may be network connection issue, please try again later.",
      "zh": "登录信息已过期或账号不存在，也可能是网络连接异常，请稍后再尝试。"
    }
  },
  "views.user.AddressManagement": {
    "unbindPasswordTip": {
      "en": "Save the mailbox password before unlinking so you can log in again.",
      "zh": "解绑前请保存邮箱密码，以便之后重新登录。"
    },
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "addressQueryTip": {
      "en": "Leave blank to query all email addresses",
      "zh": "留空查询所有邮箱地址"
    },
    "address": {
      "en": "Mailboxes",
      "zh": "邮箱列表"
    },
    "openMailbox": {
      "en": "Open Mailbox",
      "zh": "进入邮箱"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    },
    "create_or_bind": {
      "en": "Add Mailbox",
      "zh": "添加邮箱"
    },
    "mail_count": {
      "en": "Mail Count",
      "zh": "邮件数量"
    },
    "itemCount": {
      "en": "Total",
      "zh": "总数"
    },
    "invalidQuery": {
      "en": "Search term must be at most 100 characters and cannot contain % or _",
      "zh": "搜索词最长 100 个字符，且不能包含 % 或 _"
    },
    "emailAddress": {
      "en": "Email Address",
      "zh": "邮箱地址"
    },
    "send_count": {
      "en": "Send Count",
      "zh": "发送数量"
    },
    "success": {
      "en": "success",
      "zh": "成功"
    },
    "targetUserEmail": {
      "en": "Target User Email",
      "zh": "目标用户邮箱"
    },
    "transferAddress": {
      "en": "Transfer Mailbox",
      "zh": "转移邮箱"
    },
    "transferAddressTip": {
      "en": "Transfer address to another user will remove the address from your account and transfer it to another user. Are you sure to transfer the address?",
      "zh": "转移地址到其他用户将会从你的账户中移除此地址并转移给其他用户。确定要转移地址吗？"
    },
    "unbindAddress": {
      "en": "Unlink Mailbox",
      "zh": "解绑邮箱"
    },
    "unbindAddressTip": {
      "en": "Before unbinding, please switch to this email address and save the email address credential.",
      "zh": "解绑前请切换到此邮箱地址并保存邮箱地址凭证。"
    }
  },
  "views.index.AccountSettings": {
    "accessSection": {
      "en": "Access",
      "zh": "访问"
    },
    "credentialTip": {
      "en": "Sign in on other devices or connect a mail client.",
      "zh": "在其他设备登录或连接邮件客户端。"
    },
    "passwordTip": {
      "en": "Used to log in with this address and a password.",
      "zh": "用于通过邮箱地址和密码登录。"
    },
    "logoutTip": {
      "en": "Sign out of this mailbox on this browser.",
      "zh": "在此浏览器上退出此邮箱。"
    },
    "dangerSection": {
      "en": "Danger zone",
      "zh": "危险操作"
    },
    "dangerSectionTip": {
      "en": "These actions cannot be undone.",
      "zh": "以下操作不可撤销。"
    },
    "clearInboxTip": {
      "en": "Permanently delete all received mail.",
      "zh": "永久删除所有收到的邮件。"
    },
    "clearSentItemsTip": {
      "en": "Permanently delete all sent mail.",
      "zh": "永久删除所有已发送的邮件。"
    },
    "deleteMailboxTip": {
      "en": "Delete this address and all of its mail.",
      "zh": "删除此邮箱地址及其全部邮件。"
    },
    "changePassword": {
      "en": "Change Mailbox Password",
      "zh": "修改邮箱密码"
    },
    "clearInbox": {
      "en": "Clear Inbox",
      "zh": "清空收件箱"
    },
    "clearInboxConfirm": {
      "en": "Are you sure to clear all emails in your inbox?",
      "zh": "确定要清空你收件箱中的所有邮件吗？"
    },
    "clearSentItems": {
      "en": "Clear Sent Items",
      "zh": "清空发件箱"
    },
    "clearSentItemsConfirm": {
      "en": "Are you sure to clear all emails in your sent items?",
      "zh": "确定要清空你发件箱中的所有邮件吗？"
    },
    "confirmPassword": {
      "en": "Confirm Password",
      "zh": "确认密码"
    },
    "deleteMailbox": {
      "en": "Delete Mailbox",
      "zh": "删除邮箱"
    },
    "burnMailbox": {
      "en": "Burn mailbox",
      "zh": "销毁邮箱"
    },
    "burnMailboxTip": {
      "en": "Permanently delete this address and all of its mail on the server, and remove this browser's keys and saved login for it.",
      "zh": "在服务器上永久删除此地址及其全部邮件，并移除此浏览器中保存的密钥和登录信息。"
    },
    "burnMailboxConfirm": {
      "en": "This permanently deletes the address and all of its mail on the server, and removes this browser's decryption keys. It cannot be undone.",
      "zh": "这将永久删除服务器上的此地址及其全部邮件，并移除此浏览器中的解密密钥，且无法撤销。"
    },
    "burnMailboxTypeAddress": {
      "en": "Type the full address to confirm",
      "zh": "输入完整邮箱地址以确认"
    },
    "burnMailboxDone": {
      "en": "Mailbox burned: the address and its mail are gone, and this browser's keys were removed",
      "zh": "邮箱已销毁：地址及其邮件已删除，此浏览器中的密钥已移除"
    },
    "openDevice": {
      "en": "Open on another device",
      "zh": "在其他设备上打开"
    },
    "openDeviceTip": {
      "en": "Show a QR code or copy a link that signs in to this mailbox on another device.",
      "zh": "显示二维码或复制链接，在您的其他设备上登录此邮箱。"
    },
    "deleteAccountConfirm": {
      "en": "Are you sure you want to delete this email address and all of its emails? This does not delete your user account.",
      "zh": "确定要删除当前邮箱地址及其中的所有邮件吗？此操作不会删除你的用户账号。"
    },
    "logout": {
      "en": "Log Out of Mailbox",
      "zh": "退出邮箱登录"
    },
    "logoutConfirm": {
      "en": "Are you sure you want to log out of the current email address?",
      "zh": "确定要退出当前邮箱地址的登录吗？"
    },
    "newPassword": {
      "en": "New Password",
      "zh": "新密码"
    },
    "passwordChanged": {
      "en": "Password changed successfully",
      "zh": "密码修改成功"
    },
    "passwordMismatch": {
      "en": "Passwords do not match",
      "zh": "密码不匹配"
    },
    "showAddressCredential": {
      "en": "Credentials & Connection Methods",
      "zh": "地址凭证与连接方式"
    },
    "showSessionToken": {
      "en": "View Session Token",
      "zh": "查看当前会话 Token"
    },
    "success": {
      "en": "Success",
      "zh": "成功"
    },
    "mailEncryption": {
      "en": "End-to-End Mail Encryption",
      "zh": "端到端邮件加密"
    },
    "encryptionUnavailable": {
      "en": "Mail encryption is not enabled on this server.",
      "zh": "服务器未启用邮件加密。"
    },
    "encryptionDisabledStatus": {
      "en": "Encryption is disabled for this address. Enable it to have incoming mail encrypted before it is stored.",
      "zh": "此地址未启用加密。启用后，收到的邮件将在存储前被加密。"
    },
    "encryptionEnable": {
      "en": "Enable",
      "zh": "启用"
    },
    "encryptionEnabled": {
      "en": "Encryption enabled",
      "zh": "加密已启用"
    },
    "encryptionRotate": {
      "en": "Rotate Key",
      "zh": "更换密钥"
    },
    "encryptionRotateTip": {
      "en": "A new key pair will be generated and only new mail will use it. Mail received before the rotation stays encrypted under the previous key and can still be read on this device; other devices need the old private key.",
      "zh": "将生成新的密钥对，只有新收到的邮件会使用新密钥。更换密钥前已收到的邮件仍使用旧密钥加密，本设备仍可解密；其他设备需要导入旧私钥才能读取。"
    },
    "encryptionDisable": {
      "en": "Disable",
      "zh": "禁用"
    },
    "encryptionDisableTip": {
      "en": "New mail will be stored in plaintext. Mail already received stays encrypted and can only be read with the matching private key.",
      "zh": "禁用后新邮件将以明文存储。已收到的加密邮件仍保持加密，只有使用对应的私钥才能读取。"
    },
    "encryptionKeyMismatch": {
      "en": "The public key on the server does not match any private key on this device. Import the private key below to read your mail.",
      "zh": "服务器上的公钥与此设备上的私钥不匹配，请在下方导入私钥后才能读取邮件。"
    },
    "encryptionNoLocalKey": {
      "en": "Encryption is enabled, but this device does not have the private key. Import it below.",
      "zh": "已启用加密，但此设备上没有私钥，请在下方导入。"
    },
    "keyFingerprint": {
      "en": "Key fingerprint",
      "zh": "密钥指纹"
    },
    "copyDecryptionLink": {
      "en": "Copy Decryption Link",
      "zh": "复制解密链接"
    },
    "copySuccess": {
      "en": "Copied",
      "zh": "已复制"
    },
    "copyFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    },
    "encryptionExportKey": {
      "en": "Export Private Key",
      "zh": "导出私钥"
    },
    "encryptionExportKeyTip": {
      "en": "Anyone holding this private key can read all encrypted mail of this address. Store it somewhere safe.",
      "zh": "任何持有此私钥的人都可以阅读此地址的所有加密邮件，请妥善保管。"
    },
    "encryptionImport": {
      "en": "Import",
      "zh": "导入"
    },
    "encryptionImportPlaceholder": {
      "en": "Paste private key or decryption link",
      "zh": "粘贴私钥或解密链接"
    },
    "encryptionImportInvalid": {
      "en": "Invalid decryption key or link",
      "zh": "解密密钥或链接无效"
    },
    "keyStoreMemoryWarning": {
      "en": "Browser protected storage (IndexedDB) is unavailable: decryption keys are kept only for this session and will be lost when this tab closes. Save your backup or decryption link now.",
      "zh": "浏览器受保护存储（IndexedDB）不可用：解密密钥仅保留到本次会话结束，关闭标签页后将丢失。请立即保存备份或解密链接。"
    },
    "keyStoreLegacyRetainedWarning": {
      "en": "Your existing decryption keys could not be moved to protected storage, so the legacy plaintext copy remains in this browser. Re-open this page in a normal browsing window to move it.",
      "zh": "已有的解密密钥无法迁移到受保护存储，因此旧版明文副本仍保留在此浏览器中。请在正常浏览窗口中重新打开此页面以完成迁移。"
    },
    "encryptExisting": {
      "en": "Encrypt Existing Mail",
      "zh": "加密已有邮件"
    },
    "encryptExistingTip": {
      "en": "Mail stored before encryption was enabled is still plaintext on the server. This re-encrypts all stored mail on the server irreversibly: afterwards it can only be read with this address's private key, and losing the private key makes it unrecoverable. Continue?",
      "zh": "启用加密前已存储的邮件在服务器上仍是明文。此操作会将所有已存储的邮件在服务器上不可逆地重新加密：之后只能使用此地址的私钥读取，一旦丢失私钥将无法恢复。是否继续？"
    },
    "encryptExistingRunning": {
      "en": "Encrypting existing mail… {done} done, about {remaining} remaining",
      "zh": "正在加密已有邮件… 已处理 {done} 封，剩余约 {remaining} 封"
    },
    "encryptExistingCancel": {
      "en": "Cancel",
      "zh": "取消"
    },
    "encryptExistingCancelled": {
      "en": "Encryption cancelled. Remaining plaintext mail is unchanged and you can resume at any time.",
      "zh": "已取消加密。剩余明文邮件未受影响，可随时重新开始。"
    },
    "encryptExistingDone": {
      "en": "Finished encrypting existing mail: {encrypted} encrypted, {skipped} skipped.",
      "zh": "已有邮件加密完成：已加密 {encrypted} 封，跳过 {skipped} 封。"
    },
    "encryptExistingFailed": {
      "en": "Failed to encrypt existing mail: {msg}",
      "zh": "加密已有邮件失败：{msg}"
    },
    "encryptExistingKeyMismatch": {
      "en": "The server's public key for this address does not match any key stored on this device, so nothing was encrypted. Restore or import the current private key first (passkey backup, protected backup or decryption link), then try again.",
      "zh": "服务器上此地址的公钥与本设备保存的任何密钥都不匹配，因此未执行任何加密。请先恢复或导入当前私钥（通行密钥备份、受保护备份或解密链接），然后重试。"
    },
    "copyProtectedBackupLink": {
      "en": "Copy Protected Backup Link",
      "zh": "复制受保护的备份链接"
    },
    "downloadProtectedBackupFile": {
      "en": "Download Protected Backup File",
      "zh": "下载受保护的备份文件"
    },
    "createBackupFromKey": {
      "en": "Create Protected Backup From My Key",
      "zh": "使用我的密钥创建受保护的备份"
    },
    "importKeyBackup": {
      "en": "Import Key Backup",
      "zh": "导入密钥备份"
    },
    "noBackupHint": {
      "en": "No protected backup exists for this address yet. Backups can only be created from the raw key at creation, import or rotation time — you can also paste your raw key below to create one now.",
      "zh": "此地址还没有受保护的备份。备份只能在创建、导入或更换密钥时通过原始密钥生成——你也可以在下方粘贴原始密钥立即创建一个。"
    },
    "backupLinkCopied": {
      "en": "Protected backup link copied",
      "zh": "受保护的备份链接已复制"
    },
    "backupCreated": {
      "en": "Protected backup created",
      "zh": "受保护的备份已创建"
    },
    "encryptionImportNeedsPassphrase": {
      "en": "This is a passphrase-protected key backup — enter its passphrase in the prompt to import it.",
      "zh": "这是一个受密码保护的密钥备份——请在弹出的提示中输入密码以导入。"
    },
    "keyStoreMigrationPendingWarning": {
      "en": "A legacy plaintext copy of your decryption keys is still present — finish protecting your keys.",
      "zh": "解密密钥的旧版明文副本仍存在——请完成密钥保护。"
    },
    "finishProtectingKeys": {
      "en": "Finish Protecting Keys",
      "zh": "完成密钥保护"
    },
    "newKeyBackupTitle": {
      "en": "New Decryption Key Generated",
      "zh": "已生成新的解密密钥"
    },
    "newKeyBackupTip": {
      "en": "A new key pair was generated for this address. Save the raw decryption link now — it is shown only once — or protect the key with a passphrase to create a backup.",
      "zh": "已为此地址生成新的密钥对。请立即保存原始解密链接——它只显示一次——或使用密码保护密钥以创建备份。"
    },
    "createBackupTitle": {
      "en": "Create Protected Backup From My Key",
      "zh": "使用我的密钥创建受保护的备份"
    },
    "createBackupTip": {
      "en": "Paste the raw decryption link or private key for this address (it must match a key already stored on this device), then choose a backup passphrase. The pasted key is dropped after the backup is created.",
      "zh": "粘贴此地址的原始解密链接或私钥（必须与此设备上已存储的密钥匹配），然后设置备份密码。备份创建后粘贴的密钥将被丢弃。"
    },
    "createBackupInputLabel": {
      "en": "Raw decryption link or private key",
      "zh": "原始解密链接或私钥"
    },
    "createBackupInputPlaceholder": {
      "en": "Paste #k= link or private key",
      "zh": "粘贴 #k= 链接或私钥"
    },
    "backupPassphrase": {
      "en": "Backup passphrase",
      "zh": "备份密码"
    },
    "backupConfirmPassphrase": {
      "en": "Confirm passphrase",
      "zh": "确认密码"
    },
    "backupKeyInvalid": {
      "en": "The pasted key is not a valid private key or decryption link",
      "zh": "粘贴的内容不是有效的私钥或解密链接"
    },
    "backupKeyMismatch": {
      "en": "The pasted key does not match any decryption key stored on this device for this address",
      "zh": "粘贴的密钥与此设备上为此地址存储的解密密钥均不匹配"
    },
    "backupPassphraseTooShort": {
      "en": "The backup passphrase must be at least {min} characters",
      "zh": "备份密码至少需要 {min} 个字符"
    },
    "importBackupTitle": {
      "en": "Import Key Backup",
      "zh": "导入密钥备份"
    },
    "importBackupTip": {
      "en": "Paste a protected backup link (#kp=…) or load a backup file. You will be asked for the backup passphrase next.",
      "zh": "粘贴受保护的备份链接（#kp=…）或选择备份文件。接下来会要求你输入备份密码。"
    },
    "importBackupPlaceholder": {
      "en": "Paste #kp= backup link or backup file content",
      "zh": "粘贴 #kp= 备份链接或备份文件内容"
    },
    "importBackupInvalid": {
      "en": "This is not a valid key backup link or file",
      "zh": "这不是有效的密钥备份链接或文件"
    },
    "importBackupQueued": {
      "en": "Backup accepted — enter its passphrase in the prompt",
      "zh": "备份已接受——请在弹出的提示中输入密码"
    },
    "cancel": {
      "en": "Cancel",
      "zh": "取消"
    },
    "passkeyBackupTip": {
      "en": "Passkey backups stored on your account: restore the decryption key on a new device with the passkey, or remove them. The server only holds an opaque blob it cannot decrypt.",
      "zh": "存储在账号上的通行密钥备份：可在新设备上用通行密钥恢复解密密钥，或将其删除。服务器只保存无法解密的加密数据。"
    },
    "passkeyBackupEmpty": {
      "en": "No passkey backups for this address yet.",
      "zh": "此地址还没有通行密钥备份。"
    },
    "passkeyBackupBindHint": {
      "en": "Bind this address to your account to manage passkey backups here.",
      "zh": "将此地址绑定到你的账号后，可在此管理通行密钥备份。"
    },
    "passkeyBackupCreatedAt": {
      "en": "Created",
      "zh": "创建时间"
    },
    "passkeyBackupCurrentKey": {
      "en": "current key on this device",
      "zh": "此设备当前密钥"
    },
    "passkeyBackupOldKey": {
      "en": "older/rotated key (not stored on this device)",
      "zh": "旧密钥/已轮换（此设备未存储）"
    },
    "restoreFromPasskey": {
      "en": "Restore Key From Passkey",
      "zh": "从通行密钥恢复密钥"
    },
    "deletePasskeyBackup": {
      "en": "Delete",
      "zh": "删除"
    },
    "deletePasskeyBackupConfirm": {
      "en": "Delete this passkey backup? The wrapped key cannot be recovered from the server afterwards.",
      "zh": "确定删除此通行密钥备份吗？删除后服务器无法恢复被保护的密钥。"
    },
    "passkeyBackupRestored": {
      "en": "Decryption key restored from the passkey backup",
      "zh": "已从通行密钥备份恢复解密密钥"
    },
    "passkeyBackupDeleted": {
      "en": "Passkey backup deleted",
      "zh": "通行密钥备份已删除"
    },
    "passkeyBackupCancelled": {
      "en": "Passkey prompt cancelled",
      "zh": "已取消通行密钥验证"
    },
    "passkeyBackupRestoreFailed": {
      "en": "The key could not be stored on this device",
      "zh": "无法在此设备上存储密钥"
    },
    "passkeyUnwrapFailed": {
      "en": "Could not unwrap this backup — it belongs to a different key/passkey or is tampered.",
      "zh": "无法解包此备份——它属于其他密钥/通行密钥，或已被篡改。"
    },
    "passkeyPrfUnsupported": {
      "en": "This passkey/browser doesn't support PRF — register a new passkey or use a passphrase backup.",
      "zh": "此通行密钥/浏览器不支持 PRF——请注册新的通行密钥或使用密码备份。"
    }
  },
  "views.user.UserOauth2Callback": {
    "codeNotFound": {
      "en": "code not found",
      "zh": "未找到授权码"
    },
    "logging": {
      "en": "Logging in...",
      "zh": "登录中..."
    },
    "stateNotMatch": {
      "en": "state not match",
      "zh": "state 不匹配"
    }
  },
  "views.index.Attachment": {
    "action": {
      "en": "Action",
      "zh": "操作"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteConfirm": {
      "en": "Are you sure to delete this attachment?",
      "zh": "确定要删除此附件吗？"
    },
    "deleteSuccess": {
      "en": "Deleted successfully",
      "zh": "删除成功"
    },
    "download": {
      "en": "Download",
      "zh": "下载"
    }
  },
  "views.index.AutoReply": {
    "autoReply": {
      "en": "Auto Reply",
      "zh": "自动回复"
    },
    "enableAutoReply": {
      "en": "Enable Auto Reply",
      "zh": "启用自动回复"
    },
    "name": {
      "en": "Name",
      "zh": "名称"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "settings": {
      "en": "Settings",
      "zh": "设置"
    },
    "sourcePrefix": {
      "en": "Sender Filter",
      "zh": "发件人过滤"
    },
    "sourcePrefixPlaceholder": {
      "en": "Empty=all, prefix match, or /regex/",
      "zh": "留空=全部匹配，前缀匹配，或 /正则/"
    },
    "subject": {
      "en": "Subject",
      "zh": "主题"
    },
    "success": {
      "en": "Success",
      "zh": "成功"
    }
  },
  "views.index.SendMail": {
    "balanceUnavailable": {
      "en": "No send balance for this address",
      "zh": "当前地址暂无发信额度"
    },
    "composeMail": {
      "en": "Compose email",
      "zh": "写邮件"
    },
    "content": {
      "en": "Content",
      "zh": "内容"
    },
    "contentEmpty": {
      "en": "Content is empty",
      "zh": "内容不能为空"
    },
    "contentPlaceholder": {
      "en": "Write your message...",
      "zh": "输入邮件正文..."
    },
    "draftSaved": {
      "en": "Draft saved in this browser",
      "zh": "草稿已保存在当前浏览器"
    },
    "edit": {
      "en": "Edit",
      "zh": "编辑"
    },
    "fromName": {
      "en": "Your Name and Address, leave Name blank to use email address",
      "zh": "你的名称和地址，名称不填写则使用邮箱地址"
    },
    "html": {
      "en": "HTML",
      "zh": "HTML"
    },
    "options": {
      "en": "Options",
      "zh": "选项"
    },
    "preview": {
      "en": "Preview",
      "zh": "预览"
    },
    "requestAccess": {
      "en": "Request send access",
      "zh": "申请发信权限"
    },
    "requestAccessTip": {
      "en": "Send permission and balance are managed separately for each email address. The current address, {address}, has no available balance. Request permission for this address or contact the admin.",
      "zh": "发信权限和额度按邮箱地址独立管理。当前地址 {address} 暂无可用额度，请为此地址申请发信权限或联系管理员。"
    },
    "requestSuccess": {
      "en": "Send permission requested for the current address",
      "zh": "已为当前地址提交发信权限申请"
    },
    "recipientAddress": {
      "en": "Recipient address",
      "zh": "收件人邮箱"
    },
    "recipientName": {
      "en": "Recipient name (optional)",
      "zh": "收件人名称（可选）"
    },
    "rich text": {
      "en": "Rich Text",
      "zh": "富文本"
    },
    "send": {
      "en": "Send",
      "zh": "发送"
    },
    "send_balance": {
      "en": "Current Address Send Balance",
      "zh": "当前地址剩余发信额度"
    },
    "senderAddress": {
      "en": "Sender address",
      "zh": "发件邮箱"
    },
    "senderName": {
      "en": "Sender name (optional)",
      "zh": "发件人名称（可选）"
    },
    "subject": {
      "en": "Subject",
      "zh": "主题"
    },
    "subjectEmpty": {
      "en": "Subject is empty",
      "zh": "主题不能为空"
    },
    "successSend": {
      "en": "Please check your sendbox. If failed, please check your balance or try again later.",
      "zh": "请查看您的发件箱, 如果失败, 请检查您的余额或稍后重试。"
    },
    "text": {
      "en": "Text",
      "zh": "纯文本"
    },
    "toMailEmpty": {
      "en": "Recipient address is empty",
      "zh": "收件人地址不能为空"
    },
    "toName": {
      "en": "Recipient Name and Address, leave Name blank to use email address",
      "zh": "收件人名称和地址，名称不填写则使用邮箱地址"
    },
    "tooLarge": {
      "en": "Too large file, please upload file less than 1MB.",
      "zh": "文件过大, 请上传小于1MB的文件。"
    }
  },
  "views.index.SimpleIndex": {
    "mailboxSettings": {
      "en": "Mailbox Settings",
      "zh": "邮箱设置"
    },
    "addressCopied": {
      "en": "Address copied successfully",
      "zh": "地址复制成功"
    },
    "addressCredential": {
      "en": "Mail Address Credential",
      "zh": "邮箱地址凭证"
    },
    "addressCredentialTip": {
      "en": "Please copy the Mail Address Credential and you can use it to login",
      "zh": "请复制邮箱地址凭证，你可以使用它登录你的邮箱。"
    },
    "copyAddress": {
      "en": "Copy",
      "zh": "复制"
    },
    "deleteSuccess": {
      "en": "Mail deleted successfully",
      "zh": "邮件删除成功"
    },
    "exitSimpleIndex": {
      "en": "Exit Simple",
      "zh": "退出极简"
    },
    "mailCount": {
      "en": "{current} / {total} emails",
      "zh": "{current} / {total} 封邮件"
    },
    "nextPage": {
      "en": "Next",
      "zh": "下一页"
    },
    "noMails": {
      "en": "No mails found",
      "zh": "暂无邮件"
    },
    "prevPage": {
      "en": "Previous",
      "zh": "上一页"
    },
    "readStatusUpdated": {
      "en": "Read status updated",
      "zh": "已读状态已更新"
    },
    "refreshAfter": {
      "en": "Refresh After {msg} Seconds",
      "zh": "{msg}秒后刷新"
    },
    "refreshMails": {
      "en": "Refresh",
      "zh": "刷新"
    },
    "refreshSuccess": {
      "en": "Mails refreshed successfully",
      "zh": "邮件刷新成功"
    }
  },
  "views.index.TelegramAddress": {
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "address": {
      "en": "Address",
      "zh": "地址"
    },
    "bind": {
      "en": "Bind",
      "zh": "绑定"
    },
    "bindAddressSuccess": {
      "en": "Bind Address Success",
      "zh": "绑定地址成功"
    },
    "changeMailAddress": {
      "en": "Change Mail Address",
      "zh": "切换邮箱地址"
    },
    "success": {
      "en": "success",
      "zh": "成功"
    },
    "unbindMailAddress": {
      "en": "Unbind Mail Address",
      "zh": "解绑邮箱地址"
    }
  },
  "views.index.AddressBar": {
    "landingTitle": {
      "en": "Your temporary inbox",
      "zh": "临时邮箱"
    },
    "landingTip": {
      "en": "Log in to a mailbox or create a new address.",
      "zh": "登录已有邮箱，或创建新的邮箱地址。"
    },
    "yourAddress": {
      "en": "Your address",
      "zh": "当前地址"
    },
    "mailboxOptions": {
      "en": "Mailbox options",
      "zh": "邮箱选项"
    },
    "addressCredential": {
      "en": "Mail Address Credential",
      "zh": "邮箱地址凭证"
    },
    "addressCredentialTip": {
      "en": "Please copy the Mail Address Credential and you can use it to login to your email account.",
      "zh": "请复制邮箱地址凭证，你可以使用它登录你的邮箱。"
    },
    "addressManage": {
      "en": "Mailbox Management",
      "zh": "邮箱管理"
    },
    "addressPassword": {
      "en": "Mailbox Password",
      "zh": "邮箱密码"
    },
    "fetchAddressError": {
      "en": "Mail address credential is invalid or account not exist, it may be network connection issue, please try again later.",
      "zh": "邮箱地址凭证无效或邮箱地址不存在，也可能是网络连接异常，请稍后再尝试。"
    },
    "linkWithAddressCredential": {
      "en": "Open to auto login email link",
      "zh": "打开即可自动登录邮箱的链接"
    },
    "ok": {
      "en": "OK",
      "zh": "确定"
    },
    "userCenter": {
      "en": "User Center",
      "zh": "用户中心"
    }
  },
  "views.admin.SendBox": {
    "query": {
      "en": "Query",
      "zh": "查询"
    },
    "queryTip": {
      "en": "Please input address to query, leave blank to query all",
      "zh": "请输入地址查询, 留空则查询所有"
    }
  },
  "views.admin.AiExtractSettings": {
    "allowList": {
      "en": "Address Allowlist (Enter address and press Enter, wildcards supported)",
      "zh": "地址白名单 (请输入地址并回车，支持通配符)"
    },
    "allowListTip": {
      "en": "Wildcard * matches any characters, e.g. *{'@'}example.com matches all addresses under example.com domain",
      "zh": "通配符 * 可匹配任意字符，如 *{'@'}example.com 可匹配 example.com 域名下的所有地址"
    },
    "disabledTip": {
      "en": "When disabled, AI extraction will process all email addresses",
      "zh": "未启用时，所有邮箱地址都可使用 AI 提取功能"
    },
    "enableAllowList": {
      "en": "Enable Address Allowlist",
      "zh": "启用地址白名单"
    },
    "enableAllowListTip": {
      "en": "When enabled, AI extraction will only process emails sent to addresses in the allowlist",
      "zh": "启用后，AI 提取功能仅对白名单中的邮箱地址生效"
    },
    "manualInputPrompt": {
      "en": "Type and press Enter to add",
      "zh": "输入后按回车键添加"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "successTip": {
      "en": "Success",
      "zh": "成功"
    },
    "title": {
      "en": "AI Email Extraction Settings",
      "zh": "AI 邮件提取设置"
    }
  },
  "views.admin.SendMail": {
    "adminComposeTip": {
      "en": "Send from a configured email address",
      "zh": "使用已配置的邮箱地址发信"
    },
    "composeMail": {
      "en": "Compose email",
      "zh": "写邮件"
    },
    "content": {
      "en": "Content",
      "zh": "内容"
    },
    "contentEmpty": {
      "en": "Content is empty",
      "zh": "内容不能为空"
    },
    "contentPlaceholder": {
      "en": "Write your message...",
      "zh": "输入邮件正文..."
    },
    "draftSaved": {
      "en": "Draft saved in this browser",
      "zh": "草稿已保存在当前浏览器"
    },
    "edit": {
      "en": "Edit",
      "zh": "编辑"
    },
    "fromMailEmpty": {
      "en": "Sender address is empty",
      "zh": "发件人地址不能为空"
    },
    "fromName": {
      "en": "Your Name and Address, leave Name blank to use email address",
      "zh": "你的名称和地址，名称不填写则使用邮箱地址"
    },
    "html": {
      "en": "HTML",
      "zh": "HTML"
    },
    "options": {
      "en": "Options",
      "zh": "选项"
    },
    "preview": {
      "en": "Preview",
      "zh": "预览"
    },
    "recipientAddress": {
      "en": "Recipient address",
      "zh": "收件人邮箱"
    },
    "recipientName": {
      "en": "Recipient name (optional)",
      "zh": "收件人名称（可选）"
    },
    "rich text": {
      "en": "Rich Text",
      "zh": "富文本"
    },
    "send": {
      "en": "Send",
      "zh": "发送"
    },
    "senderAddress": {
      "en": "Sender address",
      "zh": "发件邮箱"
    },
    "senderName": {
      "en": "Sender name (optional)",
      "zh": "发件人名称（可选）"
    },
    "subject": {
      "en": "Subject",
      "zh": "主题"
    },
    "subjectEmpty": {
      "en": "Subject is empty",
      "zh": "主题不能为空"
    },
    "successSend": {
      "en": "Please check your sendbox. If failed, please try again later.",
      "zh": "请查看您的发件箱, 如果失败, 请检查稍后重试。"
    },
    "text": {
      "en": "Text",
      "zh": "纯文本"
    },
    "toMailEmpty": {
      "en": "Recipient address is empty",
      "zh": "收件人地址不能为空"
    },
    "toName": {
      "en": "Recipient Name and Address, leave Name blank to use email address",
      "zh": "收件人名称和地址，名称不填写则使用邮箱地址"
    },
    "tooLarge": {
      "en": "Too large file, please upload file less than 1MB.",
      "zh": "文件过大, 请上传小于1MB的文件。"
    }
  },
  "views.admin.Account": {
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "addressCredential": {
      "en": "Mail Address Credential",
      "zh": "邮箱地址凭证"
    },
    "addressCredentialTip": {
      "en": "Please copy the Mail Address Credential and you can use it to login to your email account.",
      "zh": "请复制邮箱地址凭证，你可以使用它登录你的邮箱。"
    },
    "addressQueryTip": {
      "en": "Leave blank to query all email addresses",
      "zh": "留空查询所有邮箱地址"
    },
    "clearInbox": {
      "en": "Clear Inbox",
      "zh": "清空收件箱"
    },
    "clearInboxTip": {
      "en": "Are you sure to clear inbox for this email?",
      "zh": "确定要清空这个邮箱的收件箱吗？"
    },
    "clearSentItems": {
      "en": "Clear Sent Items",
      "zh": "清空发件箱"
    },
    "clearSentItemsTip": {
      "en": "Are you sure to clear sent items for this email?",
      "zh": "确定要清空这个邮箱的发件箱吗？"
    },
    "created_at": {
      "en": "Created At",
      "zh": "创建时间"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteMailbox": {
      "en": "Delete Mailbox",
      "zh": "删除邮箱"
    },
    "deleteTip": {
      "en": "Are you sure you want to delete this mailbox?",
      "zh": "确定要删除这个邮箱吗？"
    },
    "itemCount": {
      "en": "itemCount",
      "zh": "总数"
    },
    "mail_count": {
      "en": "Mail Count",
      "zh": "邮件数量"
    },
    "multiClearInbox": {
      "en": "Multi Clear Inbox",
      "zh": "批量清空收件箱"
    },
    "multiClearInboxTip": {
      "en": "Are you sure to clear inbox for selected addresses?",
      "zh": "确定要清空选中邮箱的收件箱吗？"
    },
    "multiClearSentItems": {
      "en": "Multi Clear Sent Items",
      "zh": "批量清空发件箱"
    },
    "multiClearSentItemsTip": {
      "en": "Are you sure to clear sent items for selected addresses?",
      "zh": "确定要清空选中邮箱的发件箱吗？"
    },
    "multiDelete": {
      "en": "Multi Delete",
      "zh": "批量删除"
    },
    "multiDeleteTip": {
      "en": "Are you sure to delete selected addresses?",
      "zh": "确定要删除选中的邮箱吗？"
    },
    "emailAddress": {
      "en": "Email Address",
      "zh": "邮箱地址"
    },
    "newPassword": {
      "en": "New Password",
      "zh": "新密码"
    },
    "passwordResetSuccess": {
      "en": "Password reset successfully",
      "zh": "密码重置成功"
    },
    "pleaseSelectAddress": {
      "en": "Please select a mailbox",
      "zh": "请选择邮箱"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    },
    "resetPassword": {
      "en": "Reset Password",
      "zh": "重置密码"
    },
    "selectAll": {
      "en": "Select All of This Page",
      "zh": "全选本页"
    },
    "selectedItems": {
      "en": "Selected",
      "zh": "已选择"
    },
    "send_count": {
      "en": "Send Count",
      "zh": "发送数量"
    },
    "showCredential": {
      "en": "Show Mail Address Credential",
      "zh": "查看邮箱地址凭证"
    },
    "source_meta": {
      "en": "Source",
      "zh": "来源"
    },
    "success": {
      "en": "Success",
      "zh": "成功"
    },
    "unselectAll": {
      "en": "Unselect All",
      "zh": "取消全选"
    },
    "updated_at": {
      "en": "Update At",
      "zh": "更新时间"
    },
    "viewMails": {
      "en": "View Mails",
      "zh": "查看邮件"
    },
    "viewSendBox": {
      "en": "View SendBox",
      "zh": "查看发件箱"
    }
  },
  "views.admin.UserOauth2Settings": {
    "addOauth2": {
      "en": "Add Oauth2",
      "zh": "添加 Oauth2"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "enable": {
      "en": "Enable",
      "zh": "启用"
    },
    "enableEmailFormat": {
      "en": "Enable Email Format",
      "zh": "启用邮箱格式转换"
    },
    "enableMailAllowList": {
      "en": "Enable Mail Address Allow List(Manually enterable)",
      "zh": "启用邮件地址白名单(可手动输入, 回车增加)"
    },
    "icon": {
      "en": "Icon (SVG, please ensure trusted source)",
      "zh": "图标 (SVG, 请确保来源可信)"
    },
    "iconPreview": {
      "en": "Preview",
      "zh": "预览"
    },
    "mailAllowList": {
      "en": "Mail Address Allow List",
      "zh": "邮件地址白名单"
    },
    "manualInputPrompt": {
      "en": "Type and press Enter to add",
      "zh": "输入后按回车键添加"
    },
    "name": {
      "en": "Name",
      "zh": "名称"
    },
    "oauth2Type": {
      "en": "Oauth2 Type",
      "zh": "Oauth2 类型"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "successTip": {
      "en": "Save Success",
      "zh": "保存成功"
    },
    "tip": {
      "en": "Third-party login will automatically use the user's email to register an account (the same email will be regarded as the same account), this account is the same as the registered account, and you can also set the password through the forget password",
      "zh": "第三方登录会自动使用用户邮箱注册账号(邮箱相同将视为同一账号), 此账号和注册的账号相同, 也可以通过忘记密码设置密码"
    },
    "userEmailFormat": {
      "en": "Email Regex Pattern",
      "zh": "邮箱正则表达式"
    },
    "userEmailFormatTip": {
      "en": "Use regex to transform email. Example: ^(.+)@old\\.com$ with $1@new.com",
      "zh": "使用正则转换邮箱。示例: ^(.+)@old\\.com$ 配合 $1@new.com"
    },
    "userEmailReplace": {
      "en": "Replace Template",
      "zh": "替换模板"
    }
  },
  "views.admin.Statistics": {
    "refresh": { "en": "Refresh", "zh": "刷新" },
    "dateRange": { "en": "Time range", "zh": "时间范围" },
    "days7": { "en": "Last 7 days", "zh": "近 7 天" },
    "days30": { "en": "Last 30 days", "zh": "近 30 天" },
    "today": { "en": "Today", "zh": "今天" },
    "rangeLimit": { "en": "Select a range of up to 30 days.", "zh": "单次最多查看 30 天，请缩小日期范围。" },
    "rangeHelp": { "en": "Up to 30 days", "zh": "最多 30 天" },
    "applyRange": { "en": "Apply", "zh": "应用" },
    "received": { "en": "Incoming mail", "zh": "接收邮件数" },
    "newAddresses": { "en": "Mailboxes created", "zh": "邮箱创建数" },
    "sent": { "en": "Outgoing mail", "zh": "发送邮件数" },
    "newUsers": { "en": "User registrations", "zh": "用户注册数" },
    "chartLabel": { "en": "{title}: {count}", "zh": "{title}：{count}" },
    "loadError": { "en": "Could not load statistics. Try refreshing.", "zh": "统计加载失败，请刷新重试。" },
    "activeAddressCount7days": { "en": "Active mailboxes (7 days)", "zh": "7 天活跃邮箱" },
    "activeAddressCount30days": { "en": "Active mailboxes (30 days)", "zh": "30 天活跃邮箱" },
    "activeUserCount7days": { "en": "Active users (7 days)", "zh": "7 天活跃用户" },
    "activeUserCount30days": { "en": "Active users (30 days)", "zh": "30 天活跃用户" },
    "addressCount": {
      "en": "Total mailboxes",
      "zh": "邮箱总数"
    },
    "mailCount": {
      "en": "Total mail",
      "zh": "邮件总数"
    },
    "sendMailCount": {
      "en": "Total sent",
      "zh": "发件总数"
    },
    "userCount": {
      "en": "Total users",
      "zh": "用户总数"
    }
  },
  "views.admin.SenderAccess": {
    "action": {
      "en": "Action",
      "zh": "操作"
    },
    "address": {
      "en": "Email Address",
      "zh": "邮箱地址"
    },
    "balance": {
      "en": "Balance",
      "zh": "余额"
    },
    "created_at": {
      "en": "Created At",
      "zh": "创建时间"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteTip": {
      "en": "Are you sure to delete this?",
      "zh": "确定删除吗？"
    },
    "disable": {
      "en": "Disable",
      "zh": "禁用"
    },
    "enable": {
      "en": "Enable",
      "zh": "启用"
    },
    "is_enabled": {
      "en": "Is Enabled",
      "zh": "是否启用"
    },
    "itemCount": {
      "en": "itemCount",
      "zh": "总数"
    },
    "modalTip": {
      "en": "Please input the sender balance",
      "zh": "请输入发件额度"
    },
    "modify": {
      "en": "Modify",
      "zh": "修改"
    },
    "ok": {
      "en": "OK",
      "zh": "确定"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    },
    "success": {
      "en": "Success",
      "zh": "成功"
    }
  },
  "views.index.LocalAddress": {
    "loginMethod": {
      "en": "Login Method",
      "zh": "登录方式"
    },
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "address": {
      "en": "Address",
      "zh": "地址"
    },
    "bindAddressSuccess": {
      "en": "Bind Address Success",
      "zh": "绑定地址成功"
    },
    "changeMailAddress": {
      "en": "Change Mail Address",
      "zh": "切换邮箱地址"
    },
    "create_or_bind": {
      "en": "Create or Bind",
      "zh": "创建或绑定"
    },
    "success": {
      "en": "success",
      "zh": "成功"
    },
    "tip": {
      "en": "These addresses are stored in your browser, maybe loss if you clear the browser cache.",
      "zh": "这些地址存储在您的浏览器中，如果您清除浏览器缓存，可能会丢失。"
    },
    "unbindMailAddress": {
      "en": "Unbind Mail Address credential",
      "zh": "解绑邮箱地址"
    }
  },
  "views.admin.DatabaseManager": {
    "code_db_version": {
      "en": "Code Needed DB Version",
      "zh": "需要的数据库版本"
    },
    "current_db_version": {
      "en": "Current DB Version",
      "zh": "当前数据库版本"
    },
    "current_database_size": {
      "en": "Current Database Size",
      "zh": "当前数据库大小"
    },
    "free_plan": {
      "en": "Free",
      "zh": "Free"
    },
    "init": {
      "en": "Initialize Database",
      "zh": "初始化数据库"
    },
    "initializationSuccess": {
      "en": "Database initialized successfully",
      "zh": "数据库初始化成功"
    },
    "migration": {
      "en": "Migrate Database",
      "zh": "升级数据库 Schema"
    },
    "migrationSuccess": {
      "en": "Database migrated successfully",
      "zh": "数据库升级成功"
    },
    "need_initialization_tip": {
      "en": "Database initialization is required. Please initialize the database.",
      "zh": "需要初始化数据库，请初始化数据库"
    },
    "need_migration_tip": {
      "en": "Database migration is required. Please migrate the database.",
      "zh": "需要迁移数据库，请迁移数据库"
    },
    "paid_plan": {
      "en": "Workers Paid",
      "zh": "Workers Paid"
    },
    "plan": {
      "en": "Workers Plan",
      "zh": "Workers 套餐"
    },
    "plan_placeholder": {
      "en": "Select your Cloudflare Workers plan",
      "zh": "请选择 Cloudflare Workers 套餐"
    },
    "planSaved": {
      "en": "Workers plan saved",
      "zh": "Workers 套餐已保存"
    },
    "single_database_limit": {
      "en": "Database Capacity Limit",
      "zh": "数据库容量上限"
    },
    "storage_description": {
      "en": "Compare the current database size with your plan limits.",
      "zh": "将当前数据库大小与套餐容量上限进行对比"
    },
    "storage_tip": {
      "en": "Usage is calculated from the current database size and the selected plan limit.",
      "zh": "使用率按当前数据库大小与所选套餐的数据库容量上限计算。"
    },
    "storage_title": {
      "en": "D1 Storage Capacity",
      "zh": "D1 存储容量"
    },
    "storage_usage": {
      "en": "Capacity Usage",
      "zh": "容量使用率"
    },
    "unavailable": {
      "en": "Unavailable",
      "zh": "暂不可用"
    }
  },
  "views.admin.IpBlacklistSettings": {
    "asn_blacklist": {
      "en": "ASN Organization Blacklist",
      "zh": "ASN 组织（运营商）黑名单"
    },
    "asn_blacklist_placeholder": {
      "en": "Enter ASN organization (e.g., Google, Amazon)",
      "zh": "输入 ASN 组织名称（例如：Google, Amazon）"
    },
    "daily_request_limit": {
      "en": "Daily Request Limit",
      "zh": "每日请求次数上限"
    },
    "daily_request_limit_placeholder": {
      "en": "Enter limit (e.g., 1000)",
      "zh": "输入限制次数（例如：1000）"
    },
    "enable_daily_limit": {
      "en": "Enable Daily Request Limit",
      "zh": "启用每日请求限流"
    },
    "enable_daily_limit_tip": {
      "en": "Limit the number of API requests per IP address per day",
      "zh": "限制每个 IP 地址每天的 API 请求次数"
    },
    "enable_ip_blacklist": {
      "en": "Enable IP Blacklist",
      "zh": "启用 IP 黑名单"
    },
    "enable_ip_whitelist": {
      "en": "Enable IP Whitelist (Strict)",
      "zh": "启用 IP 白名单（严格模式）"
    },
    "enable_tip": {
      "en": "Block IPs matching blacklist patterns from accessing rate-limited APIs",
      "zh": "阻止匹配黑名单的 IP 访问限流 API"
    },
    "enable_whitelist_tip": {
      "en": "Strict mode: ONLY IPs matching the whitelist can access rate-limited APIs. All other IPs will be denied.",
      "zh": "严格模式：仅允许匹配白名单的 IP 访问限流 API，其他所有 IP 将被拒绝"
    },
    "fingerprint_blacklist": {
      "en": "Browser Fingerprint Blacklist",
      "zh": "浏览器指纹黑名单"
    },
    "fingerprint_blacklist_placeholder": {
      "en": "Enter fingerprint ID (e.g., a1b2c3d4e5f6g7h8)",
      "zh": "输入指纹 ID（例如：a1b2c3d4e5f6g7h8）"
    },
    "ip_blacklist": {
      "en": "IP Blacklist Patterns",
      "zh": "IP 黑名单匹配模式"
    },
    "ip_blacklist_placeholder": {
      "en": "Enter pattern (e.g., 192.168.1 or ^10\\.0\\.0\\.5$)",
      "zh": "输入匹配模式（例如：192.168.1 或 ^10\\.0\\.0\\.5$）"
    },
    "ip_whitelist": {
      "en": "IP Whitelist Patterns",
      "zh": "IP 白名单匹配模式"
    },
    "ip_whitelist_placeholder": {
      "en": "Exact IP (e.g., 1.2.3.4) or anchored regex (e.g., ^192\\.168\\.1\\.\\d+$)",
      "zh": "精确 IP(如 1.2.3.4)或锚定正则(如 ^192\\.168\\.1\\.\\d+$)"
    },
    "manualInputPrompt": {
      "en": "Type pattern and press Enter to add",
      "zh": "输入匹配模式后按回车键添加"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "successTip": {
      "en": "Save Success",
      "zh": "保存成功"
    },
    "tip_asn": {
      "en": "ASN Organization: Block by ISP/provider. Case-insensitive text matching or regex.",
      "zh": "ASN 组织：根据运营商/ISP 拉黑。支持不区分大小写的文本匹配或正则表达式。"
    },
    "tip_daily_limit": {
      "en": "Daily Limit: Restrict the maximum number of requests per IP address per day (1-1000000).",
      "zh": "每日限流：限制单个 IP 地址每天最多请求次数（1-1000000）。"
    },
    "tip_fingerprint": {
      "en": "Browser Fingerprint: Block by browser fingerprint. Supports exact matching or regex patterns.",
      "zh": "浏览器指纹：根据浏览器指纹拉黑。支持完全匹配或正则表达式。"
    },
    "tip_ip": {
      "en": "IP Blacklist: Supports text matching (e.g., \"192.168.1\") or regex (e.g., \"^10\\.0\\.0\\.5$\").",
      "zh": "IP 黑名单：支持文本匹配（如 \"192.168.1\"）或正则表达式（如 \"^10\\.0\\.0\\.5$\"）。"
    },
    "tip_scope": {
      "en": "Applies to: Create Address, Send Mail, External Send Mail API, User Registration, Verify Code",
      "zh": "作用范围：创建邮箱地址、发送邮件、外部发送邮件 API、用户注册、验证码验证"
    },
    "tip_whitelist": {
      "en": "IP Whitelist: Strict allowlist — plain entries must be EXACT IP matches (no substring). Use anchored regex (^...$) for ranges. Whitelisted IPs skip blacklist checks.",
      "zh": "IP 白名单: 严格放行名单——纯文本必须是精确 IP(不支持子串匹配), 批量放行请用锚定正则 ^...$. 命中白名单的 IP 将跳过黑名单检查."
    },
    "title": {
      "en": "IP Blacklist Settings",
      "zh": "IP 黑名单设置"
    },
    "whitelist_empty_warning": {
      "en": "IP whitelist is enabled but the list is empty. This is ignored by the server to prevent lockout. Please add at least one entry before enabling.",
      "zh": "IP 白名单已启用但列表为空，服务端将忽略该开关以防止锁死。请先添加至少一条白名单条目再启用。"
    }
  },
  "views.admin.UserAddressManagement": {
    "mail_count": {
      "en": "Mail Count",
      "zh": "邮件数量"
    },
    "emailAddress": {
      "en": "Email Address",
      "zh": "邮箱地址"
    },
    "send_count": {
      "en": "Send Count",
      "zh": "发送数量"
    },
    "success": {
      "en": "success",
      "zh": "成功"
    }
  },
  "views.admin.UserManagement": {
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "address_count": {
      "en": "Mailbox Count",
      "zh": "邮箱数量"
    },
    "changeRole": {
      "en": "Change Role",
      "zh": "更改角色"
    },
    "createUser": {
      "en": "Create User",
      "zh": "创建用户"
    },
    "created_at": {
      "en": "Created At",
      "zh": "创建时间"
    },
    "delete": {
      "en": "Delete",
      "zh": "删除"
    },
    "deleteUser": {
      "en": "Delete User",
      "zh": "删除用户"
    },
    "deleteUserTip": {
      "en": "Are you sure you want to delete this user?",
      "zh": "确定要删除此用户吗？"
    },
    "domains": {
      "en": "Domains",
      "zh": "域名"
    },
    "email": {
      "en": "Account Email",
      "zh": "用户邮箱"
    },
    "itemCount": {
      "en": "itemCount",
      "zh": "总数"
    },
    "password": {
      "en": "Password",
      "zh": "密码"
    },
    "pleaseInput": {
      "en": "Please input complete information",
      "zh": "请输入完整信息"
    },
    "prefix": {
      "en": "Prefix",
      "zh": "前缀"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    },
    "resetPassword": {
      "en": "Reset Password",
      "zh": "重置密码"
    },
    "role": {
      "en": "Role",
      "zh": "角色"
    },
    "roleDonotExist": {
      "en": "Current Role does not exist",
      "zh": "当前角色不存在"
    },
    "success": {
      "en": "Success",
      "zh": "成功"
    },
    "userAddressManagement": {
      "en": "Mailbox Management",
      "zh": "邮箱管理"
    },
    "user_email": {
      "en": "User Email",
      "zh": "用户邮箱"
    }
  },
  "views.admin.Telegram": {
    "enable": {
      "en": "Enable",
      "zh": "启用"
    },
    "enableGlobalMailPush": {
      "en": "Enable Global Mail Push(Manually input telegram Chat ID)",
      "zh": "启用全局邮件推送(手动输入邮箱管理员的 telegram Chat ID, 回车增加)"
    },
    "enableTelegramAllowList": {
      "en": "Enable Telegram Allow List(Manually input Chat ID)",
      "zh": "启用 Telegram 白名单(手动输入 Chat ID, 回车增加)"
    },
    "globalMailPushList": {
      "en": "Global Mail Push Chat ID List",
      "zh": "全局邮件推送 Chat ID 列表"
    },
    "globalMailPushListTip": {
      "en": "Support chat_id of private chat/group/channel. You can send a message to your bot, then visit this link to see chat_id, https://api.telegram.org/bot<Replace with your BOT TOKEN>/getUpdates",
      "zh": "支持对话/群组/频道的 Chat ID, 您可以发送一条消息给您的机器人，然后访问此链接来查看 chat_id, https://api.telegram.org/bot<这里替换成您的 BOT TOKEN>/getUpdates"
    },
    "init": {
      "en": "Init",
      "zh": "初始化"
    },
    "manualInputPrompt": {
      "en": "Type and press Enter to add",
      "zh": "输入后按回车键添加"
    },
    "miniAppUrl": {
      "en": "Telegram Mini App URL",
      "zh": "电报小程序 URL(请输入你部署的电报小程序网页地址)"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "status": {
      "en": "Check Status",
      "zh": "查看状态"
    },
    "successTip": {
      "en": "Success",
      "zh": "成功"
    },
    "telegramAllowList": {
      "en": "Telegram Allow List(Manually input telegram Chat ID)",
      "zh": "Telegram 白名单(手动输入 Chat ID, 回车增加)"
    }
  },
  "views.admin.BatchExportModal": {
    "title": {
      "en": "Export login links",
      "zh": "导出登录链接"
    },
    "spreadsheet": {
      "en": "Spreadsheet-safe CSV (Excel, Google Sheets)",
      "zh": "电子表格安全 CSV（Excel、Google 表格）"
    },
    "spreadsheetTip": {
      "en": "Cells that start with =, +, -, {'@'}, tab or carriage return get a leading ' so spreadsheets keep them as text. Programs reading this file will see the ' as part of the value.",
      "zh": "以 =、+、-、{'@'}、制表符或回车开头的单元格会加上前导 '，使表格软件将其作为文本显示。程序读取此文件时，' 会成为值的一部分。"
    },
    "raw": {
      "en": "Lossless CSV (scripts and programs)",
      "zh": "无损 CSV（脚本和程序）"
    },
    "rawTip": {
      "en": "Standard CSV with the original addresses and login links unchanged. Do not open it in a spreadsheet if an address starts with =, +, - or {'@'}.",
      "zh": "标准 CSV，原样保留地址和登录链接。如果地址以 =、+、- 或 {'@'} 开头，请勿用表格软件打开。"
    },
    "download": {
      "en": "Download CSV",
      "zh": "下载 CSV"
    },
    "close": {
      "en": "Close",
      "zh": "关闭"
    },
    "encryptedExportWarning": {
      "en": "This export contains the private keys needed to read the encrypted mail. The keys exist only in this file and in the results above — store it securely and delete it when done. Anyone with this file can read the mail.",
      "zh": "此导出文件包含阅读加密邮件所需的私钥。这些私钥仅存在于此文件和上方的结果列表中——请妥善保管并在使用后删除。任何持有此文件的人都可以阅读这些邮件。"
    }
  },
  "views.admin.BatchCreate": {
    "randomNameTip": { "en": "Mailbox names are generated randomly.", "zh": "邮箱名称将随机生成。" },
    "batchCount": {
      "en": "Batch count (1–100)",
      "zh": "批量数量（1–100）"
    },
    "createBatch": {
      "en": "Create batch",
      "zh": "批量创建"
    },
    "batchValidation": {
      "en": "Choose a domain and an integer count from 1 to 100. Custom subdomains cannot be empty.",
      "zh": "请选择域名并输入 1–100 的整数数量，自定义子域名不能为空。"
    },
    "batchNameError": {
      "en": "The configured address normalization cannot produce a valid random name.",
      "zh": "配置的地址规范化规则无法生成有效的随机名称。"
    },
    "batchProgress": {
      "en": "Completed: {completed} / {requested}",
      "zh": "已完成：{completed} / {requested}"
    },
    "batchStopped": {
      "en": "Batch stopped. Interrupted requests may have created a mailbox with an unknown outcome. Known successes can still be exported.",
      "zh": "批量创建已停止。中断的请求可能已创建邮箱，结果未知。仍可导出已确认成功的记录。"
    },
    "exportCsv": {
      "en": "Export CSV",
      "zh": "导出 CSV"
    },
    "clearResults": {
      "en": "Clear results",
      "zh": "清空结果"
    },
    "batchTotal": {
      "en": "Saved results: {count}",
      "zh": "已保存结果：{count}"
    },
    "batchSecurity": {
      "en": "Anyone holding these links can access the mailboxes. Private deployments still require site-access credentials. Results stay in memory until you leave this view or clear them.",
      "zh": "任何持有这些链接的人都可访问邮箱。私有部署仍需要站点访问凭据。结果仅保存在内存中，离开此页面或清空后即消失。"
    },
    "encryptBatchCheckbox": {
      "en": "Encrypt received mail end-to-end (a key pair is generated per address in this browser)",
      "zh": "端到端加密收到的邮件（每个地址都会在本浏览器中生成一对密钥）"
    },
    "encryptBatchWarning": {
      "en": "Only the public keys are sent to the server. The private keys exist only in the export you download afterwards — if it is lost, the mail cannot be recovered.",
      "zh": "仅公钥会发送到服务器。私钥只存在于你随后下载的导出文件中——如果丢失，邮件将无法恢复。"
    },
    "batchCsvRawKeysHint": {
      "en": "Note: the exported CSV contains the raw private keys of the encrypted addresses — store it safely.",
      "zh": "注意：导出的 CSV 包含加密地址的原始私钥——请妥善保管。"
    },
  },
  "views.admin.CreateAccount": {
    "creationMode": { "en": "Creation mode", "zh": "创建方式" },
    "singleMode": { "en": "Single creation", "zh": "单个创建" },
    "batchMode": { "en": "Batch creation", "zh": "批量创建" },
    "domain": { "en": "Domain", "zh": "域名" },
    "address": {
      "en": "Email Address",
      "zh": "邮箱地址"
    },
    "addressCredential": {
      "en": "Mail Address Credential",
      "zh": "邮箱地址凭证"
    },
    "addressCredentialTip": {
      "en": "Please copy the Mail Address Credential and you can use it to login to your email account.",
      "zh": "请复制邮箱地址凭证，你可以使用它登录你的邮箱。"
    },
    "addressPassword": {
      "en": "Mailbox Password",
      "zh": "邮箱密码"
    },
    "createEmailAddress": {
      "en": "Create Email Address",
      "zh": "创建邮箱"
    },
    "enableCustomSubdomain": {
      "en": "Use Custom Subdomain",
      "zh": "使用自定义子域名"
    },
    "enablePrefix": {
      "en": "If enable Prefix",
      "zh": "是否启用前缀"
    },
    "enableRandomSubdomain": {
      "en": "Use Random Subdomain",
      "zh": "启用随机子域名"
    },
    "fillInAllFields": {
      "en": "Please fill in all fields",
      "zh": "请填写完整信息"
    },
    "generateName": {
      "en": "Generate Fake Name",
      "zh": "生成随机名字"
    },
    "linkWithAddressCredential": {
      "en": "Open to auto login email link",
      "zh": "打开即可自动登录邮箱的链接"
    },
    "normalSubdomain": {
      "en": "Normal Domain",
      "zh": "普通域名"
    },
    "randomSubdomainTip": {
      "en": "When enabled, the created address will use a random subdomain. Recommended for receiving only. Requires a wildcard MX DNS record on the base domain — see the random subdomain docs.",
      "zh": "启用后，创建出来的地址会自动挂在随机子域名下，建议仅用于收件。需要在基础域名 DNS 中配置通配 MX 记录，详见随机子域名文档。"
    },
    "successTip": {
      "en": "Success Created",
      "zh": "创建成功"
    },
    "encryptMailCheckbox": {
      "en": "Encrypt received mail end-to-end (only the key holder can read it; incompatible with forwarding, webhook, Telegram and AI extraction)",
      "zh": "端到端加密收到的邮件（只有密钥持有者能阅读；与转发、Webhook、Telegram 和 AI 提取不兼容）"
    },
    "encryptMailWarning": {
      "en": "A key pair is generated in this browser and only the public key is sent to the server. The private key is shown once in the result dialog and is not saved on this device — copy it somewhere safe, or the mail cannot be recovered.",
      "zh": "密钥对在本浏览器中生成，仅公钥会发送到服务器。私钥只会在结果弹窗中显示一次，且不会保存到本设备——请立即复制并妥善保存，否则邮件将无法恢复。"
    }
  },
  "views.admin.UserSettings": {
    "emailCheckRegex": {
      "en": "Email Check Regex (e.g. ^[^.]+{'@'}.+$ to disallow dots before {'@'})",
      "zh": "邮箱正则校验 (例如 ^[^.]+{'@'}.+$ 禁止{'@'}前面有.)"
    },
    "enable": {
      "en": "Enable",
      "zh": "启用"
    },
    "enableEmailCheckRegex": {
      "en": "Enable Email Check Regex",
      "zh": "启用邮箱正则校验"
    },
    "enableMailAllowList": {
      "en": "Enable Mail Address Allow List(Manually enterable)",
      "zh": "启用邮件地址白名单(可手动输入, 回车增加)"
    },
    "enableMailVerify": {
      "en": "Enable Mail Verify (Send address must be an address in the system with a balance and can send mail normally)",
      "zh": "启用邮件验证(发送地址必须是系统中能有余额且能正常发送邮件的地址)"
    },
    "enableUserRegister": {
      "en": "Allow User Register",
      "zh": "允许用户注册"
    },
    "mailAllowList": {
      "en": "Mail Address Allow List",
      "zh": "邮件地址白名单"
    },
    "manualInputPrompt": {
      "en": "Type and press Enter to add",
      "zh": "输入后按回车键添加"
    },
    "maxAddressCount": {
      "en": "Maximum number of email addresses that can be binded (0 = Unlimited)",
      "zh": "可绑定最大邮箱地址数量（0 为不限制）"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "successTip": {
      "en": "Save Success",
      "zh": "保存成功"
    },
    "verifyMailSender": {
      "en": "Verify Mail Sender",
      "zh": "验证邮件发送地址"
    }
  },
  "views.admin.RoleAddressConfig": {
    "maxAddressCount": {
      "en": "Max Address Count (0 = Unlimited)",
      "zh": "最大地址数量（0 为不限制）"
    },
    "noRolesAvailable": {
      "en": "No roles available in system config",
      "zh": "系统配置中没有可用的角色"
    },
    "notConfigured": {
      "en": "Not Configured (Use Global Settings)",
      "zh": "未配置（使用全局设置）"
    },
    "role": {
      "en": "Role",
      "zh": "角色"
    },
    "roleConfigDesc": {
      "en": "Configure maximum address count for each user role. Role-based limits take priority over global settings. Set 0 for unlimited.",
      "zh": "为每个用户角色配置最大地址数量。角色配置优先于全局设置。设置为 0 表示不限制。"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "successTip": {
      "en": "Success",
      "zh": "成功"
    }
  },
  "views.common.Appearance": {
    "sectionList": {
      "en": "Mail list",
      "zh": "邮件列表"
    },
    "sectionReading": {
      "en": "Reading",
      "zh": "阅读"
    },
    "sectionLayout": {
      "en": "Layout",
      "zh": "布局"
    },
    "autoLoadRemoteImages": {
      "en": "Automatically load external images in mail body",
      "zh": "自动加载邮件正文中的外部图片"
    },
    "detectVerificationCodes": {
      "en": "Detect verification codes and links in the browser (encrypted mail included)",
      "zh": "在浏览器中识别验证码和链接（含加密邮件）"
    },
    "sectionAlerts": {
      "en": "Alerts & shortcuts",
      "zh": "提醒与快捷键"
    },
    "browserNotifications": {
      "en": "New-mail browser notifications",
      "zh": "新邮件浏览器通知"
    },
    "browserNotificationsHint": {
      "en": "Content-free only: the notification never includes sender or subject. Shown only while this tab is hidden.",
      "zh": "仅提示“有新邮件”，绝不包含发件人或主题；仅在标签页隐藏时显示。"
    },
    "browserNotificationsUnsupported": {
      "en": "This browser does not support notifications.",
      "zh": "此浏览器不支持通知。"
    },
    "browserNotificationsDenied": {
      "en": "Notification permission was denied. Re-enable it in the browser site settings.",
      "zh": "通知权限已被拒绝，请在浏览器网站设置中重新允许。"
    },
    "shortcuts": {
      "en": "Keyboard shortcuts",
      "zh": "键盘快捷键"
    },
    "shortcutsHint": {
      "en": "Press ? in the mailbox to see all shortcuts.",
      "zh": "在收件箱中按 ? 查看全部快捷键。"
    },
    "autoRefreshInterval": {
      "en": "Auto Refresh Interval(Sec)",
      "zh": "自动刷新间隔(秒)"
    },
    "bottom": {
      "en": "bottom",
      "zh": "底部"
    },
    "globalTabplacement": {
      "en": "Global Tab Placement",
      "zh": "全局选项卡位置"
    },
    "left": {
      "en": "left",
      "zh": "左侧"
    },
    "mailboxSplitSize": {
      "en": "Left list width in two-column mailbox view",
      "zh": "邮箱双栏视图左侧列表宽度占比"
    },
    "mailListView": {
      "en": "Full-width mailbox list view",
      "zh": "邮箱全宽列表视图"
    },
    "mailListPreviewLineClamp": {
      "en": "Body Preview Lines",
      "zh": "正文预览行数"
    },
    "off": {
      "en": "Off",
      "zh": "关闭"
    },
    "preferShowTextMail": {
      "en": "Display text Mail by default",
      "zh": "默认以文本显示邮件"
    },
    "right": {
      "en": "right",
      "zh": "右侧"
    },
    "top": {
      "en": "top",
      "zh": "顶部"
    },
    "useIframeShowMail": {
      "en": "Use iframe Show HTML Mail",
      "zh": "使用iframe显示HTML邮件"
    },
    "useSideMargin": {
      "en": "Turn on the side margins on the left and right sides of the page",
      "zh": "开启页面左右两侧侧边距"
    },
    "useSimpleIndex": {
      "en": "Use Simple Index",
      "zh": "使用极简主页"
    },
    "useUTCDate": {
      "en": "Use UTC Date",
      "zh": "使用 UTC 时间"
    }
  },
  "views.admin.AccountSettings": {
    "actions": {
      "en": "Actions",
      "zh": "操作"
    },
    "add": {
      "en": "Add",
      "zh": "添加"
    },
    "address_block_list": {
      "en": "Address Block Keywords for Users(Admin can skip)",
      "zh": "邮件地址屏蔽关键词(管理员可跳过检查)"
    },
    "address_block_list_placeholder": {
      "en": "Please enter the keywords you want to block",
      "zh": "请输入您想要屏蔽的关键词"
    },
    "block_receive_unknow_address_email": {
      "en": "Block receive unknow address email",
      "zh": "禁止接收未知地址邮件"
    },
    "cancel": {
      "en": "Cancel",
      "zh": "取消"
    },
    "config": {
      "en": "Config",
      "zh": "配置"
    },
    "create_address_subdomain_match": {
      "en": "Allow Subdomain Suffix Match When Creating Address",
      "zh": "创建邮箱时允许子域名后缀匹配"
    },
    "create_address_subdomain_match_env_locked": {
      "en": "Worker env ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH is currently false. The saved admin switch can be modified, but it will not take effect until env is enabled or removed.",
      "zh": "当前 Worker 环境变量 ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH 为 false。后台开关仍可保存，但在 env 打开或移除前不会生效。"
    },
    "create_address_subdomain_match_follow_env": {
      "en": "Follow Environment Variable",
      "zh": "跟随环境变量"
    },
    "create_address_subdomain_match_follow_env_note": {
      "en": "Choosing \"Follow Environment Variable\" clears the admin override and returns to the unset state. The effective result is still controlled by the Worker env and the precedence rules.",
      "zh": "选择“跟随环境变量”会清空后台覆盖，恢复为未设置状态；最终是否开启仍由 Worker env 和优先级规则决定。"
    },
    "create_address_subdomain_match_force_disable": {
      "en": "Force Disable",
      "zh": "强制关闭"
    },
    "create_address_subdomain_match_force_enable": {
      "en": "Force Enable",
      "zh": "强制开启"
    },
    "create_address_subdomain_match_note": {
      "en": "RANDOM_SUBDOMAIN_DOMAINS already allows random or manual subdomains for listed base domains. This switch additionally allows API callers to specify subdomains under other allowed base domains.",
      "zh": "RANDOM_SUBDOMAIN_DOMAINS 已允许在所列基础域名下随机生成或手动输入子域名；此开关额外允许 API 在其他已授权基础域名下指定子域名。"
    },
    "create_address_subdomain_match_tip": {
      "en": "Only affects /api/new_address and /admin/new_address domain validation. Example: when enabled, foo.example.com can match configured base domain example.com.",
      "zh": "仅影响 /api/new_address 和 /admin/new_address 的域名校验。例如开启后，foo.example.com 可以匹配已配置的基础域名 example.com。"
    },
    "delete_original": {
      "en": "Delete original after forwarding",
      "zh": "转发成功后删除原邮件"
    },
    "delete_rule": {
      "en": "Delete",
      "zh": "删除"
    },
    "delete_rule_confirm": {
      "en": "Are you sure you want to delete this rule?",
      "zh": "确定要删除这条规则吗？"
    },
    "delete_success": {
      "en": "Delete Success",
      "zh": "删除成功"
    },
    "domain_list": {
      "en": "Domain List (Optional)",
      "zh": "域名列表（可选）"
    },
    "email_forwarding_config": {
      "en": "Email Forwarding Configuration",
      "zh": "邮件转发配置"
    },
    "forward_address": {
      "en": "Forward Address",
      "zh": "转发地址"
    },
    "forward_address_required": {
      "en": "Forward address is required",
      "zh": "转发地址不能为空"
    },
    "forward_placeholder": {
      "en": "forward@example.com",
      "zh": "forward@example.com"
    },
    "forwarding_rule_warning": {
      "en": "Each rule will run independently. Forward address needs to be a verified address.",
      "zh": "每条规则独立运行，转发地址需要为已验证的地址。"
    },
    "fromBlockList": {
      "en": "Block Keywords for receive email",
      "zh": "接收邮件地址屏蔽关键词"
    },
    "manualInputPrompt": {
      "en": "Type and press Enter to add",
      "zh": "输入后按回车键添加"
    },
    "match_all": {
      "en": "All",
      "zh": "全部"
    },
    "match_any": {
      "en": "Any",
      "zh": "任一"
    },
    "noLimitSendAddressList": {
      "en": "No Balance Limit Send Address List",
      "zh": "无余额限制发送地址列表"
    },
    "regex_invalid": {
      "en": "Invalid regex pattern",
      "zh": "无效的正则表达式"
    },
    "regex_too_long": {
      "en": "Regex pattern too long (max 200 characters)",
      "zh": "正则表达式过长（最大200字符）"
    },
    "rule_index": {
      "en": "Rule",
      "zh": "规则"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "select_domain": {
      "en": "Select Domain",
      "zh": "选择域名"
    },
    "send_address_block_list": {
      "en": "Address Block Keywords for send email",
      "zh": "发送邮件地址屏蔽关键词"
    },
    "send_mail_daily_limit": {
      "en": "Daily Limit",
      "zh": "每日额度"
    },
    "send_mail_daily_limit_invalid": {
      "en": "Daily limit must be an integer greater than or equal to -1",
      "zh": "每日额度必须是大于等于 -1 的整数"
    },
    "send_mail_limit": {
      "en": "Send Mail Limit",
      "zh": "发信额度"
    },
    "send_mail_limit_tip": {
      "en": "This applies to all send channels. Use -1 for unlimited and 0 to block sending.",
      "zh": "对全部发信渠道生效。-1 表示无限，0 表示禁止发送。"
    },
    "send_mail_monthly_limit": {
      "en": "Monthly Limit",
      "zh": "每月额度"
    },
    "send_mail_monthly_limit_invalid": {
      "en": "Monthly limit must be an integer greater than or equal to -1",
      "zh": "每月额度必须是大于等于 -1 的整数"
    },
    "source_match_mode": {
      "en": "Match Mode",
      "zh": "匹配模式"
    },
    "source_patterns": {
      "en": "Source Address Regex (Optional)",
      "zh": "来源地址正则（可选）"
    },
    "source_patterns_placeholder": {
      "en": "e.g. gmail.com",
      "zh": "例如: gmail.com"
    },
    "recipient_patterns": {
      "en": "Recipient Address Regex (Optional)",
      "zh": "收件人地址正则（可选）"
    },
    "recipient_patterns_placeholder": {
      "en": "e.g. admin",
      "zh": "例如: admin"
    },
    "source_patterns_tip": {
      "en": "Domain, sender regex and recipient regex filters must all match. Empty filters are ignored. Regex matching is case-insensitive and uses the full envelope address, not the message headers.",
      "zh": "域名、来源正则和收件人正则需同时满足，留空则跳过该条件。正则不区分大小写，匹配完整的信封地址，而非邮件头。"
    },
    "successTip": {
      "en": "Save Success",
      "zh": "保存成功"
    },
    "tip": {
      "en": "You can manually input the following multiple select input and enter",
      "zh": "您可以手动输入以下多选输入框, 回车增加"
    },
    "verified_address_list": {
      "en": "Verified Address List(Can send email by cf internal api)",
      "zh": "已验证地址列表(可通过 cf 内部 api 发送邮件)"
    }
  },
  "views.admin.Mails": {
    "addressQueryTip": {
      "en": "Leave blank to query all addresses",
      "zh": "留空查询所有地址"
    },
    "query": {
      "en": "Query",
      "zh": "查询"
    }
  },
  "views.admin.Maintenance": {
    "addCustomSql": {
      "en": "Add Custom SQL",
      "zh": "添加自定义 SQL"
    },
    "addressCreateLabel": {
      "en": "Cleanup the address created before n days",
      "zh": "清理 n 天前创建的地址"
    },
    "autoCleanup": {
      "en": "Auto cleanup",
      "zh": "自动清理"
    },
    "basicCleanup": {
      "en": "Basic Cleanup",
      "zh": "基础清理"
    },
    "cleanupNow": {
      "en": "Cleanup now",
      "zh": "立即清理"
    },
    "cleanupSuccess": {
      "en": "Cleanup success",
      "zh": "清理成功"
    },
    "cronTip": {
      "en": "Enable cron cleanup, need to configure [crons] in worker, please refer to the document, setting 0 days means clear all",
      "zh": "启用定时清理, 需在 worker 配置 [crons] 参数, 请参考文档, 配置为 0 天表示全部清空"
    },
    "customSqlCleanup": {
      "en": "Custom SQL Cleanup",
      "zh": "自定义 SQL 清理"
    },
    "customSqlTip": {
      "en": "Add custom DELETE SQL statements for scheduled cleanup. Only single DELETE statement is allowed per entry.",
      "zh": "添加自定义 DELETE SQL 语句进行定时清理。每条记录仅允许单条 DELETE 语句。"
    },
    "deleteCustomSql": {
      "en": "Delete",
      "zh": "删除"
    },
    "emptyAddressLabel": {
      "en": "Cleanup the empty address before n days",
      "zh": "清理 n 天前空邮件的邮箱地址"
    },
    "inactiveAddressLabel": {
      "en": "Cleanup the inactive address before n days",
      "zh": "清理 n 天前的未活跃地址"
    },
    "mailBoxLabel": {
      "en": "Cleanup the inbox before n days",
      "zh": "清理 n 天前的收件箱"
    },
    "mailUnknowLabel": {
      "en": "Cleanup the unknow mail before n days",
      "zh": "清理 n 天前的无收件人邮件"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "saveSuccess": {
      "en": "Save success",
      "zh": "保存成功"
    },
    "sendBoxLabel": {
      "en": "Cleanup the sendbox before n days",
      "zh": "清理 n 天前的发件箱"
    },
    "sqlName": {
      "en": "Name",
      "zh": "名称"
    },
    "sqlNamePlaceholder": {
      "en": "e.g. Clean old logs",
      "zh": "例如: 清理旧日志"
    },
    "sqlPlaceholder": {
      "en": "e.g. DELETE FROM raw_mails WHERE source GLOB '*{'@'}example.com' AND created_at < datetime('now', '-3 day')",
      "zh": "例如: DELETE FROM raw_mails WHERE source GLOB '*{'@'}example.com' AND created_at < datetime('now', '-3 day')"
    },
    "sqlStatement": {
      "en": "SQL Statement (DELETE only)",
      "zh": "SQL 语句 (仅限 DELETE)"
    },
    "tip": {
      "en": "Please input the days",
      "zh": "请输入天数"
    },
    "unboundAddressLabel": {
      "en": "Cleanup the unbound address before n days",
      "zh": "清理 n 天前的未绑定用户地址"
    }
  },
  "views.common.Login": {
    "or": {
      "en": "or",
      "zh": "或"
    },
    "autoGeneratedName": {
      "en": "Auto-generated name",
      "zh": "自动生成名称"
    },
    "bindUserAddressError": {
      "en": "Error when bind email address to user",
      "zh": "绑定邮箱地址到用户时错误"
    },
    "bindUserInfo": {
      "en": "Logged in user, login without binding email or create new email address will bind to current user",
      "zh": "已登录用户, 登录未绑定邮箱或创建新邮箱地址将绑定到当前用户"
    },
    "credential": {
      "en": "Email Address Credential",
      "zh": "邮箱地址凭据"
    },
    "credentialInput": {
      "en": "Please input the Mail Address Credential",
      "zh": "请输入邮箱地址凭据"
    },
    "credentialLogin": {
      "en": "Credential Login",
      "zh": "凭据登录"
    },
    "email": {
      "en": "Email Address",
      "zh": "邮箱地址"
    },
    "emailPasswordRequired": {
      "en": "Email address and mailbox password are required",
      "zh": "邮箱地址和邮箱密码不能为空"
    },
    "enableRandomSubdomain": {
      "en": "Use Random Subdomain",
      "zh": "启用随机子域名"
    },
    "enableCustomSubdomain": {
      "en": "Use Custom Subdomain",
      "zh": "使用自定义子域名"
    },
    "generateName": {
      "en": "Generate Fake Name",
      "zh": "生成随机名字"
    },
    "getNewEmail": {
      "en": "Create Email Address",
      "zh": "创建邮箱"
    },
    "useRedeemCode": {
      "en": "Use Redemption Code",
      "zh": "使用兑换码"
    },
    "redeemEntryTip": {
      "en": "Use a redemption code to unlock advanced access.",
      "zh": "使用兑换码可解锁高级权限"
    },
    "normalSubdomain": {
      "en": "Normal Domain",
      "zh": "普通域名"
    },
    "getNewEmailTip1": {
      "en": "Please input the email you want to use. only allow: ",
      "zh": "请输入你想要使用的邮箱地址, 只允许: "
    },
    "getNewEmailTip2": {
      "en": "Levaing it blank will generate a random email address.",
      "zh": "留空将会生成一个随机的邮箱地址。"
    },
    "getNewEmailTip3": {
      "en": "You can choose a domain from the dropdown list.",
      "zh": "你可以从下拉列表中选择一个域名。"
    },
    "help": {
      "en": "Help",
      "zh": "帮助"
    },
    "login": {
      "en": "Log In to Mailbox",
      "zh": "登录邮箱"
    },
    "loginAndBind": {
      "en": "Login and Bind",
      "zh": "登录并绑定"
    },
    "ok": {
      "en": "OK",
      "zh": "确定"
    },
    "password": {
      "en": "Mailbox Password",
      "zh": "邮箱密码"
    },
    "passwordLogin": {
      "en": "Password Login",
      "zh": "密码登录"
    },
    "helpTitle": {
      "en": "How it works",
      "zh": "如何使用"
    },
    "helpStep1Lead": {
      "en": "Get an address.",
      "zh": "获取地址。"
    },
    "helpStep1": {
      "en": "Open the \"{tab}\" tab, pick a name or generate one, and create it. Mail sent to that address shows up here within seconds.",
      "zh": "打开「{tab}」标签页，输入一个名称或随机生成，然后创建。发送到该地址的邮件会在几秒内显示在这里。"
    },
    "helpStep2Lead": {
      "en": "Save your credential.",
      "zh": "保存好你的凭据。"
    },
    "helpStep2": {
      "en": "You get a credential when the address is created. It's the only way back into this mailbox from another browser or after clearing site data, so keep it somewhere safe.",
      "zh": "地址创建成功后会得到一个凭据，它是从其他浏览器或清除网站数据后重新进入该邮箱的唯一途径，请妥善保管。"
    },
    "helpStep3Lead": {
      "en": "Already have one?",
      "zh": "已有邮箱？"
    },
    "helpStep3": {
      "en": "Paste your credential in the \"{tab}\" tab, or sign in to an account to see all your saved addresses.",
      "zh": "在「{tab}」标签页粘贴你的凭据，或登录账号查看所有已保存的地址。"
    },
    "helpEncryptedLead": {
      "en": "Encrypted mailboxes.",
      "zh": "加密邮箱。"
    },
    "helpEncrypted": {
      "en": "Encrypted mail can only be read with the private key stored in this browser. Save the decryption link or a protected backup when you create the mailbox: without it, nobody can recover your mail.",
      "zh": "加密邮件只能用存储在本浏览器中的私钥阅读。创建邮箱时请保存解密链接或受保护的备份：没有它，任何人都无法恢复你的邮件。"
    },
    "helpFooterBefore": {
      "en": "See",
      "zh": "加密能保护什么、不能保护什么，请见"
    },
    "helpFooterAfter": {
      "en": "for what encryption does and doesn't protect.",
      "zh": "。"
    },
    "randomSubdomainTip": {
      "en": "When enabled, the created address will use a random subdomain. Recommended for receiving only. Requires a wildcard MX DNS record on the base domain — see the random subdomain docs.",
      "zh": "启用后，创建出来的地址会自动挂在随机子域名下，建议仅用于收件。需要在基础域名 DNS 中配置通配 MX 记录，详见随机子域名文档。"
    },
    "encryptMailCheckbox": {
      "en": "Encrypt received mail end-to-end (only you can read it; incompatible with forwarding, webhook, Telegram and AI extraction)",
      "zh": "端到端加密收到的邮件（只有你能阅读；与转发、Webhook、Telegram 和 AI 提取不兼容）"
    },
    "encryptMailWarning": {
      "en": "The private key is generated in your browser and never sent to the server. If you lose it, encrypted mail cannot be recovered by anyone.",
      "zh": "私钥在浏览器中生成，绝不会发送到服务器。如果丢失私钥，加密邮件将无法被任何人恢复。"
    },
    "encryptionCreatedTitle": {
      "en": "End-to-End Encryption Enabled",
      "zh": "已启用端到端加密"
    },
    "encryptionCreatedTip": {
      "en": "Save the decryption link below somewhere safe. Opening it on another device imports the decryption key there. Anyone with this link can read your encrypted mail.",
      "zh": "请妥善保存下面的解密链接，在其他设备上打开该链接即可导入解密密钥。任何获得此链接的人都可以阅读你的加密邮件。"
    },
    "encryptMailKeyLostWarning": {
      "en": "Warning: if you lose the private key, encrypted mail becomes unrecoverable. The server cannot decrypt it for you.",
      "zh": "警告：如果丢失私钥，加密邮件将无法恢复，服务器也无法替你解密。"
    },
    "copyDecryptionLink": {
      "en": "Copy Decryption Link",
      "zh": "复制解密链接"
    },
    "copyDecryptionLinkSuccess": {
      "en": "Decryption link copied",
      "zh": "解密链接已复制"
    },
    "copyDecryptionLinkFailed": {
      "en": "Copy failed",
      "zh": "复制失败"
    },
    "keyStoreMemoryWarning": {
      "en": "Browser protected storage (IndexedDB) is unavailable: decryption keys are kept only for this session and will be lost when this tab closes. Save your backup or decryption link now.",
      "zh": "浏览器受保护存储（IndexedDB）不可用：解密密钥仅保留到本次会话结束，关闭标签页后将丢失。请立即保存备份或解密链接。"
    }
  },
  "views.Redeem": {
    "address": {
      "en": "Email address",
      "zh": "邮箱地址"
    },
    "addressCredential": {
      "en": "Mailbox access credential",
      "zh": "邮箱访问凭证"
    },
    "addressPassword": {
      "en": "Address password",
      "zh": "邮箱密码"
    },
    "addressSuccess": {
      "en": "Redemption complete. Keep the mailbox credentials below secure.",
      "zh": "兑换成功，请妥善保存以下邮箱凭证。"
    },
    "autoName": {
      "en": "Generated automatically",
      "zh": "自动生成"
    },
    "back": {
      "en": "Back to mailbox",
      "zh": "返回邮箱"
    },
    "balanceDescription": {
      "en": "Redeem {amount} sending credits for a mailbox.",
      "zh": "为指定邮箱兑换 {amount} 次发信额度。"
    },
    "balanceSuccess": {
      "en": "Added {amount} sending credits to {address}.",
      "zh": "已为 {address} 增加 {amount} 次发信额度。"
    },
    "balanceTitle": {
      "en": "Sending credits",
      "zh": "发信额度"
    },
    "checkCode": {
      "en": "Look up code",
      "zh": "查询兑换码"
    },
    "codeLabel": {
      "en": "Redemption code",
      "zh": "兑换码"
    },
    "codePlaceholder": {
      "en": "Enter your code",
      "zh": "输入你的兑换码"
    },
    "categoryTitle": {
      "en": "Available benefits",
      "zh": "可兑换权益"
    },
    "confirmBalance": {
      "en": "Confirm redemption",
      "zh": "确认兑换"
    },
    "confirmRole": {
      "en": "Confirm redemption",
      "zh": "确认兑换"
    },
    "createAddress": {
      "en": "Redeem mailbox",
      "zh": "兑换邮箱地址"
    },
    "customSubdomain": {
      "en": "Custom subdomain",
      "zh": "自定义子域名"
    },
    "expired": {
      "en": "Expired",
      "zh": "已过期"
    },
    "getCode": {
      "en": "Get a redemption code",
      "zh": "获取兑换码"
    },
    "noPrefixDescription": {
      "en": "Redeem one mailbox without a prefix.",
      "zh": "可兑换 1 个无前缀邮箱地址。"
    },
    "normalDomain": {
      "en": "Normal domain",
      "zh": "普通域名"
    },
    "openAddress": {
      "en": "Open mailbox",
      "zh": "打开邮箱"
    },
    "prefixDescription": {
      "en": "Redeem one mailbox beginning with {prefix}.",
      "zh": "可兑换 1 个以 {prefix} 开头的邮箱地址。"
    },
    "prefixTitle": {
      "en": "Custom mailbox",
      "zh": "专属邮箱"
    },
    "randomName": {
      "en": "Generate name",
      "zh": "随机生成"
    },
    "randomSubdomain": {
      "en": "Random subdomain",
      "zh": "随机子域名"
    },
    "redeemAnother": {
      "en": "Redeem another code",
      "zh": "继续兑换"
    },
    "redeemed": {
      "en": "Used",
      "zh": "已使用"
    },
    "redeemNow": {
      "en": "Redeem now",
      "zh": "立即兑换"
    },
    "roleDescription": {
      "en": "Grant the {role} benefits to a specified account.",
      "zh": "为指定账号开通 {role} 角色权益。"
    },
    "roleSuccess": {
      "en": "The {role} benefits are now active for {email}.",
      "zh": "已为 {email} 开通 {role} 角色权益。"
    },
    "roleTitle": {
      "en": "Role benefits",
      "zh": "角色权益"
    },
    "targetAddress": {
      "en": "Target email address",
      "zh": "目标邮箱地址"
    },
    "unused": {
      "en": "Unused",
      "zh": "未使用"
    },
    "success": {
      "en": "Redemption complete",
      "zh": "兑换成功"
    },
    "title": {
      "en": "Redeem benefits",
      "zh": "兑换权益"
    },
    "userEmail": {
      "en": "Recipient account",
      "zh": "接收账号"
    },
    "viewResult": {
      "en": "View redemption result",
      "zh": "查看兑换结果"
    },
    "userEmailPlaceholder": {
      "en": "Enter the account email",
      "zh": "请输入账号邮箱"
    }
  },
  "views.admin.Webhook": {
    "enableAllowList": {
      "en": "Enable Allow List (Restrict webhook access to specific users)",
      "zh": "启用白名单 (限制 webhook 访问权限，只有白名单中的用户可以使用)"
    },
    "manualInputPrompt": {
      "en": "Type and press Enter to add",
      "zh": "输入后按回车键添加"
    },
    "notEnabled": {
      "en": "Webhook is not enabled",
      "zh": "Webhook 未开启"
    },
    "save": {
      "en": "Save",
      "zh": "保存"
    },
    "successTip": {
      "en": "Success",
      "zh": "成功"
    },
    "webhookAllowList": {
      "en": "Webhook Allow List(Enter the mail address that is allowed to use webhook and enter)",
      "zh": "Webhook 白名单(请输入允许使用webhook 的邮箱地址, 回车增加)"
    }
  },
  "views.common.AdminContact": {
    "adminContact": {
      "en": "If you need help, please contact the administrator ({msg})",
      "zh": "如果你需要帮助，请联系管理员 ({msg})"
    }
  },
  "utils.retentionText": {
    "mails": {
      "en": "Mail is deleted automatically after {days} day. | Mail is deleted automatically after {days} days.",
      "zh": "邮件会在 {days} 天后被自动删除。 | 邮件会在 {days} 天后被自动删除。"
    },
    "sendbox": {
      "en": "Sent mail is kept for {days} day. | Sent mail is kept for {days} days.",
      "zh": "已发送的邮件保留 {days} 天。 | 已发送的邮件保留 {days} 天。"
    },
    "inactiveAddresses": {
      "en": "Addresses unused for {days} day are removed. | Addresses unused for {days} days are removed.",
      "zh": "超过 {days} 天未使用的地址会被移除。 | 超过 {days} 天未使用的地址会被移除。"
    },
    "addresses": {
      "en": "Addresses are removed {days} day after creation. | Addresses are removed {days} days after creation.",
      "zh": "地址创建 {days} 天后会被移除。 | 地址创建 {days} 天后会被移除。"
    },
    "unboundAddresses": {
      "en": "Addresses not linked to an account are removed after {days} day. | Addresses not linked to an account are removed after {days} days.",
      "zh": "未绑定账号的地址会在 {days} 天后被移除。 | 未绑定账号的地址会在 {days} 天后被移除。"
    }
  },
  "views.common.About": {
    "encryptionTitle": {
      "en": "Encrypted mailboxes",
      "zh": "加密邮箱"
    },
    "encryptionSubtitle": {
      "en": "Optional encryption, set separately for each mailbox, for mail while it's stored.",
      "zh": "可选的加密功能，可为每个邮箱单独设置，用于保护邮件在服务器上存储期间的安全。"
    },
    "pillOptional": {
      "en": "Optional",
      "zh": "可选"
    },
    "pillPerMailbox": {
      "en": "Per mailbox",
      "zh": "每个邮箱单独设置"
    },
    "pillNotAudited": {
      "en": "Not audited",
      "zh": "未经独立安全审计"
    },
    "doesTitle": {
      "en": "What it does",
      "zh": "它能做什么"
    },
    "does1Lead": {
      "en": "Your browser makes the key.",
      "zh": "密钥由你的浏览器生成。"
    },
    "does1": {
      "en": "Turning on encryption creates a key pair in your browser. Only the public key is sent to our server.",
      "zh": "开启加密时，会在你的浏览器中生成一对密钥，只有公钥会发送到我们的服务器。"
    },
    "does2Lead": {
      "en": "Mail is encrypted before it's saved.",
      "zh": "邮件在保存前完成加密。"
    },
    "does2": {
      "en": "Every email that arrives is encrypted with that public key before storage, including the sender, subject, body and attachments. Mail you send from the mailbox is saved encrypted too.",
      "zh": "每封收到的邮件在存储前都会使用该公钥加密，包括发件人、主题、正文和附件。从该邮箱发送的邮件也会被加密保存。"
    },
    "does3Lead": {
      "en": "Only you can read it.",
      "zh": "只有你能阅读。"
    },
    "does3": {
      "en": "Your browser holds the private key and decrypts mail on your device. Our server can't read what it has stored.",
      "zh": "私钥由你的浏览器持有，并在你的设备上解密邮件。我们的服务器无法读取它存储的内容。"
    },
    "doesntTitle": {
      "en": "What it doesn't do",
      "zh": "它不能做什么"
    },
    "doesnt1Lead": {
      "en": "It's not end-to-end from the sender.",
      "zh": "对发件人而言并非端到端加密。"
    },
    "doesnt1": {
      "en": "Email travels over the normal email system, so the sender's provider and Cloudflare's email routing handle it unencrypted, and our worker sees each message briefly before encrypting it. This protects mail at rest, not in transit.",
      "zh": "邮件通过普通的电子邮件系统传输，因此发件人的服务商和 Cloudflare 的邮件路由会以未加密方式处理邮件，我们的 Worker 会在加密前短暂接触到每封邮件。这保护的是邮件存储状态的安全，而非传输过程。"
    },
    "doesnt2Lead": {
      "en": "You're trusting the code this site sends you.",
      "zh": "你需要信任本网站发给你的代码。"
    },
    "doesnt2": {
      "en": "A compromised or dishonest server could read new mail as it arrives, or send your browser code that grabs your key. This protects against a leaked or seized database, not against us.",
      "zh": "被入侵或不诚实的服务器可以在新邮件到达时读取它，或向你的浏览器发送窃取密钥的代码。这防的是数据库泄露或被查封，而不是防我们。"
    },
    "doesnt3Lead": {
      "en": "Some information is still visible to the server.",
      "zh": "部分信息对服务器仍然可见。"
    },
    "doesnt3": {
      "en": "Your address, when each email arrived, its size and whether you've read it. Mail you send is delivered to the recipient as normal, unencrypted email.",
      "zh": "你的地址、每封邮件的到达时间、大小以及你是否已读。你发送的邮件会以普通的未加密邮件形式送达收件人。"
    },
    "doesnt4Lead": {
      "en": "Some features are switched off.",
      "zh": "部分功能会被关闭。"
    },
    "doesnt4": {
      "en": "Forwarding, AI code and link extraction, and Telegram or webhook previews. You get a \"new encrypted mail\" notice with no content instead.",
      "zh": "转发、AI 验证码和链接提取，以及 Telegram 或 Webhook 预览。你只会收到一条不含内容的“收到新的加密邮件”通知。"
    },
    "keyTitle": {
      "en": "Your key is your responsibility",
      "zh": "密钥由你自己负责"
    },
    "key1Lead": {
      "en": "If you lose the key, the mail is gone.",
      "zh": "丢失密钥，邮件即无法找回。"
    },
    "key1": {
      "en": "We can't recover it, and there's no backdoor. Clearing browser data deletes the key unless you saved a backup.",
      "zh": "我们无法恢复，也没有后门。清除浏览器数据会删除密钥，除非你保存了备份。"
    },
    "key2Lead": {
      "en": "The plain decryption link is shown once.",
      "zh": "明文解密链接只显示一次。"
    },
    "key2": {
      "en": "Save it when you create the mailbox, or create a backup protected by a passphrase or (with an account) a passkey.",
      "zh": "请在创建邮箱时保存它，或创建受密码保护的备份，（登录账号后）也可以使用通行密钥。"
    },
    "key3Lead": {
      "en": "Treat links and backups like passwords.",
      "zh": "请像对待密码一样对待链接和备份。"
    },
    "key3": {
      "en": "Anyone with your decryption link, or a backup plus its passphrase, can read your mail.",
      "zh": "任何获得你的解密链接、或备份及其密码的人，都能阅读你的邮件。"
    },
    "key4Lead": {
      "en": "Encryption is one-way for stored mail.",
      "zh": "对已存储的邮件，加密是单向的。"
    },
    "key4": {
      "en": "Turning on encryption, or using \"encrypt existing mail\", can't be undone for that mail.",
      "zh": "开启加密或使用“加密现有邮件”后，对应邮件的加密无法撤销。"
    },
    "encryptionFinePrint": {
      "en": "Uses standard browser cryptography (P-256 ECDH, AES-256-GCM). It has not been independently audited. Mailboxes without encryption work exactly as before.",
      "zh": "使用标准浏览器密码学（P-256 ECDH、AES-256-GCM），未经独立安全审计。未加密的邮箱与之前完全一样。"
    },
    "retentionTitle": {
      "en": "Data retention",
      "zh": "数据保留"
    },
    "retentionLead": {
      "en": "Mail deletes itself.",
      "zh": "邮件会自动删除。"
    },
    "retentionDeleted": {
      "en": "Deleted mail can't be recovered. Encrypted mail is deleted the same way.",
      "zh": "已删除的邮件无法恢复，加密邮件也以同样方式删除。"
    },
    "upstreamCreditPrefix": {
      "en": "decrypts is built on ",
      "zh": "decrypts 基于 "
    },
    "upstreamCreditSuffix": {
      "en": " by Dream Hunter (MIT).",
      "zh": " 构建，作者为 Dream Hunter（MIT 协议）。"
    }
  }
} as const

type MessageRegistry = typeof MESSAGE_REGISTRY

export type MessageNamespace = keyof MessageRegistry
export type MessageKey<N extends MessageNamespace> = keyof MessageRegistry[N]

export const getMessageSource = <N extends MessageNamespace>(
  namespace: N,
  key: MessageKey<N>,
  locale: 'en' | 'zh',
) => {
  return MESSAGE_REGISTRY[namespace]?.[key]?.[locale]
}
