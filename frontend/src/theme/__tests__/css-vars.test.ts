import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { toCssVars } from '../index'
import { darkTokens, lightTokens } from '../tokens'

const SRC_DIR = join(__dirname, '..', '..')
const SOURCE_EXTENSIONS = new Set(['.vue', '.css', '.ts', '.js'])

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return walk(path)
    return SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf('.'))) ? [path] : []
  })

// Test files may reference --app-* names as string literals; only scan real sources.
const sourceFiles = walk(SRC_DIR).filter(path => !path.includes('__tests__'))

const usedVars = new Set<string>()
for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf-8')
  for (const match of content.matchAll(/var\(\s*(--app-[a-zA-Z0-9-]+)/g)) {
    usedVars.add(match[1])
  }
}

const definedVars = new Set<string>()
for (const file of sourceFiles.filter(path => /\.(vue|css)$/.test(path))) {
  const content = readFileSync(file, 'utf-8')
  for (const match of content.matchAll(/(--app-[a-zA-Z0-9-]+)\s*:/g)) {
    definedVars.add(match[1])
  }
}

describe('toCssVars', () => {
  it('generates dashed names for digit runs and camelCase', () => {
    const vars = toCssVars(lightTokens)

    expect(vars).toMatchObject({
      '--app-text-1': lightTokens.text1,
      '--app-text-2': lightTokens.text2,
      '--app-text-3': lightTokens.text3,
      '--app-accent-soft': lightTokens.accentSoft,
      '--app-warning': lightTokens.warning,
    })
    expect(vars).not.toHaveProperty('--app-text1')
  })

  it('light and dark token sets expose the same CSS variables', () => {
    expect(Object.keys(toCssVars(darkTokens)).sort())
      .toEqual(Object.keys(toCssVars(lightTokens)).sort())
  })

  it('every var(--app-*) used in sources resolves to a token or a CSS definition', () => {
    const generated = new Set(Object.keys(toCssVars(lightTokens)))
    const unresolved = [...usedVars]
      .filter(name => !generated.has(name) && !definedVars.has(name))
      .sort()

    expect(unresolved).toEqual([])
  })
})
