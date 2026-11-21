import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { buildRetentionSentences } from '../retention-text'
import { I18N_MESSAGES } from '../../i18n/messages'

// Real vue-i18n instance, built the same way as the app (`frontend/src/i18n`),
// so the `t(key, { days }, days)` call in buildRetentionSentences is exercised
// against the actual named-interpolation + plural handling of vue-i18n.
const makeT = (locale) => {
    const t = createI18n({
        legacy: false,
        locale,
        messages: {
            en: { utils: I18N_MESSAGES.en.utils },
            zh: { utils: I18N_MESSAGES.zh.utils },
        },
        missingWarn: false,
        fallbackWarn: false,
    }).global.t
    // mirror useScopedI18n: keys arrive un-namespaced
    return (key, ...args) => t(`utils.retentionText.${key}`, ...args)
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
