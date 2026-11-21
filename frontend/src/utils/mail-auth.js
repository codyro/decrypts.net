/**
 * Client-side mail authentication analysis, derived purely from raw MIME
 * headers in the browser. Headers are never sent anywhere; there are no
 * GeoIP or DNS lookups here.
 *
 * The Authentication-Results / Received-SPF parsing is ported from the
 * worker's junk-mail policy (worker/src/email/junk_mail_policy.ts) with the
 * same result-token semantics, and extended with receiver-trust checks
 * (sender-controlled hops can forge these headers, so only results from the
 * receiving MTA are believed), ARC, iprev (rDNS) and Received-based TLS
 * extraction for the mail view's security panel.
 */

// Receiving MTAs whose Authentication-Results we trust. Cloudflare Email
// Routing signs its results with this authserv-id; any other authserv-id can
// be forged by the sender and is ignored.
export const TRUSTED_AUTHSERV_IDS = ['mx.cloudflare.net'];

// Canonical check results the UI knows how to present.
export const AUTH_CHECK_RESULTS = Object.freeze([
    'pass', 'fail', 'softfail', 'neutral', 'none', 'temperror', 'permerror',
]);

// Same supported-result sets as the worker's junk_mail_policy.
const supportedResults = {
    spf: new Set(['none', 'neutral', 'pass', 'fail', 'softfail', 'policy', 'temperror', 'permerror']),
    dkim: new Set(['none', 'neutral', 'pass', 'fail', 'policy', 'temperror', 'permerror']),
    dmarc: new Set(['none', 'pass', 'fail', 'temperror', 'permerror']),
    arc: new Set(['none', 'pass', 'fail', 'temperror', 'permerror']),
    iprev: new Set(['none', 'pass', 'fail', 'temperror', 'permerror']),
};
const receivedSpfResults = new Set([
    'none', 'neutral', 'pass', 'fail', 'softfail', 'temperror', 'permerror',
]);

const AUTH_RESULT_NOT_REPORTED = 'not reported';

// Header values can arrive still folded (CRLF/LF + whitespace continuations,
// which neither parser path is guaranteed to have unfolded); collapse them
// into single spaces so multi-line Received headers parse correctly.
const unfoldHeaderValue = (value) => value.replace(/\r?\n[ \t]+/g, ' ');

/** Normalise a parser-provided header list to [{ key, value }] pairs. */
export const normalizeHeaders = (headers) => (Array.isArray(headers) ? headers : [])
    .map((header) => ({
        key: typeof header?.key === 'string' ? header.key : '',
        value: typeof header?.value === 'string' ? unfoldHeaderValue(header.value) : '',
    }))
    .filter((header) => header.key.length > 0);

const headerKey = ({ key }) => key.trim().toLowerCase();

const getHeader = (headers, name) => {
    const target = name.toLowerCase();
    for (const header of headers) {
        if (headerKey(header) === target) return header.value;
    }
    return null;
};

// Ported from worker/src/email/junk_mail_policy.ts.
const parseAuthenticationResults = (value) => {
    const results = [];
    const pattern = /(?:^|;)[ \t]*([a-z][a-z0-9_-]*)(?:[ \t]*\/[ \t]*(\d+))?[ \t]*=[ \t]*([a-z][a-z0-9_-]*)/gi;

    for (const match of value.matchAll(pattern)) {
        results.push({
            method: match[1].toLowerCase(),
            version: match[2],
            result: match[3].toLowerCase(),
        });
    }
    return results;
};

// The authserv-id is the first segment of an Authentication-Results value,
// an optional version number aside ("mx.cloudflare.net 1; ..."). An
// ARC-Authentication-Results value starts with an instance tag ("i=1; ...",
// RFC 8617) before the authserv-id, which must be stripped first.
const ARC_INSTANCE_PATTERN = /^\s*i=(\d+)\s*;/i;
const AUTHSERV_VERSION_PATTERN = /\s+\d+$/;

const parseAuthservId = (value, { arc = false } = {}) => {
    let rest = value;
    if (arc) rest = rest.replace(ARC_INSTANCE_PATTERN, '');
    return rest.split(';', 1)[0].trim().toLowerCase()
        .replace(AUTHSERV_VERSION_PATTERN, '');
};

// The results portion of the value: everything after the authserv-id
// segment, so the parser never sees the (ARC) instance tag or authserv-id.
const stripAuthservSegment = (value, { arc = false } = {}) => {
    let rest = value;
    if (arc) rest = rest.replace(ARC_INSTANCE_PATTERN, '');
    const separator = rest.indexOf(';');
    return separator < 0 ? '' : rest.slice(separator + 1);
};

