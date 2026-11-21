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

/** Normalise a parser-provided header list to [{ key, value }] pairs. */
export const normalizeHeaders = (headers) => (Array.isArray(headers) ? headers : [])
    .map((header) => ({
        key: typeof header?.key === 'string' ? header.key : '',
        value: typeof header?.value === 'string' ? header.value : '',
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

const parseAuthservId = (value) => value.split(';', 1)[0].trim().toLowerCase();

// The first (topmost) Authentication-Results/ARC-Authentication-Results
// header whose authserv-id belongs to the receiving side.
const findTrustedAuthHeader = (headers, trustedAuthservIds) => {
    const trusted = trustedAuthservIds.map((id) => id.toLowerCase());
    for (const header of headers) {
        const key = headerKey(header);
        if (key !== 'authentication-results' && key !== 'arc-authentication-results') continue;
        const authservId = parseAuthservId(header.value);
        if (trusted.includes(authservId)) return { authservId, value: header.value };
    }
    return null;
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

// TLS metadata from a single Received header value, in the common forms:
//   (version=TLSv1.3 cipher=TLS_AES_256_GCM_SHA384 bits=256/256)
//   using TLSv1.3 with cipher TLS_AES_256_GCM_SHA384
//   with ESMTPS / ESMTPSA            (TLS used, version not stated)
export const parseTlsInfo = (receivedValue) => {
    if (typeof receivedValue !== 'string') return null;

    let match = receivedValue.match(/\(version=(TLSv[\d.]+)[ \t]+cipher=([^\s;)]+)/i);
    if (match) return { version: match[1], cipher: match[2] };

    match = receivedValue.match(/using[ \t]+(TLSv[\d.]+)[ \t]+with[ \t]+cipher[ \t]+([^\s;)]+)/i);
    if (match) return { version: match[1], cipher: match[2] };

    if (/[ \t]with[ \t]+E?SMTPSA?\b/i.test(receivedValue)) return { version: null, cipher: null };

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

    // Received-SPF has no authserv-id; it is added by the receiving MTA, so
    // it is trusted. Only used when the trusted header did not report SPF.
    if (checks.spf.status === AUTH_RESULT_NOT_REPORTED) {
        for (const header of normalized) {
            if (headerKey(header) !== 'received-spf') continue;
            const result = header.value.match(/^[ \t]*([a-z][a-z0-9_-]*)/i)?.[1]?.toLowerCase();
            if (!result || !receivedSpfResults.has(result)) continue;
            const status = normalizeCheckResult('spf', result);
            if (status) {
                checks.spf.status = status;
                break;
            }
        }
    }

    // TLS of the hop that delivered the mail to the receiving side: only the
    // topmost Received header was added by the receiver, so only it is read.
    let tls = null;
    for (const header of normalized) {
        if (headerKey(header) !== 'received') continue;
        tls = parseTlsInfo(header.value);
        break;
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
