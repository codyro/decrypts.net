# Change: Cleaner, simpler frontend UI

Status: design spec, ready for implementation
Scope: `frontend/` only (Vue 3 + Naive UI 2.45). No worker, API, route or store-key changes.

## Outcome

The app keeps every feature, but each screen has less chrome and one obvious
thing to do:

- **Landing:** log in or create an address. One centred panel.
- **Mailbox:** see your address, copy it, read mail. The address is the hero,
  the inbox is a calm two-pane reader, and settings are grouped in one place.
- **User center / Admin:** the same visual language, lighter navigation.

The look is a neutral, mostly white (or near-black) surface with hairline
borders instead of grey "embedded" cards. There is one blue accent, a single
spacing scale, and a single type scale. Rarely used controls (appearance
preferences, About, GitHub/Status links, Simple Mode, Auto Reply, S3
attachments) move into a drawer, the footer, overflow menus or collapsible
sections. None of them are deleted.

## Design principles (apply to every screen)

1. **One primary button per view.** It is the only solid accent button on the
   screen. Everything else is `secondary`, `tertiary`, `quaternary` or `text`.
2. **No card-in-card.** A page is a flat surface. Group content with a
   `.panel` (hairline border, 12px radius) or with whitespace and a section
   title. Use `n-card embedded` only where admin views already use it.
3. **Line tabs, not card tabs.** Primary navigation inside a page uses
   `n-tabs type="line"`. Sub-navigation uses `type="bar" size="small"`.
4. **Text before tags.** Replace clusters of blue `n-tag`s (ID / date / FROM /
   TO) with muted text rows (`13px`, `--app-text-3`).
5. **Progressive disclosure.** Rare actions go into an overflow menu, the
   Preferences drawer, a collapse or the footer.
6. **Mobile first-class.** At widths under 768px, one column, 16px gutters,
   44px touch targets, and no horizontal page scroll down to a 320px width.
7. **Both themes are designed.** Every colour is a token with a light and a
   dark value. No hard-coded `#18a058` and similar values.

## Hard constraints

- **No feature removed or unreachable.** Section 6 maps every moved control.
- **Do not change** API calls, request payloads, route paths/aliases,
  `useStorage`/`useLocalStorage`/`useSessionStorage` keys, or the meaning of
  existing i18n keys. New i18n keys are allowed and must exist in **both `en`
  and `zh`** in `frontend/src/i18n/message-registry.ts`. Also add `de`, `es`,
  `ja` and `pt-BR` strings in `frontend/src/i18n/locales/source/*.ts`. This is
  recommended, because missing keys fall back to `FALLBACK_LOCALE`.
- **Valid tab values stay valid.** `indexTab`, `userTab` and `adminTab`
  (sessionStorage) still use the same string values. Values for removed tabs
  are redirected (see sections 3.3, 4 and 5).
- **Keep every e2e hook in section 8.**
- **Do not touch `frontend/index.html`.** It has an uncommitted local change.
  Do not commit `frontend/auto-imports.d.ts`.
- **No new runtime dependencies** and no web-font downloads. Use the system
  font stack below. Icons come only from the already-installed `@vicons/material`
  and `@vicons/fa`. These icon names are verified to exist in
  `@vicons/material`: `TuneRound`, `MoreVertRound`, `MoreHorizRound`,
  `ContentCopyRound`, `RefreshRound`, `SettingsOutlined`, `DarkModeOutlined`,
  `LightModeOutlined`, `MenuRound`, `SearchRound`, `SwapHorizRound`,
  `InboxRound`, `SendRound`, `LanguageRound`, `LogoutRound`,
  `DeleteOutlineRound`, `KeyRound`, `PersonOutlineRound`, `ChevronLeftRound`,
  `ChevronRightRound`, `AddRound`.

---

## 1. Design tokens

### 1.1 Colour tokens

These go in `frontend/src/theme/tokens.ts`, which is the single source of truth.
App.vue feeds them to Naive `themeOverrides` and writes them to CSS custom
properties on `<html>` (section 1.4). Writing to `<html>` means teleported
drawers and modals can use them too.

| Token (TS key → CSS var) | Light | Dark | Use |
|---|---|---|---|
| `bg` → `--app-bg` | `#FFFFFF` | `#101014` | page background, header |
| `surface` → `--app-surface` | `#FFFFFF` | `#18181C` | panels, cards, drawers |
| `surfaceSubtle` → `--app-surface-subtle` | `#F7F7F9` | `#1E1E23` | table header, embedded cards, code, hover-free fills |
| `surfaceRaised` → `--app-surface-raised` | `#FFFFFF` | `#232329` | modals |
| `popover` → `--app-popover` | `#FFFFFF` | `#2A2A30` | popovers, dropdowns |
| `border` → `--app-border` | `#E4E4E7` | `rgba(255, 255, 255, 0.12)` | panel/input borders |
| `divider` → `--app-divider` | `#EFEFF2` | `rgba(255, 255, 255, 0.07)` | list/section dividers |
| `text1` → `--app-text-1` | `rgb(31, 34, 37)` | `rgba(255, 255, 255, 0.9)` | headings, primary text |
| `text2` → `--app-text-2` | `rgb(51, 54, 57)` | `rgba(255, 255, 255, 0.82)` | body text |
| `text3` → `--app-text-3` | `#6B7280` | `rgba(255, 255, 255, 0.52)` | meta, captions, inactive tabs |
| `accent` → `--app-accent` | `#2563EB` | `#60A5FA` | the one accent |
| `accentHover` → `--app-accent-hover` | `#3B82F6` | `#93C5FD` | |
| `accentPressed` → `--app-accent-pressed` | `#1D4ED8` | `#3B82F6` | |
| `accentSoft` → `--app-accent-soft` | `rgba(37, 99, 235, 0.08)` | `rgba(96, 165, 250, 0.14)` | active nav item background, avatar circle |
| `accentSoftHover` → `--app-accent-soft-hover` | `rgba(37, 99, 235, 0.12)` | `rgba(96, 165, 250, 0.20)` | |
| `danger` → `--app-danger` | `#D03050` | `#E88080` | Naive defaults; danger-zone titles only |
| `dangerSoft` → `--app-danger-soft` | `rgba(208, 48, 80, 0.06)` | `rgba(232, 128, 128, 0.10)` | danger-zone panel background |
| `shadowRaised` → `--app-shadow-raised` | `0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.08)` | `0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.4)` | sticky header on scroll (optional), popovers |

Checked contrast ratios (WCAG):

| Pair | Ratio |
|---|---|
| Accent `#2563EB` on white | 5.17 |
| White text on accent | 5.17 |
| Pressed `#1D4ED8` on white | 6.70 |
| Pressed `#1D4ED8` on the quaternary hover fill | 5.70 |
| Light `text3` on white | 4.83 |
| Dark accent on `#101014` | 7.47 |
| Dark accent on `#18181C` | 6.96 |
| Black on dark accent | 7.47 |

Success (`#18a058` / `#63e2b7`) and warning stay at Naive defaults. Use them only
for status tags and alerts, never for decoration.

### 1.2 Spacing, radius, type, layout

Write these to `:root` in `frontend/src/styles/base.css`. They are static and
do not change with the theme.

```css
:root {
  /* spacing (4px base) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px; --space-12: 48px;
  /* radius */
  --radius-sm: 6px; --radius-md: 8px; --radius-lg: 12px; --radius-pill: 999px;
  /* type */
  --font-xs: 12px;  /* captions, footer, field labels in meta rows   (lh 18px) */
  --font-sm: 13px;  /* meta, helper text, tips                       (lh 20px) */
  --font-md: 14px;  /* body, inputs, buttons                         (lh 22px) */
  --font-lg: 16px;  /* panel titles, drawer/modal titles             (lh 24px) */
  --font-xl: 18px;  /* section titles (h2), mail subject in reader   (lh 26px) */
  --font-2xl: 24px; /* landing title (h1)                            (lh 32px) */
  --weight-regular: 400; --weight-medium: 500; --weight-semibold: 600;
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  /* layout */
  --header-height: 56px;
  --app-max-width: 1280px;   /* mailbox, admin; removed when useSideMargin=false */
  --content-form: 720px;     /* settings pages, user settings */
  --content-auth: 480px;     /* landing / login panels */
  --gutter: 24px;            /* >= 768px */
}
@media (max-width: 767.98px) { :root { --gutter: 16px; } }
```

Breakpoint: **mobile is under 768px**. This matches `useIsMobile()` in
`src/utils/composables.js`. Keep using that composable and do not add new
breakpoints. Below 360px, only overflow fixes are allowed.

### 1.3 Naive UI `themeOverrides`

New file: `frontend/src/theme/index.ts`.

```ts
import type { GlobalThemeOverrides } from 'naive-ui'
import { lightTokens, darkTokens, type AppTokens } from './tokens'

export const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, ' +
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif, ' +
  '"Apple Color Emoji", "Segoe UI Emoji"'
export const FONT_FAMILY_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'

export const buildThemeOverrides = (t: AppTokens, isDark: boolean): GlobalThemeOverrides => ({
  common: {
    fontFamily: FONT_FAMILY,
    fontFamilyMono: FONT_FAMILY_MONO,
    fontWeightStrong: '600',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    heightMedium: '36px',
    heightLarge: '42px',

    primaryColor: t.accent,
    primaryColorHover: t.accentHover,
    primaryColorPressed: t.accentPressed,
    primaryColorSuppl: t.accentHover,
    // info === primary: one accent. MailContentRenderer's Reply button uses
    // infoColorPressed (light) / infoColor (dark); both pass 4.5:1.
    infoColor: t.accent,
    infoColorHover: t.accentHover,
    infoColorPressed: t.accentPressed,
    infoColorSuppl: t.accentHover,

    bodyColor: t.bg,
    cardColor: t.surface,
    tableColor: t.surface,
    modalColor: t.surfaceRaised,
    popoverColor: t.popover,
    borderColor: t.border,
    dividerColor: t.divider,
    // Only light textColor3 is overridden (better contrast). DO NOT override
    // textColor1/textColor2, hoverColor or buttonColor2* in either theme:
    // e2e tests pin their exact default values (section 1.5).
    ...(isDark ? {} : { textColor3: t.text3 }),
  },
  Card: {
    borderRadius: '12px',
    paddingSmall: '12px 16px',
    paddingMedium: '20px 24px',
    titleFontSizeMedium: '16px',
    titleFontWeight: '600',
    colorEmbedded: t.surfaceSubtle,
    borderColor: t.border,
  },
  Tabs: {
    tabFontSizeMedium: '14px',
    tabFontWeight: '400',
    tabFontWeightActive: '600',
    tabGapMediumLine: '24px',
    tabPaddingMediumLine: '12px 2px',
    tabGapSmallBar: '20px',
    tabPaddingSmallBar: '8px 2px',
    tabTextColorLine: t.text3,
    tabTextColorHoverLine: t.text1,
    tabTextColorActiveLine: t.text1,
    tabTextColorBar: t.text3,
    tabTextColorHoverBar: t.text1,
    tabTextColorActiveBar: t.text1,
    barColor: t.accent,
    colorSegment: t.surfaceSubtle,
    tabColorSegment: isDark ? t.surfaceRaised : t.surface,
    tabTextColorSegment: t.text3,
    tabTextColorHoverSegment: t.text1,
    tabTextColorActiveSegment: t.text1,
    tabBorderRadius: '8px',
    panePaddingSmall: '16px 0 0 0',
    panePaddingMedium: '20px 0 0 0',
  },
  Drawer: {
    color: t.surface,
    headerPadding: '16px 20px',
    bodyPadding: '16px 20px',
    footerPadding: '12px 20px',
    titleFontSize: '16px',
    titleFontWeight: '600',
  },
  Dialog: {
    borderRadius: '12px',
    padding: '20px 24px',
    titleFontSize: '16px',
    titleFontWeight: '600',
  },
  Alert: { borderRadius: '8px', padding: '12px 16px' },
  DataTable: {
    borderRadius: '8px',
    thColor: t.surfaceSubtle,
    thFontWeight: '600',
    thPaddingMedium: '10px 12px',
    tdPaddingMedium: '10px 12px',
  },
  Tag: { borderRadius: '6px' },
  Collapse: { titleFontSize: '15px', titleFontWeight: '600' },
})

export const tokensFor = (isDark: boolean) => (isDark ? darkTokens : lightTokens)

/** camelCase token key -> --app-kebab-case */
export const toCssVars = (t: AppTokens) =>
  Object.fromEntries(Object.entries(t).map(([k, v]) =>
    [`--app-${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}`, v]))
```

