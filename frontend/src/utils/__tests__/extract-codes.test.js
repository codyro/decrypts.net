import { describe, it, expect } from 'vitest';
import { extractCodesAndLinks, stripMailHtml } from '../extract-codes';

describe('extractCodesAndLinks - codes', () => {
    it('extracts a numeric code after an English keyword', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'Your login code',
            text: 'Enter the following verification code to sign in:\n\n482913\n\nIt expires in 10 minutes.'
        });
        expect(codes).toContain('482913');
    });

    it('extracts a code from the subject when the subject carries a keyword', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'Temp Email verification code: 724818',
            text: 'Use the code in the subject to continue.'
        });
        expect(codes).toContain('724818');
    });

    it('extracts a code from a subject that is only the code', () => {
        const { codes } = extractCodesAndLinks({ subject: '482913', text: 'Your code is in the subject.' });
        expect(codes).toContain('482913');
    });

    it('extracts Chinese keyword codes (验证码/校验码/动态码)', () => {
        const { codes } = extractCodesAndLinks({
            subject: '【示例服务】登录验证码',
            text: '您的动态码为482913，请在5分钟内输入。校验码请勿泄露。'
        });
        expect(codes).toContain('482913');
    });

    it('extracts full-width digit codes', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'verification',
            text: '您的验证码是：４８２９１３'
        });
        expect(codes).toContain('482913');
    });

    it('extracts alphanumeric codes near a keyword', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'GitHub OTP',
            text: 'Your one-time passcode is K7D2X9.'
        });
        expect(codes).toContain('K7D2X9');
    });

    it('dedupes repeated codes and caps the result', () => {
        const text = Array.from({ length: 10 }, (_, i) => `code: ${100000 + i}`).join('\n');
        const { codes } = extractCodesAndLinks({ subject: '', text });
        expect(codes.length).toBe(5);
        expect(new Set(codes).size).toBe(codes.length);
    });

    it('rejects codes without any keyword nearby', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'Your invoice',
            text: 'Order 123456 has been shipped. Tracking 48291392. See you soon.'
        });
        expect(codes).toEqual([]);
    });
});

describe('extractCodesAndLinks - false positives', () => {
    it('rejects standalone years 1900-2099', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'Verify your code',
            text: 'Your subscription renews in 2025.\nVerification code: 7311'
        });
        expect(codes).not.toContain('2025');
        expect(codes).toContain('7311');
    });

    it('rejects years even when a keyword is on the same line', () => {
        const { codes } = extractCodesAndLinks({
            subject: '',
            text: 'Code coverage report for 2024 is attached.'
        });
        expect(codes).not.toContain('2024');
    });

    it('rejects times, dates and chained numbers even with a keyword on the line', () => {
        const { codes } = extractCodesAndLinks({
            subject: '',
            text: [
                'Code review moved to 18:30 on 2026/01/02.',
                'Call 1-800-555-1234 and mention your PIN code for help.',
                'Your balance of $19.99 needs a code word.'
            ].join('\n')
        });
        expect(codes).toEqual([]);
    });

    it('rejects CSS colour hex values', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'Your PIN code',
            html: '<div style="color:#A1B2C3">Your PIN code is 4829</div>'
        });
        expect(codes).not.toContain('A1B2C3');
        expect(codes).toContain('4829');
    });

    it('rejects letters-only words near keywords', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'Verification required',
            text: 'This code word should not be picked up.'
        });
        expect(codes).toEqual([]);
    });

    it('rejects long digit runs (order / tracking numbers)', () => {
        const { codes } = extractCodesAndLinks({
            subject: 'code',
            text: 'Order 1234567890 was confirmed.'
        });
        expect(codes).toEqual([]);
    });
});

describe('extractCodesAndLinks - links', () => {
    const html = `
        <p>Hi,</p>
        <a href="https://example.com/verify-email?token=abc123">Verify your email</a>
        <a href="https://example.com/activate?u=1">激活账户</a>
        <a href="https://example.com/unsubscribe">Unsubscribe</a>
        <a href="https://example.com/login">Sign in</a>
        <a href="http://example.com/reset-password">Reset password</a>
        <a href="mailto:support@example.com">Mail us</a>
    `;

    it('keeps only http(s) verify/confirm/activate/sign-in/reset links', () => {
        const { links } = extractCodesAndLinks({ subject: '', text: '', html });
        const urls = links.map((link) => link.url);
        expect(urls).toContain('https://example.com/verify-email?token=abc123');
        expect(urls).toContain('https://example.com/activate?u=1');
        expect(urls).toContain('https://example.com/login');
        expect(urls).toContain('http://example.com/reset-password');
        expect(urls).not.toContain('https://example.com/unsubscribe');
        expect(urls).not.toContain('mailto:support@example.com');
    });

    it('captures anchor text as the label', () => {
        const { links } = extractCodesAndLinks({ subject: '', text: '', html });
        const verify = links.find((link) => link.url.includes('verify-email'));
        expect(verify.label).toBe('Verify your email');
    });

    it('dedupes repeated links and caps the result', () => {
        const dup = Array.from({ length: 8 },
            (_, i) => `<a href="https://a.example/verify?x=${i}">verify</a>`).join('');
        const { links } = extractCodesAndLinks({ subject: '', text: '', html: dup });
        expect(links.length).toBe(4);
        expect(new Set(links.map((link) => link.url)).size).toBe(links.length);
    });

    it('finds bare verification URLs in plain-text mails', () => {
        const { links } = extractCodesAndLinks({
            subject: '',
            text: 'Open https://example.com/confirm?token=zzz1 to confirm your account.'
        });
        expect(links.map((link) => link.url)).toContain('https://example.com/confirm?token=zzz1');
    });

    it('ignores ordinary links in text and html', () => {
        const { links } = extractCodesAndLinks({
            subject: '',
            text: 'Read the docs at https://example.com/docs/guide.',
            html: '<a href="https://example.com/pricing">Pricing</a>'
        });
        expect(links).toEqual([]);
    });
});

describe('stripMailHtml', () => {
    it('removes tags and decodes entities', () => {
        expect(stripMailHtml('<p>a&nbsp;&amp;&lt;b&gt;</p>')).toBe(' a &<b> ');
    });
});
