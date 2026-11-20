import { describe, expect, it } from 'vitest'

import { darkTokens, lightTokens } from '../tokens'

// WCAG 2.x relative luminance and contrast ratio, computed from sRGB hex.
const channel = (value: number) => {
  const v = value / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

const luminance = (hex: string): number => {
  const c = hex.replace('#', '')
  return (
    0.2126 * channel(parseInt(c.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(c.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(c.slice(4, 6), 16))
  )
}

const contrast = (foreground: string, background: string): number =>
  (Math.max(luminance(foreground), luminance(background)) + 0.05) /
  (Math.min(luminance(foreground), luminance(background)) + 0.05)

// WCAG AA: 4.5:1 for normal-size text (all of these tokens render at < 18pt).
const AA = 4.5

const assertAa = (foreground: string, background: string, label: string) => {
  const ratio = contrast(foreground, background)
  expect(ratio, `${label}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(AA)
}

describe('theme tokens meet WCAG AA contrast', () => {
  for (const [name, tokens] of [['light', lightTokens], ['dark', darkTokens]] as const) {
    describe(`${name} mode`, () => {
      it('text1 passes AA on bg and surface', () => {
        assertAa(tokens.text1, tokens.bg, `${name} text1/bg`)
        assertAa(tokens.text1, tokens.surface, `${name} text1/surface`)
      })

      it('text2 passes AA on bg and surface', () => {
        assertAa(tokens.text2, tokens.bg, `${name} text2/bg`)
        assertAa(tokens.text2, tokens.surface, `${name} text2/surface`)
      })

      it('text3 (captions/meta) passes AA on bg and surface', () => {
        assertAa(tokens.text3, tokens.bg, `${name} text3/bg`)
        assertAa(tokens.text3, tokens.surface, `${name} text3/surface`)
      })

      it('accent passes AA on bg (links, nav, tabs)', () => {
        assertAa(tokens.accent, tokens.bg, `${name} accent/bg`)
        assertAa(tokens.accent, tokens.surface, `${name} accent/surface`)
      })

      it('primary button text passes AA on the accent fill', () => {
        assertAa(tokens.onAccent, tokens.accent, `${name} onAccent/accent`)
      })
    })
  }
})
