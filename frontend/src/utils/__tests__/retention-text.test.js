import { describe, expect, it } from 'vitest'

import { buildRetentionSentences } from '../retention-text'
import { getMessageSource } from '../../i18n/message-registry'

// Minimal stand-in for the vue-i18n `t(key, count, values)` overload used by
// buildRetentionSentences: picks the plural form exactly like vue-i18n's
// default rule (choice === 1 -> first form), then interpolates {placeholders}.
const makeT = (locale) => (key, count, values) => {
    const message = getMessageSource('utils.retentionText', key, locale)
    if (message === undefined) throw new Error(`missing message: ${key}`)
    const forms = message.split('|').map((form) => form.trim())
    const form = count === 1 ? forms[0] : (forms[1] ?? forms[0])
    return form.replace(/\{(\w+)\}/g, (_, name) => String(values[name]))
}

describe('buildRetentionSentences', () => {
    it('returns no sentences for null, undefined and empty input', () => {
        for (const locale of ['en', 'zh']) {
            const t = makeT(locale)
            expect(buildRetentionSentences(null, t)).toEqual([])
            expect(buildRetentionSentences(undefined, t)).toEqual([])
            expect(buildRetentionSentences({}, t)).toEqual([])
        }
    })

    it('builds the mails-only example in en and zh', () => {
        expect(buildRetentionSentences({ mailsDays: 7 }, makeT('en'))).toEqual([
            'Mail is deleted automatically after 7 days.',
        ])
        expect(buildRetentionSentences({ mailsDays: 7 }, makeT('zh'))).toEqual([
            '邮件会在 7 天后被自动删除。',
        ])
    })

    it('handles singular and plural day counts', () => {
        expect(buildRetentionSentences({ mailsDays: 1 }, makeT('en'))).toEqual([
            'Mail is deleted automatically after 1 day.',
        ])
        expect(buildRetentionSentences({ mailsDays: 1 }, makeT('zh'))).toEqual([
            '邮件会在 1 天后被自动删除。',
        ])
        expect(buildRetentionSentences({ sendboxDays: 1 }, makeT('en'))).toEqual([
            'Sent mail is kept for 1 day.',
        ])
        expect(buildRetentionSentences({ sendboxDays: 2 }, makeT('en'))).toEqual([
            'Sent mail is kept for 2 days.',
        ])
    })

    it('builds the mails + inactive addresses example in en and zh', () => {
        const retention = { mailsDays: 7, inactiveAddressDays: 30 }
        expect(buildRetentionSentences(retention, makeT('en'))).toEqual([
            'Mail is deleted automatically after 7 days.',
            'Addresses unused for 30 days are removed.',
        ])
        expect(buildRetentionSentences(retention, makeT('zh'))).toEqual([
            '邮件会在 7 天后被自动删除。',
            '超过 30 天未使用的地址会被移除。',
        ])
    })

    it('covers every rule, skipping unknownMailsDays and non-positive days', () => {
        const retention = {
            mailsDays: 7,
            unknownMailsDays: 3,
            sendboxDays: 14,
            inactiveAddressDays: 30,
            addressDays: 90,
            unboundAddressDays: 1,
        }
        expect(buildRetentionSentences(retention, makeT('en'))).toEqual([
            'Mail is deleted automatically after 7 days.',
            'Sent mail is kept for 14 days.',
            'Addresses unused for 30 days are removed.',
            'Addresses are removed 90 days after creation.',
            'Addresses not linked to an account are removed after 1 day.',
        ])
    })

    it('ignores zero and negative day counts', () => {
        expect(buildRetentionSentences({ mailsDays: 0 }, makeT('en'))).toEqual([])
        expect(buildRetentionSentences({ mailsDays: -5, addressDays: 0.5 }, makeT('en'))).toEqual([
            'Addresses are removed 0.5 days after creation.',
        ])
    })
})
