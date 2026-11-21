# Change: Phosphor terminal retro theme

Status: implemented
Scope: `frontend/` only (Vue 3 + Naive UI 2.45). Styling, tokens, theme overrides
and self-hosted fonts. No feature, route, store-key or API changes.

## Direction

The fork gets its own visual identity: a refined CRT-terminal look ("Phosphor")
for decrypts.net — a temporary email service with optional per-mailbox
encryption, so a crypto/terminal feel fits. Calm, high-contrast, precise; retro
but sleek. The existing redesign principles are unchanged: one primary button
per view, no card-in-card, progressive disclosure, mobile first-class.

Dark mode is the hero look (near-black tube, amber phosphor). Light mode is
"printout paper": warm paper, near-black ink, burnt-amber accent.

## Palette

All colours live in `frontend/src/theme/tokens.ts` (single source of truth;
`App.vue` writes them as `--app-*` CSS custom properties). Contrast ratios are
computed with the WCAG relative-luminance formula and pinned by
`frontend/src/theme/__tests__/contrast.test.ts` (AA = 4.5:1).

### Dark (phosphor)

| Token | Value | Contrast on `bg` `#0B0B0C` | Contrast on `surface` `#141416` |
|---|---|---|---|
| `bg` | `#0B0B0C` | — | — |
| `surface` | `#141416` | | |
| `surfaceSubtle` | `#1A1A1D` | | |
| `surfaceRaised` | `#1F1F23` | | |
| `popover` | `#232327` | | |
| `border` | `rgba(237, 230, 214, 0.14)` (warm hairline) | | |
| `divider` | `rgba(237, 230, 214, 0.08)` | | |
| `text1` | `#EDE6D6` (warm off-white) | 15.82 | 14.80 |
| `text2` | `#D6CDB8` | 12.45 | 11.64 |
| `text3` | `#A79D87` (warm grey) | 7.32 | 6.85 |
| `accent` | `#FFB000` (amber phosphor) | 10.74 | 10.04 |
| `accentHover` | `#FFC145` | | |
| `accentPressed` | `#E09E00` | | |
| `accentSoft` / `accentSoftHover` | `rgba(255,176,0,.12)` / `.18` | | |
| `onAccent` (primary button text) | `#0B0B0C` | on accent: **10.74** | |
| `warning` | `#FF7847` (hot orange, distinct from amber) | 7.52 | 7.03 |
| `danger` | `#E47373` (soft red) | 6.56 | 6.13 |

### Light (soft graphite on warm-grey paper)

The light palette was softened after feedback that the original "printout
paper" theme was tiring to read: the yellow/sepia cast, near-black glare,
panels brighter than the page, and saturated burnt-amber accent all added
visual noise. It was retuned to a near-neutral warm off-white page with
graphite ink (10–13:1), panels at or below page brightness, hairline warm-grey
borders, and a deeper, less saturated amber — the retro-terminal identity
(glyphs, mono chrome) is unchanged.

| Token | Value | Contrast on `bg` `#F2F1ED` | Contrast on `surface` `#EFEEEA` |
|---|---|---|---|
| `bg` | `#F2F1ED` (near-neutral warm off-white) | — | — |
| `surface` | `#EFEEEA` (a hair below page brightness) | | |
| `surfaceSubtle` | `#E9E8E3` | | |
| `surfaceRaised` / `popover` | `#F7F6F3` (only elevation is lighter) | | |
| `border` | `#D8D6CF` (neutral warm grey hairline) | | |
| `divider` | `#E2E1DB` | | |
| `text1` | `#36322B` (warm charcoal) | 11.27 | 10.98 |
| `text2` | `#504D45` | 7.47 | 7.27 |
| `text3` | `#6E6A60` | 4.77 | 4.65 |
| `accent` | `#835310` (deep, muted amber) | 5.79 | 5.64 |
| `accentHover` | `#75490C` | 6.84 | 6.66 |
| `accentPressed` | `#68410A` | | |
| `accentSoft` / `accentSoftHover` | `rgba(131,83,16,.07)` / `.12` | | |
| `onAccent` (primary button text) | `#F7F6F2` | on accent: **6.05** | |
| `warning` | `#9C4A1A` (hot orange, distinct hue from amber) | 5.45 | 5.31 |
| `danger` | `#9E3B46` | 5.87 | 5.71 |

Light mode also softens the terminal-caps letter-spacing on section/panel
titles (`html:not(.dark)` only) and uses a lighter `shadowRaised`; dark mode
is untouched.