// Pick the header whose results to display: among trusted
// ARC-Authentication-Results headers the one with the highest instance
// number wins (the newest seal of the ARC chain); otherwise the first
// (topmost) trusted Authentication-Results header, as before.
const findTrustedAuthHeader = (headers, trustedAuthservIds) => {
    const trusted = trustedAuthservIds.map((id) => id.toLowerCase());
    let topmostTrusted = null;
    let bestArc = null;
    for (const header of headers) {
        const key = headerKey(header);
        const isArc = key === 'arc-authentication-results';
        if (key !== 'authentication-results' && !isArc) continue;
        const authservId = parseAuthservId(header.value, { arc: isArc });
        if (!trusted.includes(authservId)) continue;
        const value = stripAuthservSegment(header.value, { arc: isArc });
        if (isArc) {
            const instance = Number(header.value.match(ARC_INSTANCE_PATTERN)?.[1] ?? -1);
            if (!bestArc || instance > bestArc.instance) {
                bestArc = { authservId, value, instance };
            }
        } else if (!topmostTrusted) {
            topmostTrusted = { authservId, value };
        }
    }
    if (bestArc) return { authservId: bestArc.authservId, value: bestArc.value };
    return topmostTrusted;
};

// Map a raw result token onto a display status, mirroring the worker's
// supported-result semantics. The legacy "policy" verdict (SPF/DKIM) counts
// as existing but not passing there; for display it is a non-committal
// "neutral".
const normalizeCheckResult = (method, result) => {
    if (!result || !supportedResults[method]?.has(result)) return null;
    if (result === 'policy') return 'neutral';
    return result;
};

// TLS metadata from a single Received header value. Handles the common
// notations case-insensitively, folding aside:
//   (version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256)
//   (using TLSv1.3 with cipher TLS_AES_128_GCM_SHA256 (128/128 bits))
//   (version=TLS1_3 cipher=TLS_AES_256_GCM_SHA384)   (Exim/Postfix style)
//   tls=TLSv1.3 / a bare TLSv1.2 | TLSv1.3 | TLS1_2 | TLS1_3 token
//   cipher=ECDHE-RSA-AES128-GCM-SHA256 / with cipher <OpenSSL name>
//   with ESMTPS / ESMTPSA / UTF8SMTPS   (TLS used, version not stated)
const normalizeTlsVersion = (version) => version.toLowerCase()
    .replace(/^tlsv?(\d+)[._](\d+)$/, 'TLSv$1.$2');

export const parseTlsInfo = (receivedValue) => {
    if (typeof receivedValue !== 'string') return null;
    const value = unfoldHeaderValue(receivedValue);

    const tlsVersionPattern = '(TLSv?\\d[\\d._]*)';
    let match = value.match(new RegExp(`\\bversion=${tlsVersionPattern}[ \\t]+cipher=([^\\s;)]+)`, 'i'))
        || value.match(new RegExp(`\\busing[ \\t]+${tlsVersionPattern}[ \\t]+with[ \\t]+cipher[ \\t]+([^\\s;)]+)`, 'i'));
    if (match) return { version: normalizeTlsVersion(match[1]), cipher: match[2] };

    match = value.match(/\btls=(TLSv?\d[\d._]*)/i);
    if (match) return { version: normalizeTlsVersion(match[1]), cipher: null };

    match = value.match(new RegExp(`(?:^|[\\s;(])${tlsVersionPattern}(?=[\\s;)]|$)`, 'i'));
    if (match) return { version: normalizeTlsVersion(match[1]), cipher: null };

    match = value.match(/\bcipher=([^\s;)]+)/i)
        || value.match(/\bwith[ \t]+cipher[ \t]+([^\s;)]+)/i)
        || value.match(/\b((?:ECDHE|DHE|EDH|RSA|ECDSA|AES|CHACHA20)-[A-Z0-9][A-Z0-9-]*)\b/);
    if (match) return { version: null, cipher: match[1] };

    if (/\bwith[ \t]+(?:UTF8)?E?SMTPSA?\b/i.test(value)) return { version: null, cipher: null };

    return null;
};

/**
 * Analyse the authentication checks reported for a message.
 * Returns { authservId, checks, tls } where checks holds the display status
 * ('pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'temperror' |
 * 'permerror' | 'not reported') for spf/dkim/dmarc/arc/iprev.
 */
