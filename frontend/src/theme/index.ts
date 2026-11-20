import type { GlobalThemeOverrides } from 'naive-ui'
import { lightTokens, darkTokens, type AppTokens } from './tokens'

export const FONT_FAMILY =
  '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, ' +
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif, ' +
  '"Apple Color Emoji", "Segoe UI Emoji"'
export const FONT_FAMILY_MONO =
  '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'

export const buildThemeOverrides = (t: AppTokens, isDark: boolean): GlobalThemeOverrides => ({
  common: {
    fontFamily: FONT_FAMILY,
    fontFamilyMono: FONT_FAMILY_MONO,
    fontWeightStrong: '600',
    borderRadius: '4px',
    borderRadiusSmall: '2px',
    heightMedium: '36px',
    heightLarge: '42px',
    primaryColor: t.accent,
    primaryColorHover: t.accentHover,
    primaryColorPressed: t.accentPressed,
    primaryColorSuppl: t.accentHover,
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
    ...(isDark ? {} : { textColor3: t.text3 }),
  },
  Card: {
    borderRadius: '6px',
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
    tabBorderRadius: '4px',
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
    borderRadius: '6px',
    padding: '20px 24px',
    titleFontSize: '16px',
    titleFontWeight: '600',
  },
  // Primary buttons are a solid accent fill; the label uses the `onAccent`
  // token so it passes WCAG AA on the accent in both themes.
  Button: {
    textColorPrimary: t.onAccent,
    textColorHoverPrimary: t.onAccent,
    textColorPressedPrimary: t.onAccent,
    textColorFocusPrimary: t.onAccent,
    textColorDisabledPrimary: t.onAccent,
  },
  Alert: { borderRadius: '4px', padding: '12px 16px' },
  DataTable: {
    borderRadius: '4px',
    thColor: t.surfaceSubtle,
    thFontWeight: '600',
    thPaddingMedium: '10px 12px',
    tdPaddingMedium: '10px 12px',
  },
  Tag: { borderRadius: '2px' },
  Collapse: { titleFontSize: '15px', titleFontWeight: '600' },
})

export const tokensFor = (isDark: boolean) => (isDark ? darkTokens : lightTokens)

export const toCssVars = (t: AppTokens) =>
  Object.fromEntries(Object.entries(t).map(([k, v]) =>
    [`--app-${k.replace(/[A-Z]|\d+/g, m => '-' + m.toLowerCase())}`, v]))
