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

### Light (printout paper)

| Token | Value | Contrast on `bg` `#F4F0E6` | Contrast on `surface` `#FCFAF4` |
|---|---|---|---|
| `bg` | `#F4F0E6` (warm paper) | — | — |
| `surface` | `#FCFAF4` | | |
| `surfaceSubtle` | `#EDE7D8` | | |
| `surfaceRaised` / `popover` | `#FFFFFF` | | |
| `border` | `#D9D2C0` | | |
| `divider` | `#E4DECD` | | |
| `text1` | `#1C1913` (warm near-black ink) | 15.41 | 16.80 |
| `text2` | `#3B362A` | 10.56 | 11.52 |
| `text3` | `#6B6353` | 5.22 | 5.69 |
| `accent` | `#96500A` (burnt amber) | 5.35 | 5.83 |
| `accentHover` | `#7E4306` | 6.85 | — |
| `accentPressed` | `#6E3A05` | | |
| `accentSoft` / `accentSoftHover` | `rgba(150,80,10,.10)` / `.16` | | |
| `onAccent` (primary button text) | `#FCFAF4` | on accent: **5.43** | |
| `warning` | `#B83A08` (hot orange, distinct hue from burnt amber) | 5.06 | 5.52 |
| `danger` | `#A83240` | 5.78 | 6.30 |

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

- `frontend/index.html`: `theme-color` set per mode (light `#F4F0E6`, dark
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
