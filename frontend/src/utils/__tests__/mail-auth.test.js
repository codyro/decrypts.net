import { describe, expect, it } from 'vitest';

import {
    analyzeMailSecurity,
    authStatusCategory,
    extractAddress,
    extractDeliveryDetails,
    extractDisplayName,
    getAuthDotStatus,
    getAuthScore,
    parseTlsInfo,
    splitAddressDisplay,
    TRUSTED_AUTHSERV_IDS,
} from '../mail-auth';

const header = (key, value) => ({ key, value });

// A Cloudflare Email Routing style delivery: the trusted receiver prepends
// its own results, a foreign (sender-side) Authentication-Results sits below.
const cloudflareTrusted = [
    header('Received', 'from sender-mail.example (sender-mail.example [192.0.2.10]) by mx.cloudflare.net with ESMTPS id abc123 for <box@decrypts.net>; Mon, 01 Jan 2024 00:00:00 +0000'),
    header('ARC-Authentication-Results', 'mx.cloudflare.net; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com; arc=pass; iprev=pass smtp.remote-ip=192.0.2.10'),
    header('Authentication-Results', 'mx.cloudflare.net; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass header.from=example.com'),
    header('Authentication-Results', 'mail.sender.example; spf=fail smtp.mailfrom=evil.example; dkim=fail header.d=evil.example'),
];

