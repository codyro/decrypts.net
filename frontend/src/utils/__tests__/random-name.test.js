import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { randomEmailLocalPart } from '../random-name'

const srcDir = fileURLToPath(new URL('..', import.meta.url))

function collectSourceFiles(dir) {
    const files = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...collectSourceFiles(full))
        } else if (/\.(vue|js|ts)$/.test(entry.name)) {
            files.push(full)
        }
    }
    return files
}

describe('remote dynamic imports', () => {
    it('no frontend source file imports a remote http(s) module', () => {
        const offenders = collectSourceFiles(srcDir)
            .filter(file =>
                /import\(\s*['"]https?:/.test(readFileSync(file, 'utf8'))
            )
            .map(file => relative(srcDir, file))
        expect(offenders).toEqual([])
    })
})

describe('randomEmailLocalPart', () => {
    it('returns a non-empty email local part', async () => {
        const name = await randomEmailLocalPart()
        expect(typeof name).toBe('string')
        expect(name.length).toBeGreaterThan(0)
        expect(name).not.toContain('@')
    })
})