export const analyzeMailSecurity = (headers, options = {}) => {
    const trustedAuthservIds = options.trustedAuthservIds || TRUSTED_AUTHSERV_IDS;
    const normalized = normalizeHeaders(headers);
    const trusted = findTrustedAuthHeader(normalized, trustedAuthservIds);
    const trustedIds = trustedAuthservIds.map((id) => id.toLowerCase());

    const checks = {
        spf: { id: 'spf', status: AUTH_RESULT_NOT_REPORTED },
        dkim: { id: 'dkim', status: AUTH_RESULT_NOT_REPORTED },
        dmarc: { id: 'dmarc', status: AUTH_RESULT_NOT_REPORTED },
        arc: { id: 'arc', status: AUTH_RESULT_NOT_REPORTED },
        iprev: { id: 'iprev', status: AUTH_RESULT_NOT_REPORTED },
    };

    if (trusted) {
        for (const { method, version, result } of parseAuthenticationResults(trusted.value)) {
            if (!checks[method]) continue;
            // Same version semantics as the worker's junk-mail policy.
            if (version && version !== '1') continue;
            const status = normalizeCheckResult(method, result);
            if (status) checks[method].status = status;
        }
    }

    // Received-SPF has no authserv-id of its own, so the frontend is stricter
    // than the worker's junk-mail policy (which accepts any receiver's header):
    // the sender can forge it, so accept one only when attributable to the
    // trusted receiver — either its comment names a trusted authserv-id
    // ("Received-SPF: pass (mx.cloudflare.net: ...)"), or it sits above the
    // topmost Received header that the final hop prepended and that header was
    // "by" a trusted host. Only used when the trusted header did not report SPF.
    if (checks.spf.status === AUTH_RESULT_NOT_REPORTED) {
        const firstReceivedIndex = normalized.findIndex(
            (header) => headerKey(header) === 'received',
        );
        const topReceivedByTrusted = firstReceivedIndex >= 0
            && (normalized[firstReceivedIndex].value.match(/\bby[ \t]+([^\s(]+)/i)?.[1] || '')
                .toLowerCase();
        const receiverIsTrusted = topReceivedByTrusted.length > 0
            && trustedIds.some((id) => topReceivedByTrusted === id
                || topReceivedByTrusted.endsWith(`.${id}`));
        for (const [index, header] of normalized.entries()) {
            if (headerKey(header) !== 'received-spf') continue;
            const commentAuthservId = header.value
                .match(/\([ \t]*([^\s:()]+)[ \t]*:/i)?.[1]?.toLowerCase() ?? null;
            const fromTrustedComment = commentAuthservId !== null
                && trustedIds.includes(commentAuthservId);
            const fromTrustedReceiver = receiverIsTrusted && index < firstReceivedIndex;
            if (!fromTrustedComment && !fromTrustedReceiver) continue;
            const result = header.value.match(/^[ \t]*([a-z][a-z0-9_-]*)/i)?.[1]?.toLowerCase();
            if (!result || !receivedSpfResults.has(result)) continue;
            const status = normalizeCheckResult('spf', result);
            if (status) {
                checks.spf.status = status;
                break;
            }
        }
    }

    // TLS of the hop that delivered the mail to the receiving side. Prefer
    // the Received headers added by the trusted receiver ("by <trusted id>"
    // or a subdomain of it) — Cloudflare may prepend an internal hop without
    // TLS info, so scan the next one or two of them; fall back to the
    // topmost Received header, as before.
    const receivedByTrusted = (header) => {
        const byHost = header.value.match(/\bby[ \t]+([^\s(]+)/i)?.[1]?.toLowerCase() || '';
        return byHost.length > 0
            && trustedIds.some((id) => byHost === id || byHost.endsWith(`.${id}`));
    };
    const receivedHeaders = normalized.filter((header) => headerKey(header) === 'received');
    const trustedReceived = receivedHeaders.filter(receivedByTrusted);
    let tls = null;
    for (const header of (trustedReceived.length > 0 ? trustedReceived : receivedHeaders).slice(0, 3)) {
        tls = parseTlsInfo(header.value);
        if (tls) break;
    }

    return { authservId: trusted?.authservId || null, checks, tls };
};

// Status buckets used by the UI: which colour a badge gets.
export const authStatusCategory = (status) => {
    if (status === 'pass') return 'pass';
    if (status === 'fail') return 'fail';
    if (status === 'softfail' || status === 'temperror' || status === 'permerror') return 'warn';
    return 'muted';
};

/**
 * Score over the checks that were actually reported. TLS counts when found.
 * Returns { reported, passed, failed }.
 */
export const getAuthScore = (security) => {
    const all = [
        ...Object.values(security.checks),
        { id: 'tls', status: security.tls ? 'pass' : AUTH_RESULT_NOT_REPORTED },
    ];
    const reported = all.filter((check) => check.status !== AUTH_RESULT_NOT_REPORTED);
    return {
        reported: reported.length,
        passed: reported.filter((check) => check.status === 'pass').length,
        failed: reported.filter((check) => check.status === 'fail').length,
    };
};

// Rail status dot: green when every reported check passes, red when any
// failed, amber otherwise (missing checks, softfail, neutral/none, errors).
export const getAuthDotStatus = (security) => {
    const score = getAuthScore(security);
    if (score.failed > 0) return 'fail';
    if (score.reported > 0 && score.passed === score.reported) return 'pass';
    return 'warn';
};

// --- address helpers (for the From/Reply-To pills) -------------------------

const decodeEncodedWords = (value) => value.replace(
    /=\?([^?\s]+)\?([bBqQ])\?([^?]*)\?=/g,
    (word, charset, encoding, text) => {
        try {
            const bytes = encoding.toLowerCase() === 'b'
                ? Uint8Array.from(atob(text), (char) => char.charCodeAt(0))
                : Uint8Array.from(
                    text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g,
                        (escape, hex) => String.fromCharCode(parseInt(hex, 16))),
                    (char) => char.charCodeAt(0));
            return new TextDecoder(charset).decode(bytes);
        } catch {
            return word;
        }
    });

/** First bare e-mail address in a From/Reply-To style header value. */
export const extractAddress = (value) => {
    if (typeof value !== 'string') return '';
    const angle = value.match(/<([^<>\s]+@[^<>\s]*)>/);
    if (angle) return angle[1];
    const bare = value.match(/[^\s,;]+@[^\s,;]+/);
    return bare ? bare[0] : '';
};

/** Display name of the first address in a header value ('' when none). */
export const extractDisplayName = (value) => {
    if (typeof value !== 'string') return '';
    const decoded = decodeEncodedWords(value);
    const angle = decoded.match(/^(.*?)\s*<[^<>\s]+@[^<>\s]*>/s);
    if (!angle) return '';
    return angle[1].trim().replace(/^"|"$/g, '').trim();
};

/** { name, address } of the first address in a header value. */
export const splitAddressDisplay = (value) => ({
    name: extractDisplayName(value),
    address: extractAddress(value),
});

// --- delivery details ------------------------------------------------------

// The "from host (ip)" part of a Received header value.
export const parseReceivedFrom = (receivedValue) => {
    if (typeof receivedValue !== 'string') return null;
    const match = receivedValue.match(/\bfrom[ \t]+([^\s(]+)(?:[ \t]*\(([^)]*)\))?/i);
    if (!match) return null;
    const ip = match[2]?.match(/\[([^\]]+)\]/)?.[1] || null;
    return { host: match[1], ip };
};

const extractUri = (value) => {
    if (typeof value !== 'string') return null;
    const uri = value.match(/<([^<>\s]+)>/)?.[1];
    return uri && /^(https?:|mailto:)/i.test(uri) ? uri : null;
};

/**
 * Delivery details derived from the raw headers: Message-ID, Return-Path,
 * Reply-To (when it differs from From), the sending server of the first
 * external hop, the Received hop count and List-Unsubscribe.
 */
export const extractDeliveryDetails = (headers) => {
    const normalized = normalizeHeaders(headers);
    const received = normalized.filter((header) => headerKey(header) === 'received');

    const from = getHeader(normalized, 'from');
    const replyTo = getHeader(normalized, 'reply-to');
    const replyToAddress = replyTo ? extractAddress(replyTo) : '';
    const fromAddress = from ? extractAddress(from) : '';
    const firstHop = received.length > 0
        ? parseReceivedFrom(received[received.length - 1].value)
        : null;

    return {
        messageId: getHeader(normalized, 'message-id'),
        returnPath: getHeader(normalized, 'return-path'),
        replyTo: replyToAddress && fromAddress
            && replyToAddress.toLowerCase() === fromAddress.toLowerCase()
            ? null
            : replyTo,
        sendingServer: firstHop,
        hopCount: received.length,
        listUnsubscribe: extractUri(getHeader(normalized, 'list-unsubscribe') || ''),
    };
};