describe('analyzeMailSecurity', () => {
    it('parses all passes from a Cloudflare-style trusted header', () => {
        const security = analyzeMailSecurity(cloudflareTrusted);
        expect(security.authservId).toBe('mx.cloudflare.net');
        expect(security.checks.spf.status).toBe('pass');
        expect(security.checks.dkim.status).toBe('pass');
        expect(security.checks.dmarc.status).toBe('pass');
        expect(security.checks.arc.status).toBe('pass');
        expect(security.checks.iprev.status).toBe('pass');
    });

    it('ignores a forged foreign Authentication-Results below the trusted one', () => {
        const security = analyzeMailSecurity(cloudflareTrusted);
        // The forged header says spf=fail/dkim=fail; the trusted one wins.
        expect(security.checks.spf.status).toBe('pass');
        expect(security.checks.dkim.status).toBe('pass');
    });

    it('reports "not reported" when only a foreign Authentication-Results exists', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mail.sender.example; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass'),
        ]);
        expect(security.authservId).toBeNull();
        expect(security.checks.spf.status).toBe('not reported');
        expect(security.checks.dkim.status).toBe('not reported');
        expect(security.checks.dmarc.status).toBe('not reported');
        expect(security.checks.arc.status).toBe('not reported');
        expect(security.checks.iprev.status).toBe('not reported');
    });

    it('takes the topmost trusted header when several trusted ones exist', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; spf=fail smtp.mailfrom=example.com'),
            header('Authentication-Results', 'mx.cloudflare.net; spf=pass smtp.mailfrom=example.com'),
        ]);
        expect(security.checks.spf.status).toBe('fail');
    });

    it('keeps a dkim=fail from the trusted header', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; spf=pass smtp.mailfrom=example.com; dkim=fail header.d=example.com; dmarc=pass'),
        ]);
        expect(security.checks.dkim.status).toBe('fail');
        expect(getAuthScore(security)).toEqual({ reported: 3, passed: 2, failed: 1 });
        expect(getAuthDotStatus(security)).toBe('fail');
    });

    // Ported from worker/src/email/junk_mail_policy.test.mjs: none/neutral
    // exist but don't pass; the display keeps them as reported statuses.
    it.each([
        ['spf', 'none'], ['spf', 'neutral'],
        ['dkim', 'none'], ['dkim', 'neutral'],
        ['dmarc', 'none'],
    ])('%s=%s is reported but not a pass', (method, result) => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', `mx.cloudflare.net; ${method}=${result}`),
        ]);
        expect(security.checks[method].status).toBe(result);
        const score = getAuthScore(security);
        expect(score.passed).toBe(0);
        expect(score.reported).toBe(1);
        expect(score.failed).toBe(0);
        expect(getAuthDotStatus(security)).toBe('warn');
    });

    it('maps the legacy policy verdict to neutral', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; dkim=policy header.d=example.com'),
        ]);
        expect(security.checks.dkim.status).toBe('neutral');
    });

    it('skips results with a version other than 1 like the worker policy', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; dkim/2=pass header.d=example.com'),
        ]);
        expect(security.checks.dkim.status).toBe('not reported');
    });

    it('falls back to Received-SPF when the trusted header has no spf', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; dkim=pass header.d=example.com'),
            header('Received-SPF', 'Pass (mx.cloudflare.net: domain of example.com designates 192.0.2.10 as permitted sender) receiver=mx.cloudflare.net; identity=mailfrom; envelope-from=bounce@example.com; helo=sender-mail.example; client-ip=192.0.2.10'),
        ]);
        expect(security.checks.spf.status).toBe('pass');
    });

    it('reports a softfail Received-SPF', () => {
        const security = analyzeMailSecurity([
            header('Received-SPF', 'SoftFail (mx.cloudflare.net: domain of transitioning example.com discourages 192.0.2.10 as permitted sender) client-ip=192.0.2.10'),
        ]);
        expect(security.checks.spf.status).toBe('softfail');
        expect(getAuthDotStatus(security)).toBe('warn');
    });

    it('ignores an invalid Received-SPF result token', () => {
        const security = analyzeMailSecurity([
            header('Received-SPF', 'client-ip=192.0.2.10; envelope-from=bounce@example.com'),
        ]);
        expect(security.checks.spf.status).toBe('not reported');
    });

    it('ignores a forged foreign Received-SPF pass below the trusted headers', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; dkim=pass header.d=example.com'),
            header('Received', 'from sender-mail.example (sender-mail.example [192.0.2.10]) by mx.cloudflare.net with ESMTPS id abc123; Mon, 01 Jan 2024 00:00:00 +0000'),
            header('Received-SPF', 'Pass (evil.example: domain of evil.example designates 192.0.2.66 as permitted sender) client-ip=192.0.2.66'),
        ]);
        expect(security.checks.spf.status).toBe('not reported');
    });

    it('ignores a Received-SPF below the topmost Received without a trusted comment', () => {
        const security = analyzeMailSecurity([
            header('Received', 'from sender-mail.example (sender-mail.example [192.0.2.10]) by mx.cloudflare.net with ESMTPS id abc123; Mon, 01 Jan 2024 00:00:00 +0000'),
            header('Received-SPF', 'Pass client-ip=192.0.2.10'),
        ]);
        expect(security.checks.spf.status).toBe('not reported');
    });

    it('accepts a Received-SPF above a topmost Received by a trusted host', () => {
        const security = analyzeMailSecurity([
            header('Received-SPF', 'Pass client-ip=192.0.2.10'),
            header('Received', 'from sender-mail.example (sender-mail.example [192.0.2.10]) by mx.cloudflare.net with ESMTPS id abc123; Mon, 01 Jan 2024 00:00:00 +0000'),
        ]);
        expect(security.checks.spf.status).toBe('pass');
    });

    it('ignores a Received-SPF above a topmost Received by an untrusted host', () => {
        const security = analyzeMailSecurity([
            header('Received-SPF', 'Pass client-ip=192.0.2.10'),
            header('Received', 'from sender-mail.example (sender-mail.example [192.0.2.10]) by relay.evil.example with ESMTPS id abc123; Mon, 01 Jan 2024 00:00:00 +0000'),
        ]);
        expect(security.checks.spf.status).toBe('not reported');
    });

    it('reads arc and iprev only from the trusted header', () => {
        const withIp = analyzeMailSecurity(cloudflareTrusted);
        expect(withIp.checks.arc.status).toBe('pass');
        expect(withIp.checks.iprev.status).toBe('pass');

        const withoutIp = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass'),
        ]);
        expect(withoutIp.checks.iprev.status).toBe('not reported');
        expect(withoutIp.checks.arc.status).toBe('not reported');
    });

    it('does not trust arc/iprev from a foreign header', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mail.sender.example; spf=pass; dkim=pass; dmarc=pass; arc=pass; iprev=pass'),
        ]);
        expect(security.checks.arc.status).toBe('not reported');
        expect(security.checks.iprev.status).toBe('not reported');
    });

    it('honours a custom trusted authserv-id list', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.receiver.example; spf=pass smtp.mailfrom=example.com'),
        ], { trustedAuthservIds: ['mx.receiver.example'] });
        expect(security.checks.spf.status).toBe('pass');
    });

    it('exports the Cloudflare authserv-id as trusted', () => {
        expect(TRUSTED_AUTHSERV_IDS).toContain('mx.cloudflare.net');
    });
});