`frontend/src/theme/tokens.ts` exports `lightTokens` and
`darkTokens: AppTokens` with the exact values in the 1.1 table, using the TS
keys shown there. It also exports `type AppTokens = typeof lightTokens`.

Do **not** override any Button, List, Input or Menu variables. The defaults
plus `common` give the right result, and several Button values are pinned by
tests.

### 1.4 Wiring and global CSS

**`frontend/src/App.vue`:**

```js
const tokens = computed(() => tokensFor(isDark.value))
const themeOverrides = computed(() => buildThemeOverrides(tokens.value, isDark.value))
watchEffect(() => {
  const root = document.documentElement
  for (const [k, v] of Object.entries(toCssVars(tokens.value))) root.style.setProperty(k, v)
})
// <n-config-provider ... :theme="theme" :theme-overrides="themeOverrides">
```

**New `frontend/src/styles/base.css`.** Import it in `src/main.js` before
mounting. It contains:

- The `:root` block from 1.2.
- `*, *::before, *::after { box-sizing: border-box; }`, `body { margin: 0;
  -webkit-font-smoothing: antialiased; }`.
- **Move here unchanged** the iOS input zoom-prevention block that currently
  sits in App.vue's global `<style>`: the `@media (hover: none) and (pointer:
  coarse) and (max-width: 1024px)` block with the 16px rules.
- **Delete** the global `.n-switch { margin-left/right: 10px }` rule from
  App.vue. Toolbars add their own gaps.
- Shared utility classes that later phases use:

```css
.panel { background: var(--app-surface); border: 1px solid var(--app-border);
         border-radius: var(--radius-lg); padding: var(--space-5) var(--space-6); }
.panel--danger { background: var(--app-danger-soft); }
@media (max-width: 767.98px) { .panel { padding: var(--space-4); } }

.page-title    { margin: 0; font-size: var(--font-2xl); line-height: 32px; font-weight: 600; color: var(--app-text-1); }
.section-title { margin: 0; font-size: var(--font-xl);  line-height: 26px; font-weight: 600; color: var(--app-text-1); }
.panel-title   { margin: 0; font-size: var(--font-lg);  line-height: 24px; font-weight: 600; color: var(--app-text-1); }
.muted         { color: var(--app-text-3); font-size: var(--font-sm); line-height: 20px; }
.caption       { color: var(--app-text-3); font-size: var(--font-xs); line-height: 18px; font-weight: 500; }
.mono          { font-family: var(--font-mono); }

.stack   { display: flex; flex-direction: column; gap: var(--space-4); }
.toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
.toolbar__spacer { flex: 1 1 auto; }

/* settings list: one row = text on the left, action on the right */
.settings-section { display: flex; flex-direction: column; }
.settings-section + .settings-section { margin-top: var(--space-6); }
.settings-section__header { margin-bottom: var(--space-2); }
.settings-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
                padding: var(--space-3) 0; border-top: 1px solid var(--app-divider); }
.settings-row:first-of-type { border-top: 0; }
.settings-row__text { min-width: 0; color: var(--app-text-2); font-size: var(--font-md); }
.settings-row__action { flex: 0 0 auto; }
@media (max-width: 767.98px) {
  .settings-row { flex-direction: column; align-items: stretch; }
  .settings-row__action .n-button { width: 100%; }
}

/* empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; text-align: center;
               gap: var(--space-2); padding: var(--space-12) var(--space-4); color: var(--app-text-3); }
.empty-state__icon  { font-size: 40px; color: var(--app-text-3); }
.empty-state__title { margin: 0; font-size: 15px; font-weight: 600; color: var(--app-text-1); }
.empty-state__hint  { margin: 0; font-size: var(--font-sm); max-width: 360px; }
```

### 1.5 Values pinned by e2e (do not change)

These are asserted with exact CSS values in `e2e/browser/tests/mail/inbox.spec.ts`
and `mail-read.spec.ts`. The theme above is designed to leave them intact.

| What | Value | Where it comes from |
|---|---|---|
| Selected mail row background | light `rgba(0, 0, 0, 0.1)`, dark `rgba(255, 255, 255, 0.1)` | `MailBox.vue` `.overlay-*-backgroud` (keep the class names, misspelling included) |
| Hover on an unselected row | light `rgb(243, 243, 245)` (= default `hoverColor`), dark `rgba(255, 255, 255, 0.04)` | `MailBox.vue` |
| Quaternary button hover background (Reply/Forward/More/Delete/Attachments) | light `rgba(46, 51, 56, 0.09)`, dark `rgba(255, 255, 255, 0.12)` | Naive `buttonColor2Hover` default |
| Reply / More / Delete idle background | `rgba(0, 0, 0, 0)` (quaternary) | |
| Reply type / Forward type / More type / Delete type / Attachments type | `info` / `default` / `default` / `error` / `default` | `MailContentRenderer.vue` |
| Attachment badge text colour | light `rgb(51, 54, 57)`, dark `rgba(255, 255, 255, 0.82)` | `textColor2` default |
| Mail list item padding | `12px 14px` | `.mail-list-compact :deep(.n-list-item)` |
| `.mail-summary-subject` | `margin-top: 4px`; its `.n-text` is `15px`, heavier than the sender, and a different colour from the sender | `MailSummary.vue` |
| `.mail-summary-sender .n-text` (last) | `13px` | |
| `.mail-summary-preview` | `margin-top: 8px`; `.n-ellipsis` `-webkit-line-clamp` = setting | |
| `.mail-summary-recipient` (admin) | `margin-top: 4px` | |
| Contrast ≥ 4.5:1 for preview, date, the reader action buttons and the attachment badge | both themes | |

Rule: **do not edit `MailSummary.vue` styles.** In `MailBox.vue` you may only
add rules (accent bar, split handle, empty state). Do not change the pinned
declarations.

---

## 2. App shell

Files: `src/App.vue`, `src/views/Header.vue`, `src/views/Footer.vue`, and a new
`src/components/PreferencesDrawer.vue`.

### 2.1 Layout (App.vue)

Replace the 12-column `n-grid` with a CSS grid shell. Keep every provider and
behaviour:

- `n-config-provider` keeps locale, date-locale and theme, plus the new overrides.
- Keep `n-global-style`.
- Keep `n-spin description="loading..." :show="loading"`.
- Keep the notification and message providers, but change both
  `container-style` values to `margin-top: 64px;`.
- Keep `n-back-top`.
- Keep the analytics, ads and Telegram script logic as it is.

```html
<div class="app-shell" :class="{ 'app-shell--fluid': !showSideMargin, 'app-shell--ads': showAd && showSideMargin }">
  <Header />
  <div class="app-body">
    <aside v-if="showAd && showSideMargin" class="app-ad"><ins class="adsbygoogle" … /></aside>
    <main class="app-main"><router-view /></main>
    <aside v-if="showAd && showSideMargin" class="app-ad"><ins class="adsbygoogle" … /></aside>
  </div>
  <Footer />
</div>
```

```css
.app-shell { min-height: 100vh; display: flex; flex-direction: column; background: var(--app-bg); }
.app-body  { flex: 1 0 auto; width: 100%; max-width: calc(var(--app-max-width) + 2 * var(--gutter));
             margin: 0 auto; padding: var(--space-6) var(--gutter) var(--space-12); }
.app-shell--fluid .app-body { max-width: none; }
.app-shell--ads .app-body { display: grid; grid-template-columns: 160px minmax(0, 1fr) 160px; gap: var(--space-6);
                            max-width: calc(var(--app-max-width) + 320px + 48px + 2 * var(--gutter)); }
.app-main { min-width: 0; }
@media (max-width: 767.98px) { .app-body { padding-top: var(--space-4); padding-bottom: var(--space-8); } }
```

- `showSideMargin` keeps its current meaning: `!isMobile && useSideMargin`.
  "Side margin on" means the centred 1280px column. "Off" means full width with
  gutters. Ads render exactly when they did before (`showAd && showSideMargin`).
- **Remove `text-align: center` from the main wrapper.** The default alignment
  is now left. Screens that need centring (landing, empty states) do it
  themselves. In Phase 6, check the admin views that relied on the inherited
  centring. Most already set `text-align:left` or use their own `.center` flex
  wrappers.

### 2.2 Header (Header.vue)

Replace `n-page-header` + `n-menu` with a plain sticky header.

Desktop (≥ 768px):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [logo 28] Cloudflare Temp Email        Mailbox · User Center · Admin Console    🌐 English ▾  ☾  ⚙ │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
  56px tall; bottom border 1px var(--app-border); bg var(--app-bg); position: sticky; top: 0; z-index: 20
  inner row aligned to the same max-width/gutter as .app-body (fluid when side margin is off)
```

Mobile (< 768px):

```
┌──────────────────────────────────┐
│ [logo] Cloudflare Temp E…   ☾  ☰ │   ☰ = icon button, aria-label = t('menu')
└──────────────────────────────────┘
```

Structure and behaviour:

- **Brand (left).** A 28px logo `<img src="/logo.png">` wrapped in the existing
  `@click="logoClick"` element. The 5-click route to admin and its messages
  stay as they are. Next to it is the title `openSettings.title || t('title')`
  in a `<span class="app-title">` (16px/600, single line, ellipsis). It is
  **not** a heading element. Keep `useHead` as it is.
- **Nav (desktop only).** Render one `n-button` (`quaternary`, `size="small"`)
  per visible item, in this order: Mailbox (`t('mailbox')`, home), User Center
  (`t('userCenter')`, shown when `showUserSystem && !isTelegram`), Admin Console
  (`t('admin')`, shown when `showAdminPage`, and it still sets `loading` while
  navigating). The active item (same `menuValue` logic) gets the class
  `is-active`: `background: var(--app-accent-soft); color: var(--app-accent)`.
  Drop the icons from the nav buttons. Wrap the row in `<nav class="app-nav">`.
  **Do not use `n-tabs` or `n-menu` here.** The user-page tests require that
  only one `.n-tabs-tab--active` exists on the page.
- **Actions (right):**
  - **Language** (desktop): keep the `n-dropdown` with `languageOptions` and
    `changeLocale` as they are. The trigger is
    `n-button quaternary size="small"`: globe icon, current locale label,
    chevron.
  - **Theme toggle** (desktop **and** mobile): an icon-only
    `n-button quaternary circle size="small"`. The icon is `LightModeOutlined`
    when dark and `DarkModeOutlined` when light. It has
    `:aria-label="isDark ? t('light') : t('dark')"` and the same `title`, and
    `@click="toggleDark()"`. It must be the **only** button on the page with
    that accessible name. Do **not** repeat it in the mobile drawer.
  - **Preferences** (desktop): an icon-only
    `n-button quaternary circle size="small"` with `SettingsOutlined` and
    `aria-label`/`title` = `t('preferences')` (new key). It opens
    `PreferencesDrawer`.
  - **Menu** (mobile): an icon-only `n-button quaternary circle` with
    `MenuRound` and `aria-label="t('menu')"`. It must be the only button whose
    name matches `/菜单|Menu/i`.
- **GitHub/version and Status move to the footer** (2.4). Remove them from the
  header and the drawer.
- **Mobile menu drawer.** `n-drawer placement="right" :width="'min(320px, 86vw)'"`,
  with `n-drawer-content :title="t('menu')" closable`. Contents:
  1. The nav items stacked: `n-button quaternary block`, 44px tall,
     left-aligned, with the same active style. Each one closes the drawer after
     navigating.
  2. A divider (`border-top: 1px solid var(--app-divider)`).
  3. A two-column utility grid:
     - The **existing** language trigger, `<button type="button"
       class="mobile-menu-utility-button">` with the globe icon, current locale
       label and chevron, wrapped in the `n-dropdown`. Keep this exact
       element.
     - A **Preferences** button that closes the menu drawer and then opens the
       Preferences drawer.
- **Keep the site access-password modal** (`showAuth`, `authFunc`, Turnstile)
  in Header.vue exactly as it is.

### 2.3 Preferences drawer (new `src/components/PreferencesDrawer.vue`)

- Props: `show` (`v-model:show`). Header owns a local `const showPreferences =
  ref(false)`. No store key.
- Use `n-drawer placement="right" :width="isMobile ? '100%' : 420"` with
  `n-drawer-content :title="t('preferences')" closable`.
- Body: `<Appearance :showUseSimpleIndex="isHomeRoute && !!settings.address" />`.
  `isHomeRoute` means `menuValue === 'home'`. This keeps the existing
  "simple index" switch, which only made sense on the mailbox page.
- **Restyle `src/views/common/Appearance.vue`** for a narrow drawer. Keep every
  control and binding. Only the wrapper and grouping change:
  - Remove the `n-card` and `.center` wrappers. The root is `<div class="stack">`.
  - Use three groups. Each has a `.caption` heading (new keys in section 7)
    followed by its rows:
    1. **Mail list:** `mailboxSplitSize` slider (desktop only, as today),
       `mailListView` switch (desktop only), `mailListPreviewLineClamp` slider,
       `configAutoRefreshInterval` slider.
    2. **Reading:** `preferShowTextMail`, `useIframeShowMail`, `useUTCDate`,
       `autoLoadRemoteImages`.
    3. **Layout:** `useSideMargin` (desktop only), `globalTabplacement` radio
       buttons, `useSimpleIndex` (only when the prop is set).
  - Switch rows: `.pref-row { display:flex; justify-content:space-between;
    align-items:center; gap:16px; padding:10px 0; }`, with the label text
    (14px, `--app-text-2`) on the left and the `n-switch` on the right.
  - Slider and radio rows keep `n-form-item-row` with the label on top.

### 2.4 Footer (Footer.vue)

```
────────────────────────────────────────────────────────────────────────────
     Copyright © 2023-2026 · Dream Hunter · About · GitHub v1.14.0 · Status
────────────────────────────────────────────────────────────────────────────
  border-top 1px var(--app-divider); padding 20px var(--gutter); 12px; var(--app-text-3);
  centered; flex-wrap; items separated by "·" (aria-hidden spans); links are n-button text size="tiny"
```

- `t('copyright') © 2023-{year}` and the sanitized `openSettings.copyright`
  HTML stay as they are.
- **About:** shown when `openSettings.enableIndexAbout || route.path.includes('admin')`.
  This combines the old index condition with the old admin About tab. It opens
  `n-modal preset="card"` with `:title="indexT('about')"` and
  `style="width: min(640px, calc(100vw - 32px))"`, containing `<About />`.
- **GitHub:** moved from the header. Show it under the same
  `showGithubForCurrentUser` condition (move that computed here; it needs
  `openSettings` and `showAdminPage`). The label is `version || 'Github'` and it
  opens the same URL in a new tab.
- **Status:** shown when `openSettings.statusUrl`. The label is
  `headerT('status')` and it opens in a new tab.
- Reuse keys through extra scopes: `useScopedI18n('views.Header')` and
  `useScopedI18n('views.Index')`. The footer needs no new keys.
- Delete the broken `.footer-divider` / `var(--x-padding)` CSS.

---

## 3. Mailbox screens (highest priority)

### 3.1 Landing: no address yet (`views/index/AddressBar.vue` "else" branch + `views/common/Login.vue`)

Desktop:

```
                          Your temporary inbox                         ← h1.page-title (new key landingTitle)
                Log in to a mailbox or create a new address.            ← p.muted (new key landingTip)

              ┌──────────────────────────────────────────────┐          ← .panel, width min(480px,100%), centred
              │ ⚠ Mail address credential is invalid…   ✕    │          ← existing warning alert (only if jwt && failed)
              │  Log In to Mailbox │ Create Email Address │ Help│        ← n-tabs type="line" size="medium" justify-content="space-evenly"
              │ ─────────────────────────────────────────────── │
              │ Email                                        │
              │ [                                          ] │
              │ Password                                     │
              │ [                                       👁 ] │
              │ [ Turnstile ]                                │
              │ [██████████ ✉ Log In to Mailbox ███████████] │          ← type="primary" (solid), block, size="large"
              │               Credential Login                │          ← existing toggle, quaternary tiny, centred
              │ ──────────────────── or ──────────────────── │          ← n-divider with t('or') (new key)
              │ [          ＋ Create Email Address           ] │          ← secondary block (existing button)
              │                                              │
              │ Have a code? Redeem it here.     [🎁 Use Code] │        ← redeem row (only when enableRedeemCode)
              └──────────────────────────────────────────────┘
                              👤 User Center →                           ← n-button text type="primary" (only showUserSystem)
```

Mobile: the same stack. The panel is full width (gutter 16px). The title drops
to 20px/28px. Everything else stays a single column.

AddressBar.vue changes (no-address branch):

- Replace `<div class="center"><n-card embedded max-width 600>` with:

```html
<section class="landing">
  <h1 class="page-title">{{ t('landingTitle') }}</h1>
  <p class="muted landing__tip">{{ t('landingTip') }}</p>
  <div class="panel landing__panel"> [warning n-alert] <Login /> </div>
  <n-button v-if="showUserSystem" text type="primary" @click="onUserLogin"> icon User + t('userCenter') </n-button>
</section>
```

  - `.landing`: flex column, centre-aligned, `gap: var(--space-4)`,
    `padding-top: var(--space-8)` (desktop) / `var(--space-4)` (mobile),
    `text-align:center`.
  - `.landing__panel`: `width: min(var(--content-auth), 100%)`,
    `text-align: left`.
- The loading branch (`!settings.fetched`) keeps the skeleton, inside a
  `.panel` that is 240px tall instead of 50vh.
- The Telegram branch and the `showUserMailboxes` branch: wrap in
  `.panel` with `max-width: 960px; margin: 0 auto`, and add
  `<h2 class="section-title">{{ t('addressManage') }}</h2>` above
  `<AddressManagement />` in the user-mailboxes case.

Login.vue changes:

- `n-tabs` `size="large"` → `size="medium"`. Keep `type` (default line),
  `justify-content="space-evenly"`, the pane names (`signin`, `register`,
  `help`) and the default `tabValue = 'signin'` (**required by the tests**).
- **Sign-in pane, in this order:** inputs (email/password or the credential
  textarea, unchanged) → Turnstile → **primary submit** → login-method toggle →
  "or" divider → "Create Email Address" secondary button → redeem row.
  - Submit: `type="primary"`, **not** `secondary`, `block`, `size="large"`,
    `strong`.
  - Move the toggle (`.switch-login-button`) **below** the submit. Keep the
    `quaternary size="tiny" type="info"` button and its labels.
  - Divider: `<n-divider title-placement="center"><span class="muted">{{ t('or') }}</span></n-divider>`.
    Render it only when `showNewAddressTab`.
  - Redeem row: `.redeem-entry-section` becomes a flex row
    (`justify-content: space-between; align-items: center; gap: 12px;
    padding-top: 16px; border-top: 1px solid var(--app-divider)`). It holds
    `n-text.muted` (redeemEntryTip) and an `n-button secondary size="small"`
    with `data-testid="redeem-entry"` and the RedeemOutlined icon plus
    `t('useRedeemCode')`. On mobile it stacks with the button full width.
- **Register pane:**
  - Show the three tips (`getNewEmailTip1 + regex`, `Tip2`, `Tip3`) as
    `<ul class="muted login-tips">`. Use `padding-left: 18px; margin: 0 0 12px`.
    The existing `v-if`s stay.
  - Place the "Generate Fake Name" button (`generateName`, unchanged label) on
    the right, above the input group:
    `n-button quaternary size="small"` inside
    `<div class="toolbar" style="justify-content:flex-end">`.
  - The `n-input-group` (prefix label / name input / `@` / domain `n-select`)
    is **unchanged**. Do not add any element inside it.
  - The subdomain radio group is unchanged. Indent it with
    `padding: 8px 0 0 2px`.
  - Submit "Create Email Address": `type="primary"` (solid), `block`,
    `size="large"`. Keep the `:disabled` logic.
  - Redeem row: same pattern, `data-testid="redeem-entry-register"`.
- **Help pane:** the alert keeps its text. Use
  `n-alert :bordered="false" :show-icon="false"`, then `AdminContact`.
- Remove the scoped `.n-form .n-button { margin-top: 10px }`. Use
  `.login-form { display:flex; flex-direction:column; gap: 12px }` on the
  `n-form` instead.
- **Keep:** `n-form` elements (the tests use `.n-form:visible` and
  `.n-tab-pane:visible form`) and the order of inputs inside the sign-in form
  (the email input is first).

### 3.2 Address bar: has address (`views/index/AddressBar.vue` + `components/AddressSelect.vue`)

Desktop:

```
Your address                                                                     ← .caption (new key yourAddress)
[ tmpx7k2@example.com  [Password Login]                ▾ ] [⧉ Copy] [⇄ Mailbox Management] [⋮]
  └ n-select.address-select, flex 1 1 320px, max-width 520px      primary solid   secondary     quaternary circle
```

Mobile:

```
Your address
[ tmpx7k2@example.com                     ▾ ]   ← full width
[ ⧉ Copy                       ] [⇄] [⋮]        ← Copy flex:1; ⇄ icon-only (aria-label/title = t('addressManage')); ⋮ icon-only
```

- Remove the `n-alert type="info"` wrapper. The bar is
  `<section class="address-bar">` with no background or border and
  `margin-bottom: var(--space-4)`. It sits directly on the page.
- **AddressSelect.vue:**
  - Root `n-flex.address-row`: `justify="start"`, `gap: 8px`, wrap.
  - The `n-select` keeps `class="address-select"`, the `filterable`,
    `render-label` and placeholder logic, and all option building. Change its
    style to `flex: 1 1 320px; min-width: 0; max-width: 520px` (desktop) and
    `flex-basis: 100%; max-width: none` (mobile). Use `size="medium"`; the
    default prop becomes `'medium'`. Make the selected value render in the mono
    font: `.address-select :deep(.n-base-selection-label) { font-family: var(--font-mono); font-size: 15px; }`.
  - Copy button (`.address-copy`): `type="primary"` (solid), the
    `ContentCopyRound` icon and `t('copy')`. This is the screen's primary
    action. On mobile it is `flex: 1`.
- **AddressBar.vue `#actions` slot:**
  - `.address-manage` button: keep the class name and `@click`. Use
    `secondary`, the `SwapHorizRound` icon and `t('addressManage')`. On mobile
    it becomes icon-only (`circle`), with `aria-label` and `title` set to
    `t('addressManage')`.
  - **New overflow menu:** `n-dropdown trigger="click"` around
    `n-button quaternary circle` with `MoreVertRound` and
    `aria-label="t('mailboxOptions')"` (new key: "Mailbox options"). **Do not**
    use "More"/"More actions" (that name belongs to the reader). Options:
    1. Credentials. The label is AccountSettings'
       `t(addressPasswordLoginOnly ? 'showSessionToken' : 'showAddressCredential')`
       through a second `useScopedI18n('views.index.AccountSettings')`. The
       action sets `showAddressCredential = true`.
    2. Simple Mode. The label is `views.Index.enterSimpleMode`. The action sets
       `useSimpleIndex = true`. It replaces the old tabs-prefix button.
- The modals (`AddressCredentialModal`, and the `showAddressManage` modal with
  `TelegramAddress` / `AddressManagement` / `LocalAddress`) are unchanged. For
  the manage modal, change `style="width: 720px;"` to
  `style="width: min(760px, calc(100vw - 32px));"`.

### 3.3 Mailbox tabs (`views/Index.vue`)

```
Inbox    Sent    Send Mail    Mailbox Settings    Webhook Settings
━━━━━ ─────────────────────────────────────────────────────────────────  (line tabs; bar = accent; bottom divider)
```

- `n-tabs type="card"` → `type="line" size="medium"`. Keep
  `v-model:value="indexTab"`, `:placement="globalTabplacement"` and
  `class="mailbox-tabs"`. Mobile: line tabs scroll horizontally (Naive
  built-in). Check that no ancestor sets `overflow:hidden` in a way that breaks
  this.
- **Visible panes, in this order:**

  | Pane name | Label (existing key) | Condition |
  |---|---|---|
  | `mailbox` | `views.Index.inbox` | always |
  | `sendbox` | `views.Index.sendbox` | `enableSendMail` |
  | `sendmail` | `views.Index.sendmail` | `enableSendMail` |
  | `accountSettings` | `views.Index.mailboxSettings` | always |
  | `webhook` | `views.Index.webhookSettings` | `enableWebhook` |

- **Removed panes and where they went:**
  - `appearance` → Preferences drawer.
  - `about` → Footer.
  - `auto_reply` and `s3_attachment` → inside `accountSettings`.
  - Remove the `#prefix` "Simple Mode" button (it moves to the address-bar
    overflow).
- **Redirect stale tab values** (sessionStorage may hold old values):

```js
const visibleIndexTabs = computed(() => [
  'mailbox',
  ...(openSettings.value.enableSendMail ? ['sendbox', 'sendmail'] : []),
  'accountSettings',
  ...(openSettings.value.enableWebhook ? ['webhook'] : []),
])
const LEGACY_INDEX_TABS = { auto_reply: 'accountSettings', s3_attachment: 'accountSettings', appearance: 'mailbox', about: 'mailbox' }
watchEffect(() => {
  if (!openSettings.value.fetched) return          // don't clobber 'sendmail' set by Reply before settings load
  if (!visibleIndexTabs.value.includes(indexTab.value)) {
    indexTab.value = LEGACY_INDEX_TABS[indexTab.value] ?? 'mailbox'
  }
})
```

- **Mailbox Settings pane content:**

```html
<n-tab-pane name="accountSettings" :tab="t('mailboxSettings')">
  <AccountSettings>
    <template #extra>
      <n-collapse v-if="openSettings.enableAutoReply || openSettings.isS3Enabled" display-directive="if" class="settings-collapse">
        <n-collapse-item v-if="openSettings.enableAutoReply" name="auto_reply" :title="t('auto_reply')"><AutoReply /></n-collapse-item>
        <n-collapse-item v-if="openSettings.isS3Enabled" name="s3_attachment" :title="t('s3Attachment')"><Attachment /></n-collapse-item>
      </n-collapse>
    </template>
  </AccountSettings>
</n-tab-pane>
```

  `display-directive="if"` keeps `/api/auto_reply` and the S3 list from being
  fetched until a section is expanded. The calls themselves are unchanged.
  Style `.settings-collapse` as a `.panel` with
  `padding: var(--space-2) var(--space-6) var(--space-5)`.
- The mail-id query bar (`showMailIdQuery`) is unchanged in logic. Render it as
  a `.toolbar` above `MailBox`, containing `n-input-group` (input with
  `max-width: 280px`) and the Query button `secondary`.
- `SimpleIndex` branch: unchanged (see 3.10).

### 3.4 Inbox list (`components/MailBox.vue`; `MailSummary.vue` untouched)

Desktop (`mailListView=false`, split):

```
[☐ Multi Action] [⟳ Refresh] (◯ Auto Refresh)            [🔍 Filter this page ✕]  ‹ 1 2 3 ›  [20 / page ▾]
┌──────────────────────────────┬─────────────────────────────────────────────────────────────┐
│▌● sender@example.com 25/11/18│                               ‹ Previous mail   Next mail › │ ← 13px text buttons
│  Welcome to Example           │ Welcome to Example                                          │ ← n-card title = h-role, 18px/600
│  Thanks for signing up…       │ From  sender@example.com                                    │
│───────────────────────────────│ 2025-11-18 10:22                                            │
│  other@example.org   25/11/17│ ──────────────────────────────────────────────────────────── │
│  Your code is 4821            │ ↩ Reply  ↪ Forward  📎 Attachments ②          ⋯ More  🗑 Delete │
│  …                            │  ⚠ 2 remote images blocked            [Load images]         │
│                               │  <mail body>                                                │
└──────────────────────────────┴─────────────────────────────────────────────────────────────┘
 ▌= 3px accent inset bar on the selected row (in addition to the pinned grey fill)
```

Desktop list view (`mailListView=true`): the list is full width. Opening a mail
shows the reader in place of the list, with "‹ Back to List" (unchanged
behaviour).

Mobile:

```
[🔍 Filter this page                      ✕]
[⟳ Refresh] (◯ Auto)                ‹ 1/3 ›
sender@example.com                 25/11/18
Welcome to Example
Thanks for signing up…
───────────────────────────────────────────
other@example.org                  25/11/17
…
```

Changes:

- **Desktop toolbar (normal mode)** becomes `<div class="toolbar mailbox-toolbar">`,
  `margin-bottom: var(--space-3)`:
  - Left: `Multi Action` (`quaternary size="small"`, CheckBoxOutlined icon,
    label unchanged); `Refresh` (`quaternary size="small"`, RefreshRound icon,
    label `t('refresh')`); then the auto-refresh `n-switch size="small"` with
    its checked/unchecked slots unchanged.
  - `.toolbar__spacer`.
  - Right: filter `n-input size="small" clearable` (`width: 220px`, SearchRound
    prefix icon, placeholder unchanged), then `n-pagination size="small"` with
    `page-sizes` and `show-size-picker` unchanged.
- **Desktop toolbar (multi mode):** the same `.toolbar` with Cancel Multi
  Action / Select All / Unselect All (`quaternary size="small"`), then a
  spacer, then Delete (popconfirm, `tertiary type="error" size="small"`) and
  Download Mail (`tertiary size="small"`). The labels are unchanged.
- **Mobile toolbar:**
  - Row 1: the filter input, `size="medium"`, full width.
  - Row 2: `.toolbar` with Refresh, the auto switch, a spacer, and simple
    pagination.
  - Remove the inline `padding: 0 10px` hacks.
- **Split pane:**
  - Keep `n-split` and its props, `.mail-list-scroll` and `.mail-list-compact`.
  - The list column gets `border-right: 1px solid var(--app-divider)`.
  - Replace the grip handle visuals: `.split-handle__grip` becomes a 1px-wide,
    full-height line in `var(--app-divider)`. On hover it is 3px wide in
    `var(--app-accent)`. Keep the class names.
  - `.mail-list-scroll`: change `max-height: 100vh` to
    `max-height: calc(100vh - 220px)` and `min-height: 60vh` to
    `min-height: 420px` on desktop. This keeps the list and reader inside the
    viewport. Mobile is unchanged (natural page scroll).
- **Selected row accent:** add
  `.mail-list-compact :deep(.n-list-item.overlay) { box-shadow: inset 3px 0 0 var(--app-accent); }`.
  Do not change the background rules.
- **Reader card (desktop):** keep `n-card :bordered="false" class="mail-item"
  :title="curMail.subject"`. Add `content-style="padding: 0 24px 24px"` and
  `header-style="padding: 8px 24px 12px"`. Add
  `:deep(.mail-item .n-card-header__main) { font-size: var(--font-xl); font-weight: 600; }`.
  The prev/next row (`margin: 8px`) becomes a right-aligned `.toolbar` with
  `padding: 0 24px`. Labels are unchanged.
- **Empty state** (new; replaces the `n-result` 100px-icon blocks):
  - Add `const loaded = ref(false)`. Set it to `true` in the `finally` of the
    first `refresh()`.
  - When `loaded && rawData.length === 0`: render **instead of** the split/list
    (on desktop and mobile; the toolbar stays):

    ```html
    <div class="empty-state mailbox-empty">
      <n-icon class="empty-state__icon" :component="InboxRound" />
      <h3 class="empty-state__title">{{ t('emptyInbox') }}</h3>
      <p class="empty-state__hint">{{ t('emptyInboxHint') }}</p>
      <n-button secondary size="small" @click="backFirstPageAndRefresh">{{ t('refresh') }}</n-button>
    </div>
    ```

  - When `rawData.length > 0 && data.length === 0` (the filter matches
    nothing): show `<p class="muted" style="padding:16px 14px">{{ t('noFilterMatch') }}</p>`
    inside the list column.
  - When mails exist but none is selected (desktop split), the reader column
    shows a compact `.empty-state` with the `InboxRound` icon and
    `t('pleaseSelectMail')`. It has no button.
- **Mobile reader drawer:**
  - `style="height: 80vh;"` → `style="height: 92vh; border-radius: 12px 12px 0 0;"`.
  - Keep `placement="bottom"`, `:trap-focus="false"`, `:block-scroll="false"`
    and the `n-drawer-content :title closable`.
- The multi-action download and delete-progress modals are unchanged.

### 3.5 Mail reader (`components/MailContentRenderer.vue`)

Structure, buttons, popover, focus handling, modals and the fullscreen drawer
are **unchanged**. They are heavily asserted. Visual-only edits:

- `.mail-details`: `border-bottom: 1px solid var(--app-divider)` instead of
  `var(--n-border-color)`; `padding-bottom: 12px`.
- `.mail-address`: grid column `44px` → `48px`. The label stays 11px,
  `--app-text-3`.
- `.mail-actions`: `padding: 4px 0`, `border-bottom: 1px solid var(--app-divider)`.
- `.remote-images-banner`: no change other than inheriting the radius.
- The mail body area gets no extra card or background. The ShadowHtml
  `.mail-boundary` keeps its own background logic.

### 3.6 Sent (`components/SendBox.vue`)

- **Toolbar:** the same `.toolbar` pattern as 3.4. Multi Action (only when
  `showMultiActionMode`), Refresh (`quaternary`), spacer, pagination. Multi
  mode buttons follow 3.4.
- **List rows:** keep `n-list` / `n-list-item` / `n-thing :title="row.subject"`
  (the tests use `.n-thing-header__title`). Replace the four `n-tag`s in
  `#description` with one muted line:

  ```html
  <n-text depth="3" class="sent-meta">
    <template v-if="showEMailFrom">{{ rt('from') }} {{ row.address }} · </template>{{ rt('to') }} {{ row.to_mail }} · {{ utcToLocalDate(row.created_at, useUTCDate) }}
  </n-text>
  ```

  `rt` = `useScopedI18n('components.MailContentRenderer').t` (the existing
  `from`/`to` keys). `.sent-meta` is 12px, ellipsis, single line. Show the ID
  only in the detail view.
- **Detail** (desktop card and mobile drawer): replace the tag row with a
  `.mail-details`-style block:
  - From / To rows, then a muted footer line `{date} · #{id}`.
  - An actions row with `Show Code` (`quaternary size="small"`, label
    unchanged) and Delete (popconfirm, `quaternary type="error" size="small"`).
  - Keep the `<pre>` / `v-html` content logic.
- **Empty states:** use the `.empty-state` pattern with the `SendRound` icon and
  `t('emptySent')` (existing key). Use `t('pleaseSelectMail')` for the
  unselected reader.
- Selection highlight and split handle: same as 3.4.

### 3.7 Compose (`views/index/SendMail.vue`; `views/user/SendMail.vue` and `views/admin/SendMail.vue` follow the same rules)

This screen already matches the direction. Minimal edits:

- `n-card.composer-card :bordered="false" embedded` → `n-card.composer-card`
  with `:bordered="true"`, no `embedded`, keeping `width: min(900px, 100%)`.
  The card now uses the surface colour and border instead of a grey fill.
- `.composer-page` padding `14px 0 24px` → `0 0 24px` (the tabs pane already
  pads 20px).
- The send button stays the only `type="primary"`. "Request access" in the
  no-balance state is `type="primary"` only when the form is not shown (as
  today).
- **Keep everything listed in section 8 "Compose".**

### 3.8 Mailbox settings (`views/index/AccountSettings.vue`, `AutoReply.vue`, `Attachment.vue`)

```
┌ Access ───────────────────────────────────────────────────────────────────┐   .panel .settings-section
│ Sign in on other devices or connect a mail client.  [Credentials & Connection Methods] │
│ ─────────────────────────────────────────────────────────────────────────── │
│ Used to log in with this address and a password.        [Change Mailbox Password] │  (if enableAddressPassword)
│ ─────────────────────────────────────────────────────────────────────────── │
│ Sign out of this mailbox on this browser.                          [Logout] │
└───────────────────────────────────────────────────────────────────────────┘
┌ ▸ Auto Reply ─────────────────────────────────────────────────────────────┐   slot #extra (Index only)
│ ▸ S3 Attachment                                                            │
└───────────────────────────────────────────────────────────────────────────┘
┌ Danger zone ──────────────────────────────────────────────────────────────┐   .panel .panel--danger (only if enableUserDeleteEmail)
│ These actions cannot be undone.                                            │
│ Permanently delete all received mail.                          [Clear Inbox] │
│ Permanently delete all sent mail.                         [Clear Sent Items] │
│ Delete this address and all of its mail.                   [Delete Mailbox] │
└───────────────────────────────────────────────────────────────────────────┘
   container: max-width var(--content-form) (720px); stack gap 16px; left-aligned (not centred)
```

AccountSettings.vue:

- Root: `<div class="account-settings stack" v-if="settings.address">`, with
  `max-width: var(--content-form)`. Remove `.center` and the `n-card embedded`.
- **Access panel:** `.panel.settings-section` with
  `<h3 class="panel-title">{{ t('accessSection') }}</h3>`, followed by
  `.settings-row`s:
  1. Text `t('credentialTip')`. Button
     `t(openSettings.addressPasswordLoginOnly ? 'showSessionToken' : 'showAddressCredential')`
     (`secondary`), `@click="showAddressCredential = true"`.
  2. (`openSettings?.enableAddressPassword`) Text `t('passwordTip')`. Button
     `t('changePassword')` (`secondary`).
  3. Text `t('logoutTip')`. Button `t('logout')` (`secondary`), which opens the
     existing logout dialog.
- `<slot name="extra" />`.
- **Danger zone panel** (`v-if="openSettings.enableUserDeleteEmail"`):
  `.panel.panel--danger.settings-section` with the title `t('dangerSection')`
  (colour `var(--app-danger)`) and `p.muted` `t('dangerSectionTip')`. Rows:
  - Clear Inbox (`t('clearInboxTip')`)
  - Clear Sent Items (`t('clearSentItemsTip')`)
  - Delete Mailbox (`t('deleteMailboxTip')`)

  The buttons are `secondary type="error"`, with labels unchanged.
- All five `n-modal preset="dialog"` confirmations are unchanged: content,
  actions, `loading` and button labels. Only remove the scoped
  `.n-button { margin-top: 14px }`.
- SimpleIndex renders `<AccountSettings />` without the slot. It shows the same
  two panels.

AutoReply.vue: remove the `n-card` and the `.center`/`.left`/`.right` wrappers.
The root is `<div class="stack">` containing:

- The `n-form-item` rows. Change `label-placement="left"` to
  `label-placement="top"`, and keep every binding and the `:disabled` logic.
- `<div class="toolbar" style="justify-content:flex-end">` with the Save button
  `type="primary"`.

Attachment.vue: unchanged apart from `n-data-table size="small"`.

### 3.9 Webhook (`views/index/Webhook.vue` → `components/WebhookComponent.vue`)

No structural change. Everything inside is asserted, including `.n-card` with
Save and a switch, Presets, Test, Check only and `filter-editor`. Two visual
changes only:

- Remove `embedded` from the card and add `:bordered="true"`.
- Change `.center` from centred to `justify-content: flex-start`, with a card
  `max-width: 800px`.

### 3.10 Simple mode (`views/index/SimpleIndex.vue`)

```
                [ tmpx7k2@example.com        ▾ ]                  ← AddressSelect :showCopy="false"
   [⟳ Refresh Mails]  [⧉ Copy Address]  [⚙ Mailbox Settings]  [⤢ Exit Simple Mode]
                        Auto refresh in 42 s                      ← .caption
┌──────────────────────────────────────────────────────────────┐
│ ‹ Previous                  3 / 12                    Next › │
│ Welcome to Example                                    (h3)   │
│ <MailContentRenderer>                                        │
└──────────────────────────────────────────────────────────────┘
    container max-width 720px, centred; cards → .panel
```

- `n-card embedded` → `.panel` blocks, `margin-top: var(--space-4)`.
- **Buttons:**
  - "Refresh Mails" is the primary action: `type="primary"` solid,
    `size="small"`.
  - The others are `secondary size="small"`, with labels unchanged.
  - **"Mailbox Settings" must stay a button with that exact name.**
- The account-settings card stays an `n-card` (`:bordered="true"`, no
  `embedded`), with `closable`, `@close` and `:title="t('mailboxSettings')"`
  unchanged. Do not replace it with a custom close button, so that no new
  persistent button named "close" is added.
- Replace the hard-coded unread dot colour `#2080f0` with `var(--app-accent)`.
- `n-empty` for no mails becomes the `.empty-state` pattern with the existing
  `t('noMails')`.

### 3.11 Address management modals (`views/index/LocalAddress.vue`, `TelegramAddress.vue`, `views/user/AddressManagement.vue`)

The internals are unchanged: segment tabs "Address" / "Create or Bind", data
table columns and row buttons, popconfirms, search input group and pagination.
Visual changes only:

- The `n-alert type="warning"` tip in LocalAddress →
  `n-alert type="warning" :bordered="false"` with `margin-bottom: 12px`.
- AddressManagement: the search `n-input-group` and the pagination sit in one
  `.toolbar` (search `flex: 1 1 280px`, pagination to the right). Keep
  `data-testid="user-address-search"`, the pagination prefix
  `t('itemCount'): N`, and the table `size="small"`.

### 3.12 Redeem page (`views/Redeem.vue`)

Keep the structure and every `data-testid`. Visual changes only:

- Replace all eight hard-coded `#18a058` colours with `var(--app-accent)`.
  Where a tinted background is derived from it, use `var(--app-accent-soft)`.
- `n-card.redeem-card embedded` → `:bordered="true"` without `embedded`, with
  `width: min(560px, 100%)`.
- The type-card grid's active state is `border-color: var(--app-accent);
  background: var(--app-accent-soft)`.

### 3.13 Telegram mini-app mail (`views/telegram/Mail.vue`)

- Replace the four `n-tag`s with a `.mail-details`-style block:
  - `From` and `To` rows (when `showEMailTo`). The labels come from
    `components.MailContentRenderer`.
  - A muted line `{date} · #{id}`.
- The card becomes a `.panel` with `max-width: 800px; width: 100%`.
- The iframe gets `border: 0; border-radius: var(--radius-md); min-height:
  calc(100vh - 200px); background: #fff`. Mail HTML assumes a light canvas, the
  same as `.mail-iframe` in the reader.
- The header in Telegram mode already hides User Center. Nothing else changes.

---

## 4. User page (`views/User.vue`, `views/user/*`)

Desktop (signed in):

```
┌───────────────────────────────────────────────────────────────────────┐
│ (A)  Current User                                                      │  ← account bar (no panel, no alert)
│      alice@example.com                                                 │     32px avatar circle: first letter, accent-soft bg, accent text
└───────────────────────────────────────────────────────────────────────┘
Mailbox Management    Inbox    Sent    Send Mail    User Settings
━━━━━━━━━━━━━━━━━━ ──────────────────────────────────────────────────────
<pane>
```

Signed out:

```
                           User Center                       ← h1.page-title (reuse views.Header.userCenter)
              ┌──────────────────────────────────┐            ← .panel width min(480px,100%)
              │      Login     │     Register     │            ← n-tabs line, space-evenly
              │ Email / Password / Turnstile      │
              │ [████████ Login ████████████████] │            ← primary solid
              │                  Forgot password? │            ← quaternary tiny, right-aligned
              │ ─────────────── or ────────────── │
              │ [ 🔑 Login with Passkey         ] │            ← secondary block
              │ [ (icon) Login with GitHub      ] │            ← per OAuth2 client, secondary block
              └──────────────────────────────────┘
```

**UserBar.vue:**

- Skeleton: put it inside a `.panel` that is 120px tall.
- Signed in: replace the `n-alert type="success"` with
  `<div class="account-bar">`: `.account-bar__avatar` (32px circle, letter =
  `user_email[0].toUpperCase()`) and a column with
  `<span class="caption">{{ t('currentUser') }}</span>` and
  `<span class="account-bar__email">{{ userSettings.user_email }}</span>`
  (15px/600).
  - **The email must appear in exactly one element on the page.** Do not add
    it to the header.
  - `margin-bottom: var(--space-4)`.
- Signed out: the landing pattern from 3.1. An `h1` with the reused
  `views.Header.userCenter`, then a `.panel` holding the existing warning alert
  and `<UserLogin />`.

**UserLogin.vue:**

- Tabs `size="large"` → `"medium"`. Keep the panes and `v-if`s.
- **Login pane:**
  - Inputs.
  - Turnstile.
  - Login: `type="primary"` solid, block, large.
  - Forgot password: `quaternary size="tiny"`, right-aligned under the button.
  - `n-divider` with the "or" title. Reuse `views.common.Login.or` through a
    second scope.
  - Passkey: `secondary` block. Change the `type="primary"` + `secondary`
    combination to plain `secondary` so the Login button stays the only
    primary.
  - OAuth2 buttons: `secondary` block.
- **Register pane:** Register button `type="primary"` solid. Everything else
  is unchanged.
- The forgot-password modal is unchanged.
- Replace the scoped `.n-button { margin-top: 10px }` with a flex column
  `gap: 12px` on the forms.

**User.vue tabs:**

- `type="card"` → `type="line" size="medium"`. Keep the model and placement.
- **Panes:**
  - `address_management`
  - `user_mail_box_tab`
  - `user_sendbox` (enableSendMail)
  - `user_send_mail` (enableSendMail)
  - `user_settings`
- **Remove the `bind_address` pane** ("Link Email Address"). It renders
  `BindAddress.vue` = `<Login />`, which is identical to the "Create or Bind"
  segment inside Mailbox Management (`AddressManagement.vue`, the
  `create_or_bind` pane, also `<Login />` with default props). The feature
  stays reachable there.
  - Delete `views/user/BindAddress.vue` and its import. Leave its i18n key in
    place (harmless).
  - Redirect: `watchEffect(() => { if (userTab.value === 'bind_address') userTab.value = 'address_management' })`.
    Also send any value not in the visible list to `address_management` once
    `openSettings.fetched` is true.
- The `@sent="userTab = 'user_sendbox'"` behaviour is unchanged.

**UserSettings.vue** (signed-in settings), container
`max-width: var(--content-form)`, `.stack`:

```
┌ Passkeys ──────────────────────────────────────────────────────────────┐
│ Sign in with your device instead of a password.                         │
│                                   [Show Passkey List] [＋ Create Passkey] │   Create = primary (the page's one), Show = secondary
└────────────────────────────────────────────────────────────────────────┘
┌ Account ───────────────────────────────────────────────────────────────┐
│ The server only receives a hash of your password… (passordTip, .muted)  │
│ Sign out of the user center on this browser.                  [Logout] │
└────────────────────────────────────────────────────────────────────────┘
```

- Use the `.panel.settings-section` and `.settings-row` patterns. Keep the button
  labels (`showPasskeyList`, `createPasskey`, `logout`), all four modals (their
  presets: `dialog` for create/rename/logout, `card` for the list) and the
  passkey table.

**UserMailBox.vue / UserSendBox.vue:**

- Put the address filter `n-input-group` (select + Query) in a `.toolbar` with
  the select at `flex: 1 1 320px; max-width: 480px`. Remove the inline
  `margin-top: 10px` spacers; the tab pane padding handles spacing.
- Keep the `.n-input-group .n-select` structure and `.address-picker-select`.
- The UserSendBox `n-empty` (no address) becomes the `.empty-state` pattern
  using `t('noAddress')`.

---

## 5. Admin (`views/Admin.vue`; lower priority)

```
Quick Setup  Mailbox Management  Users  Emails  Telegram  Statistics  Redemption Codes  Maintenance  Admin
━━━━━━━━━━━ ────────────────────────────────────────────────────────────────────────────────────────────── (line, scrolls on mobile)
  Mailboxes   Create Email Address   Global Mailbox Settings   Sender Access   IP Blacklist   …   (bar, small, left-aligned)
  ────────
  <admin view, unchanged internals>
```

- Top-level `n-tabs type="card"` → `type="line" size="medium"`. Keep
  `v-model:value="adminTab"`, `:placement="globalTabplacement"`, all pane names
  and the `v-if`s.
- **Remove the `appearance` and `about` panes.** Appearance moves to the header
  Preferences drawer and About to the footer link, which shows on `/admin`.
- **Sub-tabs** (`key="quick-setup-tabs"`, `account-tabs`, `user-tabs`,
  `mails-tabs`, `maintenance-tabs`):
  `type="bar" justify-content="center" animated` →
  `type="bar" size="small" animated`. Drop `justify-content`, so they are
  left-aligned. Keep the `key`s and pane names. **Keep the two-level
  structure.** Only the active top-level pane may render its sub-tabs, because
  labels like "Emails", "Global Mailbox Settings", "Send Mail" and "Webhook
  Settings" repeat across sections and the tests use exact, unique text
  matches.
- **adminTab guard:**

```js
const visibleAdminTabs = computed(() => ['qucickSetup', 'account', ...(showUserSystem.value ? ['user'] : []),
  'mails', 'telegram', 'statistics', ...(openSettings.value.enableRedeemCode ? ['redeemCodes'] : []),
  'maintenance', 'adminAccount'])
watchEffect(() => {
  if (!openSettings.value.fetched) return
  if (!visibleAdminTabs.value.includes(adminTab.value)) adminTab.value = 'account'
})
```

- **adminAccount pane:**
  - The `n-card width 600` becomes
    `.panel.settings-section` (`max-width: var(--content-form)`).
  - A `.settings-row` with the text
    `t('loginMethod')`: `currentLoginMethod`.
  - When `isAdminPasswordLogin`, a row with the Logout button
    `secondary type="warning"`.
  - The logout confirm modal is unchanged.
- The admin password modal (`showAdminPasswordModal`) is unchanged. Its
  render timing is tested.
- Admin child views (`views/admin/*.vue`): **no structural edits.** They get
  the new tokens automatically: radius, accent, embedded card colour and table
  header. The only allowed edits are removing hard-coded colours (none were
  found) and fixing any centring that breaks after App.vue drops
  `text-align:center` (see 2.1).

---

## 6. Relocation map (nothing is deleted)

| Control / feature | Before | After |
|---|---|---|
| Appearance preferences (index) | Index tab "Appearance" | Header ⚙ **Preferences** drawer. On mobile: Menu drawer → Preferences |
| Appearance preferences (admin) | Admin tab "Appearance" | Same Preferences drawer |
| About (index, `ENABLE_INDEX_ABOUT`) | Index tab "About" | Footer "About" link → modal |
| About (admin) | Admin tab "About" | Footer "About" link (always shown on `/admin`) |
| Auto Reply | Index tab | Mailbox Settings → collapsible "Auto Reply" section |
| S3 Attachment | Index tab | Mailbox Settings → collapsible "S3 Attachment" section |
| Enter Simple Mode | Button in the tabs prefix (desktop only) | Address-bar ⋮ "Mailbox options" menu, all sizes. The Preferences switch also remains |
| Address credentials | Mailbox Settings button | Unchanged, plus a shortcut in the address-bar ⋮ menu |
| Theme toggle | Header menu item with text | Header icon button (`aria-label` Light/Dark), desktop and mobile |
| Language switch | Header dropdown / mobile drawer | Same places, restyled |
| GitHub + version | Header (desktop) / drawer (mobile) | Footer |
| Status page link | Header menu | Footer |
| Mailbox logout / clear / delete | Stacked buttons | Mailbox Settings → "Access" and "Danger zone" panels |
| Link Email Address (user) | User tab "Link Email Address" | User → Mailbox Management → "Create or Bind" segment (identical `<Login />`) |
| Passkey actions / user logout | Stacked buttons | User Settings → "Passkeys" and "Account" panels |

---

## 7. New i18n keys

Add these to `MESSAGE_REGISTRY` with both `en` and `zh`. Also add them to
`locales/source/{de,es,ja,ptBR}.ts` using flat keys such as
`"views.Header.preferences"`.

| Namespace.key | en | zh |
|---|---|---|
| `views.Header.preferences` | Preferences | 偏好设置 |
| `views.index.AddressBar.landingTitle` | Your temporary inbox | 临时邮箱 |
| `views.index.AddressBar.landingTip` | Log in to a mailbox or create a new address. | 登录已有邮箱，或创建新的邮箱地址。 |
| `views.index.AddressBar.yourAddress` | Your address | 当前地址 |
| `views.index.AddressBar.mailboxOptions` | Mailbox options | 邮箱选项 |
| `views.common.Login.or` | or | 或 |
| `views.index.AccountSettings.accessSection` | Access | 访问 |
| `views.index.AccountSettings.credentialTip` | Sign in on other devices or connect a mail client. | 在其他设备登录或连接邮件客户端。 |
| `views.index.AccountSettings.passwordTip` | Used to log in with this address and a password. | 用于通过邮箱地址和密码登录。 |
| `views.index.AccountSettings.logoutTip` | Sign out of this mailbox on this browser. | 在此浏览器上退出此邮箱。 |
| `views.index.AccountSettings.dangerSection` | Danger zone | 危险操作 |
| `views.index.AccountSettings.dangerSectionTip` | These actions cannot be undone. | 以下操作不可撤销。 |
| `views.index.AccountSettings.clearInboxTip` | Permanently delete all received mail. | 永久删除所有收到的邮件。 |
| `views.index.AccountSettings.clearSentItemsTip` | Permanently delete all sent mail. | 永久删除所有已发送的邮件。 |
| `views.index.AccountSettings.deleteMailboxTip` | Delete this address and all of its mail. | 删除此邮箱地址及其全部邮件。 |
| `components.MailBox.emptyInboxHint` | New mail appears here. Refresh, or turn on auto refresh. | 新邮件会显示在这里。可手动刷新或开启自动刷新。 |
| `components.MailBox.noFilterMatch` | No mail on this page matches the filter. | 当前页没有匹配的邮件。 |
| `views.user.UserSettings.passkeySection` | Passkeys | 通行密钥 |
| `views.user.UserSettings.passkeyTip` | Sign in with your device instead of a password. | 使用设备验证代替密码登录。 |
| `views.user.UserSettings.accountSection` | Account | 账户 |
| `views.user.UserSettings.logoutTip` | Sign out of the user center on this browser. | 在此浏览器上退出用户中心。 |
| `views.common.Appearance.sectionList` | Mail list | 邮件列表 |
| `views.common.Appearance.sectionReading` | Reading | 阅读 |
| `views.common.Appearance.sectionLayout` | Layout | 布局 |

Reused existing keys: `views.Header.{light,dark,menu,status,userCenter}`,
`views.Index.{about,enterSimpleMode,auto_reply,s3Attachment}`,
`views.index.AccountSettings.{showAddressCredential,showSessionToken}`,
`components.MailContentRenderer.{from,to}`, `components.SendBox.emptySent`,
`components.MailBox.{emptyInbox,pleaseSelectMail,refresh}`. **Do not change any
existing string.** Many are exact-matched by e2e.

---

## 8. Must keep: e2e hooks

Sources: `e2e/browser/tests/**` and `e2e/webhook/tests/**`. The Playwright
default viewport is 1280×720. Some tests switch to 390, 375 or 320 widths, or
to 1360. Before each phase's PR, grep the tests for any selector you are about
to touch.

### 8.1 Global / shell

- `html` gets/loses class `dark` through VueUse `useDark` (key
  `vueuse-color-scheme`). Keep the mechanism.
- At 1360px desktop: exactly one **button** with accessible name `Light` (when
  dark) or `Dark` (when light), and clicking it toggles the theme
  (`mail-body-colors.spec.ts`).
- At 375px mobile: exactly one button whose name matches `/菜单|Menu/i`. It
  opens an `.n-drawer`. Inside, a `button` whose name contains the current
  locale label (`中文|English|Español|Português|日本語|Deutsch`) opens an
  `n-dropdown` (`.n-dropdown-option`). Choosing `Deutsch` navigates to `/de/`
  (`locale-switch.spec.ts`).
- Spinner text `loading...` (n-spin `description`). `.n-spin-content--spinning`
  must not appear when toggling read status (read updates use
  `showLoading:false`; keep it that way).
- `.n-message` toasts (message provider) and `.n-notification`.
- No page-level horizontal scroll (`document.documentElement.scrollWidth <=
  innerWidth`) on the mailbox at 320px and 390px, including with the mobile
  reader and fullscreen open.
- No other **persistently rendered** button whose accessible name contains
  `close` (case-insensitive). `user-send-mail.spec.ts` uses a non-exact
  `getByRole('button', { name: 'close' })`.
- No other `n-list` / `n-list-item` on the mailbox page.
  `.n-list-item.overlay` and `.n-list-item:not(.overlay)` must each resolve to
  one element when the inbox has 2 mails.
- **No `n-tabs` in the shell** (header, footer, drawers): only one
  `.n-tabs-tab--active` may exist on the user page.
- Storage keys (unchanged):
  - localStorage: `announcement`, `useSimpleIndex`, `auth`, `adminAuth`, `jwt`,
    `mailboxSplitSize`, `mailListView`, `mailListPreviewLineClamp`,
    `useIframeShowMail`, `preferShowTextMail`, `userJwt`, `preferredLocale`,
    `globalTabplacement`, `useSideMargin`, `useUTCDate`, `autoLoadRemoteImages`,
    `autoRefresh`, `configAutoRefreshInterval`, `userOauth2SessionState_fb`,
    `userOauth2SessionClientID_fb`, `LocalAddressCache`, `vueuse-color-scheme`.
  - sessionStorage: `sendMailModel`, `addressPassword`, `adminTab`, `userTab`,
    `indexTab`, `userOauth2SessionState`, `userOauth2SessionClientID`.
- Routes and aliases: `/`, `/user`, `/redeem`, `/user/oauth2/callback`,
  `/admin`, `/telegram_mail`, each also under `/:lang/...`, and `?jwt=` handling.

### 8.2 Landing / mailbox login (`Login.vue`, `AddressBar.vue`)

- `.n-form:visible` (first) is the sign-in form. It contains the button
  `Log In to Mailbox`. Its first `input` is the email; also
  `input[type="password"]`, or a `textarea` in credential mode.
- Buttons `Credential Login` / `Password Login` (exact) toggle the mode and are
  absent in password-only/disabled modes.
- The button `Create Email Address` (exact) in the sign-in pane switches to
  the register pane. **The tab headers must not have role `button`** (that
  would break strict matching). Default tab = sign-in.
- Register: `.n-tab-pane:visible form`; `.n-input-group .n-input input`
  (exactly one in normal mode); `.n-input-group .n-select` (no inner `input`);
  radios `Normal Domain`, `Use Random Subdomain`, `Use Custom Subdomain`
  (role radio, and the text is clickable); the custom subdomain input is the
  last `.n-input-group:visible .n-input input`; the submit button is `Create
  Email Address`; the `Generate Fake Name` button (absent when custom names are
  disabled).
- After creation: `.n-modal` with
  `data-testid="address-credential-address|address-credential-password|address-credential-jwt|address-token-expires-at"`,
  `.credential-collapse`, the heading `Session Token` (password-only mode),
  and the address inside a `code` element.
- `data-testid="redeem-entry"` (sign-in) and `redeem-entry-register`. Both
  are absent when redeem codes are disabled.
- Warning text `Mail address credential is invalid or account not exist, it
  may be network connection issue, please try again later.` is visible when
  settings fail.

### 8.3 Address bar / manage modal

- `.address-select` (the n-select root) contains the address and `.n-tag`
  login-method tags. Options are `.n-base-select-menu:visible
  .n-base-select-option` with `.n-tag` text `Password Login` / `Credential Login`.
- `.address-manage` button → `.n-modal` with `.n-data-table-tbody
  .n-data-table-tr`, the column header `Login Method`, row buttons
  `Unbind Mail Address credential` and `Change Mail Address`, the confirm button
  `Confirm`, the segment tab texts `Address` (`.n-tabs-tab` /^Address$/) and
  `Create or Bind`, and inside the latter `Credential Login`, `textarea` and
  `Log In to Mailbox`.

### 8.4 Mailbox tabs and settings

- `.n-tabs-tab` with exact text `Mailbox Settings`.
- Exact, unique, **visible without opening any menu at 320px and up**:
  `Send Mail` (localized, for example `Enviar correo`) and `Webhook Settings`
  (webhook-presets uses a non-exact match; keep it unique).
- In Mailbox Settings: the button `Credentials & Connection Methods` or `View
  Session Token`; the button `Change Mailbox Password`, which opens a
  `.n-modal` dialog with two `input[type="password"]` fields and a submit
  button of the same name.
- Simple mode: the button `Mailbox Settings` (exact), then `View Session Token`.

### 8.5 Inbox list and reader

- Classes: `.mail-summary`, `.mail-summary-sender`, `.mail-summary-subject`,
  `.mail-summary-preview` (`.n-ellipsis`), `.mail-summary-date` (format
  `yy/MM/dd`, `title` includes UTC when `useUTCDate`),
  `.mail-summary-recipient` (admin only), `.mail-list-unread`,
  `.mail-list-scroll`, `.mail-list-compact`, `.n-list-item.overlay`, `.n-split`.
  The DOM order is sender → (recipient) → subject → preview.
- All pinned CSS values in section 1.5.
- At 1360px with `mailboxSplitSize=0.2`, the `.mail-list-scroll` width is
  under 320px. Do not add a min-width of 320px or more to the list pane.
- The button `Multi Action` (exact; desktop), and the row `checkbox` in multi
  mode.
- Reader: `.mail-content-renderer`, `.mail-details`, `.mail-address-label`
  (first = `From`), `.mail-details-footer` (date, includes `UTC`, never
  `ID:`), no `.n-tag` inside `.mail-details`.
- Reader buttons with exact names: `Reply`, `Forward`, `Attachments` (contains
  a `.n-badge-sup` with `title` = count and `.n-base-slot-machine-current-number`,
  with no "(" in the text), `More actions` (aria-label; visible text `More`;
  `aria-expanded`), `Delete` (text `Delete`).
- Popover, in this order and with this focus behaviour: link `Download Mail`
  (`download` attribute ends with `.eml`, `href` is `blob:`), `Mark as
  Unread`/`Mark as Read` (with `n-button--loading`), `Show Text Mail`/`Show
  HTML Mail`, `Fullscreen`, `Mail details`. Esc closes it and refocuses `More
  actions`. Space/Enter opens it and focuses `Download Mail`.
- `.mail-details-modal` with heading `Mail details` and
  `.n-descriptions-table-content__label` texts. `.fullscreen-mail-content` in
  a drawer closed by `.n-drawer-header__close`. `.mail-text`, `.mail-html`,
  `.mail-iframe`, `.mail-document`, `.mail-boundary`.
- The attachments dialog `.n-dialog[role="dialog"]` contains filenames and
  download `link`s.
- The desktop reader subject is exposed with role heading (the `n-card`
  title).
- zh labels: `更多操作`, `邮件详情`, `附件`.

### 8.6 Compose

- Heading `Compose email` = `.composer-title h2`. `.composer-title` contains
  the address.
- `.composer-form .n-grid input` ids, in order: `send-mail-sender-address`,
  `send-mail-sender-name`, `send-mail-recipient-address`,
  `send-mail-recipient-name`. Admin uses the `admin-send-mail-*` equivalents.
- Textboxes named `/^Recipient address/` and `/^Subject/`. `.compose-textarea`
  (its textarea and `.n-input__placeholder` must stay aligned). The radio text
  `HTML`. Buttons `Preview` / `Edit` / `Send`. `.compose-preview`. The draft
  text `Draft saved in this browser`. The `Preview` button stays within a
  320px viewport.
- User: `.address-picker-select`.
- Reply/forward fill the compose `textarea` (sanitized).

### 8.7 Sent

- `.n-thing-header__title` per sent item.
- On the user page after sending, `.n-tabs-tab--active` has text exactly `Sent`
  (no icons with text, no counters).

### 8.8 Webhook (index and admin)

- `data-testid="filter-editor"` and all FilterEditor internals.
- The `.n-card` that has the `Save` button contains `role=switch`.
- The `Presets` button opens `.n-dropdown-option`s.
- Buttons `Test` and `Check only`, and their dialogs.
- `.n-form-item` with label `URL`.

### 8.9 User page

- `getByText(user.email)` resolves to exactly one visible element.
- Tab texts `Inbox` (exact), `Send Mail` (exact), `User Settings` (non-exact;
  must be unique), and `Sent` (active-tab assertion).
- Mailbox Management:
  - `.n-pagination` (first on page) shows `Total: N`.
  - `.n-data-table-tbody .n-data-table-tr`.
  - `data-testid="user-address-search"`.
  - The row button `Address Credential` opens a dialog closable through a button
    named `close`.
- Inbox tab: the first `.n-input-group .n-select` on the pane is the address
  filter.
- User Settings:
  - `Create Passkey` opens a `.n-dialog` with a textbox and a button of the
    same name.
  - `Show Passkey List` opens a card modal whose header contains that text.
  - `Logout` opens a `.n-dialog` containing a `Logout` button.
- Signed out: the button `Login with Passkey`.

### 8.10 Admin

- `adminTab` values `account`, `mails`, `qucickSetup`, `statistics` and
  `redeemCodes` are still pane names.
- Top-level labels are visible without any menu at 390px: `Emails` (and its
  localized versions), `快速设置`.
- These must be unique at any moment (two-level tabs, only the active pane
  renders): `Emails`, `Mail Webhook`, `Global Mailbox Settings`, `Send Mail`,
  `.n-tabs-tab` `Create Email Address` and `Mailboxes`.
- `Redemption Codes` is absent when disabled.
- `管理员密码` (the admin password modal) is not rendered before settings load.
- Internals stay untouched: `.storage-panel`, `.plan-select .n-select`,
  `.dashboard`, `.totals`, `Time range`, `Last 30 days`, `Refresh`;
  CreateAccount `.n-card` with the radios `Single creation`/`Batch creation`;
  the `Batch count` textbox; `Create batch`, `Export CSV`, `Clear results`;
  `redeem-admin-create|count|role|search|export|filter-type`; `Config`;
  `.n-form-item` switches.

### 8.11 Redeem page

- Test ids: `redeem-code-input`, `redeem-code-link`, `redeem-now`,
  `redeem-user-email`, `redeem-target-address`, `redeem-address-name`,
  `redeem-result`.
- Buttons: `Look up code`, `Confirm redemption`, `Redeem another code`,
  `View redemption result`, `Redeem mailbox`.
- Headings: `Role benefits`, `Redemption complete`, `Custom mailbox`.
- Texts: `Used`, `Unused`.

---

## 9. Implementation plan

Each phase is one PR (Conventional Commit, English, squash). After every phase:

- `cd frontend && pnpm test && pnpm build` passes.
- `cd e2e && npm test` (Docker; then `npm run test:down`) is fully green.
- The PR has before/after screenshots: light + dark, at 1280px and 390px.
- No change to `frontend/index.html`.

### Phase 1: Global theme

- Add `src/theme/tokens.ts`, `src/theme/index.ts` and `src/styles/base.css`
  (1.2–1.4). Import base.css in `main.js`.
- App.vue: pass `:theme-overrides`, add the CSS-var `watchEffect`, move the iOS
  input rule to base.css, delete the global `.n-switch` margin rule.
- Replace hard-coded accents: `Redeem.vue` (8×) and `SimpleIndex.vue` (the
  unread dot).

Acceptance:

- Primary buttons, tab bars, focus rings and the unread dot are blue
  `#2563EB` in light and `#60A5FA` in dark. Radii are 8px (controls) and 12px
  (cards/dialogs).
- `inbox.spec.ts`, `mail-read.spec.ts` and `mail-body-colors.spec.ts` pass
  unchanged. The pinned values in 1.5 still hold.
- `getComputedStyle(document.documentElement).getPropertyValue('--app-accent')`
  returns the correct value per theme, including inside an open drawer.

### Phase 2: Shell (App, Header, Footer, Preferences)

- Build the App.vue shell (2.1), Header (2.2), PreferencesDrawer + Appearance
  restyle (2.3) and Footer (2.4).
- Remove the Index `appearance`/`about` panes and the Admin `appearance`/`about`
  panes, together with the drawer and footer that replace them. Add the
  `indexTab`/`adminTab` guards from 3.3 and 5.
- Add the i18n keys `views.Header.preferences` and
  `views.common.Appearance.section*`.

Acceptance:

- Header is 56px and sticky. Desktop shows nav + language + theme +
  preferences. Mobile shows only theme + menu.
- Every Appearance control works from the drawer on `/`, `/user` and `/admin`.
  The simple-index switch appears only on `/` with an address.
- The footer shows About when `ENABLE_INDEX_ABOUT` is set, and always on
  `/admin`. GitHub appears per the `showGithub*` settings, and Status when
  `STATUS_URL` is set.
- `useSideMargin` off → full width. Ads still render when configured.
- `locale-switch.spec.ts` and `mail-body-colors.spec.ts` (`Light`/`Dark`
  buttons) pass.
- A stored `sessionStorage.indexTab='appearance'` lands on the Inbox.

### Phase 3: Mailbox entry and settings

- Landing (3.1), address bar (3.2), Index tabs (3.3), AccountSettings +
  AutoReply + Attachment (3.8), webhook card tweak (3.9), manage modals
  (3.11).
- Add the AddressBar, Login and AccountSettings i18n keys.

Acceptance:

- Landing panel is centred, 480px wide. "Log In to Mailbox" is the only solid
  button on the sign-in pane.
- Address bar: Copy is the only solid button. The ⋮ menu offers Credentials
  and Simple Mode.
- Index shows at most 5 tabs. Auto Reply and S3 are collapsible in Mailbox
  Settings and fetch only when expanded. The danger zone shows only with
  `ENABLE_USER_DELETE_EMAIL`.
- Specs pass: `mailbox-login.spec.ts`, `mailbox-login-entry.spec.ts`,
  `custom-subdomain.spec.ts`, `redeem-code.spec.ts`,
  `webhook/*.spec.ts` (index webhook path).
- No horizontal scroll at 320px on the landing page or the address bar.

### Phase 4: Inbox, reader, sent, compose, simple mode, Telegram, Redeem

- MailBox toolbar, split, selection bar, empty states and mobile drawer (3.4);
  reader polish (3.5); SendBox (3.6); composer card (3.7); SimpleIndex
  (3.10); Telegram mail (3.13); Redeem visuals (3.12).
- Add the MailBox i18n keys.

Acceptance:

- An empty mailbox shows the `.empty-state`, with icon, title, hint and
  Refresh, instead of the split.
- The selected row shows the grey fill plus the 3px accent bar.
- Sent rows show one muted meta line instead of 4 tags.
- Specs pass: `inbox.spec.ts` (all 4 layouts, attachments, admin
  summaries), `mail-read.spec.ts`, `reply-html.spec.ts`,
  `send-mail-compose.spec.ts`, `mail-body-colors.spec.ts`.
- Manual check: Telegram build (`pnpm build:telegram`) renders the mail view
  with no tags.

### Phase 5: User page

- UserBar, UserLogin, User.vue tabs (remove `bind_address` with its redirect,
  delete `BindAddress.vue`), UserSettings panels, UserMailBox and UserSendBox
  toolbars (section 4).
- Add the UserSettings i18n keys.

Acceptance:

- Signed in: an account bar, then 5 line tabs. Signed out: the landing-style
  panel with Login as the only solid button.
- Linking an address works from Mailbox Management → Create or Bind.
- Specs pass: `passkey.spec.ts`, `user-send-mail.spec.ts`,
  `user-address-pagination.spec.ts`, `user-access-token.spec.ts`.

### Phase 6: Admin

- Admin.vue tab types, the adminTab guard, the adminAccount panel, and the
  centring fixes after the App.vue change (section 5).

Acceptance:

- Top-level line tabs; sub-tabs are small bars, left-aligned.
- Every admin view renders left-aligned with no layout regressions. Click
  through every pane in light and dark at 1280px and 390px.
- Specs pass: `admin/*.spec.ts`, `email-forwarding.spec.ts`,
  `webhook-filter.spec.ts`, `webhook-test.spec.ts`, and the admin part of
  `redeem-code.spec.ts` / `inbox.spec.ts` / `send-mail-compose.spec.ts`.

### Phase 7: Docs, changelog, final QA

- Add a `CHANGELOG.md` (中文) and `CHANGELOG_EN.md` entry under `v1.14.0(main)`.
  For example:
  - `- feat: |UI| 重新设计前端界面：统一主题色与间距，邮箱页精简为地址栏 + 收件箱，外观设置移至偏好设置抽屉，关于/GitHub/状态移至页脚，自动回复与 S3 附件并入邮箱设置`
  - `- feat: |UI| Redesign the frontend: unified accent and spacing, mailbox page reduced to address bar + inbox, appearance moved to a Preferences drawer, About/GitHub/Status moved to the footer, Auto Reply and S3 attachments merged into Mailbox Settings`
- Docs: there are no new env vars or APIs. Grep `vitepress-docs/docs/{zh,en}`
  for UI navigation instructions that mention the moved tabs (Appearance,
  About, Auto Reply, S3 Attachment, Link Email Address, Simple Mode) and update
  both languages if any exist. None were found when this spec was written.
- QA matrix: {light, dark} × {1280, 768, 390, 320} × {en, zh} × {`/`, `/user`,
  `/admin`, `/redeem`}, plus the Telegram build. Check for horizontal scroll,
  focus rings, and that every row of section 6 is reachable.

---

## 10. Non-goals

- No changes to the worker or API, and no new settings or env vars.
- No new component library, CSS framework, web fonts or icon packs.
- No redesign of admin child views' internals (forms, tables, dashboards).
  They inherit the tokens only.
- No change to mail HTML rendering (`ShadowHtmlComponent`, remote-content
  policy, sanitizer).