Note on the primary button: the brief asks for "solid accent with dark text".
That is literally possible only where the accent is light enough; on paper, a
burnt-amber fill with dark ink would be 2.88:1 (fails AA). So dark mode keeps
the signature near-black label on the amber fill (10.74:1), and light mode uses
paper-white on burnt amber (5.43:1). Both are "solid accent, high-contrast
label"; the dark-text signature lives where it is accessible.

Warning vs accent: in both modes warning is a hotter, redder orange than the
amber accent so alerts never read as interactive elements.

## Type system

Self-hosted via npm (bundled same-origin, latin subset only — no remote font
requests, CSP unchanged: `font-src 'self' data:` already allows it):

- `@fontsource/ibm-plex-mono` — latin 400/500/600
- `@fontsource/ibm-plex-sans` — latin 400/500/600

| Use | Face |
|---|---|
| Headings (page/section/panel titles), section labels, nav, tabs, buttons, pagination | IBM Plex Mono |
| Mailbox address, mail list metadata (sender/date/recipient), codes, data-table cells | IBM Plex Mono |
| Running text (descriptions, form help, About body) | IBM Plex Sans |
| CJK and other scripts | system fallbacks (`PingFang SC`, `Microsoft YaHei`, …) |

Naive UI `fontFamily` / `fontFamilyMono` overrides are set from the same
stacks. Payload: 12 font files in `dist` (6 faces × woff + woff2), 120 KB
woff2 + 120 KB woff legacy fallback; browsers fetch one format per face.

## Shape

Small radius: `--radius-sm: 2px` (chips/tags), `--radius-md: 4px`,
`--radius-lg: 6px` (panels/cards); Naive overrides match (buttons 4px,
tags 2px, cards/dialogs 6px). Hairline 1px borders throughout. Section titles
are uppercase mono with 0.06–0.08em letter-spacing.

## Signature details

- `>_` prompt glyph before the header wordmark (CSS `::before`, not i18n text).
- Terminal block glyph `▍` before `.section-title` / `.panel-title`
  (accent-coloured, `::before` pseudo-element). The danger-zone title re-colours
  its glyph to the danger token.
- Blinking block cursor after the mailbox address in the hero
  (`@keyframes app-blink`), accent-coloured.
- Faint phosphor glow (`text-shadow: 0 0 14px rgba(255,176,0,.4)`) on the header
  wordmark and on the hero address — dark mode only (`html.dark`).
- Extremely faint scanline texture (3%-alpha amber `repeating-linear-gradient`,
  no images) over the landing hero and the mailbox address bar — dark mode only.
- Buttons: primary = solid accent + `onAccent` label; secondary/tertiary keep
  Naive outlined/text styles now in mono; focus rings are Naive's accent
  outline. Links are accent with an underline on hover.
- Mail list: compact rows with mono metadata; unread keeps its accent dot;
  the encrypted/locked padlock is accent-tinted so it reads as a native state.
- Everything animated (cursor blink, split-handle transition, Naive fades)
  collapses under `prefers-reduced-motion: reduce`.

## Deliberately left alone

- **Mail content.** `ShadowHtmlComponent` / `MailContentRenderer` keep their
  own styles; no mono/colour bleeds into sender HTML (the v-html fallback
  renders in the light DOM, so the theme link rule explicitly excludes
  `.mail-content-renderer a` and the teleported `.fullscreen-mail-content a`).
  Plain-text bodies keep their existing styles.
- **`frontend/src/views/common/About.vue`** — tokens and fonts restyle it
  automatically; no edits (parallel change landing there).
- Features, routes, store keys, API calls, i18n keys: unchanged.
- CSP: unchanged (`font-src 'self' data:` already permitted self-hosted fonts).

## Meta / PWA

- `frontend/index.html`: `theme-color` set per mode (light `#F2F1ED`, dark
  `#0B0B0C`; the previous values were inverted).
- `frontend/vite.config.js` PWA manifest: `theme_color` and `background_color`
  `#0B0B0C` (manifest supports a single value; the dark tube is the hero look).
- Light/dark/auto preference mechanism untouched (`useDark`).

## Verification

- `pnpm test`: 243 unit tests pass, including a new WCAG AA contrast test that
  computes relative luminance and asserts text1/text2/text3 on bg+surface,
  accent on bg+surface, and the primary-button text on the accent for both
  themes.
- `pnpm build` and `pnpm build:pages`: pass; 12 font files, 240 KB total in dist.
- Browser e2e (Docker, `COMPOSE_PROJECT_NAME=phosphor-e2e`, browser project):
  127/127 pass.