describe('TLS parsing', () => {
    it.each([
        ['Postfix comment', '(version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256)',
            { version: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384' }],
        ['using/with cipher', 'using TLSv1.3 with cipher TLS_AES_256_GCM_SHA384',
            { version: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384' }],
        ['paren using form', '(using TLSv1.2 with cipher ECDHE-RSA-AES256-GCM-SHA384)',
            { version: 'TLSv1.2', cipher: 'ECDHE-RSA-AES256-GCM-SHA384' }],
        ['ESMTPS without version', 'with ESMTPS id abc123 for <box@decrypts.net>',
            { version: null, cipher: null }],
        ['ESMTPSA without version', 'with ESMTPSA id abc123',
            { version: null, cipher: null }],
    ])('parses the %s form', (_name, fragment, expected) => {
        expect(parseTlsInfo(`from relay.example (relay.example [192.0.2.20]) by mx.cloudflare.net ${fragment}; Mon, 01 Jan 2024 00:00:00 +0000`))
            .toEqual(expected);
    });

    it('does not treat plain ESMTPA as TLS', () => {
        expect(parseTlsInfo('from relay.example by mx.cloudflare.net with ESMTPA id abc; Mon, 01 Jan 2024 00:00:00 +0000'))
            .toBeNull();
    });

    it('returns null when nothing is found', () => {
        expect(parseTlsInfo('from relay.example by mx.cloudflare.net with ESMTP id abc; Mon, 01 Jan 2024 00:00:00 +0000'))
            .toBeNull();
        expect(parseTlsInfo(undefined)).toBeNull();
    });

    it('reads TLS only from the topmost Received header', () => {
        const security = analyzeMailSecurity([
            header('Received', 'from a.example (a.example [192.0.2.1]) by mx.cloudflare.net with ESMTP id 1; Mon, 01 Jan 2024 00:00:02 +0000'),
            header('Received', 'from b.example (b.example [192.0.2.2]) by hop.example (version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256); Mon, 01 Jan 2024 00:00:01 +0000'),
        ]);
        expect(security.tls).toBeNull();
    });

    it('reports TLS from the topmost Received header', () => {
        const security = analyzeMailSecurity([
            header('Received', 'from a.example (a.example [192.0.2.1]) by mx.cloudflare.net (version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256); Mon, 01 Jan 2024 00:00:02 +0000'),
        ]);
        expect(security.tls).toEqual({ version: 'TLSv1.3', cipher: 'TLS_AES_256_GCM_SHA384' });
    });

    it('counts TLS as a passing check in the score', () => {
        const security = analyzeMailSecurity([
            header('Authentication-Results', 'mx.cloudflare.net; spf=pass smtp.mailfrom=example.com; dkim=pass header.d=example.com; dmarc=pass'),
            header('Received', 'from a.example (a.example [192.0.2.1]) by mx.cloudflare.net (version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256); Mon, 01 Jan 2024 00:00:02 +0000'),
        ]);
        expect(getAuthScore(security)).toEqual({ reported: 4, passed: 4, failed: 0 });
        expect(getAuthDotStatus(security)).toBe('pass');
    });
});

describe('getAuthScore / getAuthDotStatus', () => {
    it('scores nothing when nothing is reported', () => {
        const security = analyzeMailSecurity([]);
        expect(getAuthScore(security)).toEqual({ reported: 0, passed: 0, failed: 0 });
        expect(getAuthDotStatus(security)).toBe('warn');
    });

    it('buckets statuses for badge styles', () => {
        expect(authStatusCategory('pass')).toBe('pass');
        expect(authStatusCategory('fail')).toBe('fail');
        expect(authStatusCategory('softfail')).toBe('warn');
        expect(authStatusCategory('temperror')).toBe('warn');
        expect(authStatusCategory('permerror')).toBe('warn');
        expect(authStatusCategory('neutral')).toBe('muted');
        expect(authStatusCategory('none')).toBe('muted');
        expect(authStatusCategory('not reported')).toBe('muted');
    });
});

describe('address helpers', () => {
    it.each([
        ['Sender <first@example.com>', 'Sender', 'first@example.com'],
        ['first@example.com', '', 'first@example.com'],
        ['"Sender, Display" <first@example.com>', 'Sender, Display', 'first@example.com'],
        ['=?UTF-8?B?5Y+R5Lu25Lq6?= <first@example.com>', '发件人', 'first@example.com'],
        ['First <first@example.com>, Second <second@example.com>', 'First', 'first@example.com'],
        ['undisclosed:;', '', ''],
    ])('splits %s', (value, name, address) => {
        expect(splitAddressDisplay(value)).toEqual({ name, address });
    });

    it('extracts address and display name independently', () => {
        expect(extractAddress('Sender <first@example.com>')).toBe('first@example.com');
        expect(extractDisplayName('Sender <first@example.com>')).toBe('Sender');
    });
});

describe('extractDeliveryDetails', () => {
    const fullHeaders = [
        header('Return-Path', '<bounce@example.com>'),
        header('From', 'Sender <sender@example.com>'),
        header('Reply-To', 'Replies <replies@example.com>'),
        header('Message-ID', '<abc-123@example.com>'),
        header('List-Unsubscribe', '<https://example.com/unsub?token=abc>, <mailto:unsub@example.com>'),
        header('Received', 'from mx.cloudflare.net (mx.cloudflare.net [198.51.100.9]) by inbox.decrypts.net with ESMTPS id final; Mon, 01 Jan 2024 00:00:03 +0000'),
        header('Received', 'from relay.example (relay.example [192.0.2.20]) by mx.cloudflare.net with ESMTPS id mid; Mon, 01 Jan 2024 00:00:02 +0000'),
        header('Received', 'from sender-mail.example (sender-mail.example [192.0.2.10]) by relay.example (version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256); Mon, 01 Jan 2024 00:00:01 +0000'),
    ];

    it('extracts message id, return path and reply-to', () => {
        const details = extractDeliveryDetails(fullHeaders);
        expect(details.messageId).toBe('<abc-123@example.com>');
        expect(details.returnPath).toBe('<bounce@example.com>');
        expect(details.replyTo).toBe('Replies <replies@example.com>');
    });

    it('takes the sending server from the first external Received hop', () => {
        const details = extractDeliveryDetails(fullHeaders);
        expect(details.sendingServer).toEqual({ host: 'sender-mail.example', ip: '192.0.2.10' });
        expect(details.hopCount).toBe(3);
    });

    it('counts hops and handles a single hop', () => {
        expect(extractDeliveryDetails(fullHeaders).hopCount).toBe(3);
        expect(extractDeliveryDetails([fullHeaders[5]]).hopCount).toBe(1);
    });

    it('drops a Reply-To equal to From', () => {
        const details = extractDeliveryDetails([
            header('From', 'Sender <sender@example.com>'),
            header('Reply-To', 'sender@example.com'),
        ]);
        expect(details.replyTo).toBeNull();
    });

    it('keeps a Reply-To that only differs in case from From', () => {
        const details = extractDeliveryDetails([
            header('From', 'Sender <Sender@Example.com>'),
            header('Reply-To', 'sender@example.com'),
        ]);
        expect(details.replyTo).toBeNull();
    });

    it('extracts the first List-Unsubscribe URI', () => {
        expect(extractDeliveryDetails(fullHeaders).listUnsubscribe)
            .toBe('https://example.com/unsub?token=abc');
    });

    it('ignores non-http List-Unsubscribe values', () => {
        expect(extractDeliveryDetails([
            header('List-Unsubscribe', '<mailto:unsub@example.com>'),
        ]).listUnsubscribe).toBe('mailto:unsub@example.com');
        expect(extractDeliveryDetails([
            header('List-Unsubscribe', 'https://example.com/bare'),
        ]).listUnsubscribe).toBeNull();
    });

    it('returns nulls for absent headers', () => {
        const details = extractDeliveryDetails([]);
        expect(details.messageId).toBeNull();
        expect(details.returnPath).toBeNull();
        expect(details.replyTo).toBeNull();
        expect(details.sendingServer).toBeNull();
        expect(details.hopCount).toBe(0);
        expect(details.listUnsubscribe).toBeNull();
    });
});
