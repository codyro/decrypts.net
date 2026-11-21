/**
 * Client-side extraction of verification codes and sign-in/verification links
 * from an already-decrypted, parsed mail. Pure: no DOM, no network — the mail
 * never leaves the browser. Used as the browser fallback for the server-side
 * AI extraction (metadata.ai_extract), which is skipped for encrypted mail.
 */

const MAX_CODES = 5;
const MAX_LINKS = 4;

// Keywords that mark a line (or the subject) as carrying a one-time code.
const CODE_KEYWORD_RE = /(?:\botp\b|code|passcode|pin\s*code|verification|verify|one[-\s]?time|验证码|校验码|动态码|确认码)/i;

// Keywords that mark a URL or its anchor text as a verify / sign-in link.
const LINK_KEYWORD_RE = /(?:verify|confirm|activate|activation|magic|sign[-_]?in|log[-_]?in|login|reset|password|验证|激活|确认)/i;

// Candidate code token: 4-8 chars, not embedded in a longer run, not a CSS hex
// colour (the `#` lookbehind kills `#a1b2c3`).
const TOKEN_RE = /(?<![#A-Za-z0-9])([A-Za-z0-9]{4,8})(?![A-Za-z0-9])/g;

const isYear = (token) => /^\d{4}$/.test(token) && Number(token) >= 1900 && Number(token) <= 2099;

// A token that is a continuation of a longer numeric chain (phone numbers,
// prices, dates, versions): "555-1234", "$19.99", "2024/01/02".
const isChainedNumber = (line, start) => {
    let i = start - 1;
    if (i >= 0 && /[$¥€£]/.test(line[i])) return true; // price: "$19.99" -> 99 handled by length, "$4829" direct
    if (i >= 0 && /[\s().\-\/,:]/.test(line[i])) i--;
    return i >= 0 && /[0-9]/.test(line[i]);
};

const isPlausibleCode = (token, line, start, keywordNearby) => {
    const hasDigit = /\d/.test(token);
    if (!hasDigit) return false; // letters-only tokens are ordinary words
    if (/^\d+$/.test(token)) {
        if (isYear(token)) return false;
        if (isChainedNumber(line, start)) return false;
    }
    return keywordNearby;
};

// Full-width ASCII (e.g. １２３４５６) -> half-width so CJK mails match.
const normalizeFullWidth = (text) => text.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

const decodeEntities = (text) => text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");

export const stripMailHtml = (html) => decodeEntities(String(html || '').replace(/<[^>]*>/g, ' '));

const pushCode = (codes, seen, token) => {
    if (codes.length >= MAX_CODES || seen.has(token)) return;
    seen.add(token);
    codes.push(token);
};

const extractCodes = (subject, bodyText) => {
    const codes = [];
    const seen = new Set();
    const subjectLine = normalizeFullWidth(String(subject || '')).trim();
    const subjectIsCode = (token) => subjectLine === token;
    const lines = [subjectLine, ...normalizeFullWidth(String(bodyText || '')).split(/\r?\n/)];
    let prevKeyword = false;
    for (const line of lines) {
        if (!line) continue;
        // "Near" = same line, or the code sits alone on the line right after
        // a keyword line (the usual OTP layout).
        const keywordNearby = CODE_KEYWORD_RE.test(line) || prevKeyword;
        prevKeyword = CODE_KEYWORD_RE.test(line);
        TOKEN_RE.lastIndex = 0;
        let match;
        while ((match = TOKEN_RE.exec(line)) !== null) {
            const token = match[1];
            if (!isPlausibleCode(token, line, match.index, keywordNearby || subjectIsCode(token))) continue;
            pushCode(codes, seen, token);
            if (codes.length >= MAX_CODES) return codes;
        }
    }
    return codes;
};

const pushLink = (links, seen, url, label) => {
    if (links.length >= MAX_LINKS || seen.has(url)) return;
    seen.add(url);
    links.push({ url, label: String(label || '').trim().slice(0, 80) });
};

const extractLinks = (text, html) => {
    const links = [];
    const seen = new Set();
    // Anchor tags from the HTML body: keep the anchor text as the label.
    const anchorRe = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = anchorRe.exec(String(html || ''))) !== null) {
        const url = decodeEntities(match[1]);
        if (!/^https?:\/\//i.test(url)) continue;
        const label = stripMailHtml(match[2]);
        if (!LINK_KEYWORD_RE.test(url) && !LINK_KEYWORD_RE.test(label)) continue;
        pushLink(links, seen, url, label);
    }
    // Bare URLs in the plain-text body (text-only mails have no hrefs).
    const bareRe = /https?:\/\/[^\s<>"'）\]]+/gi;
    while ((match = bareRe.exec(String(text || ''))) !== null) {
        const url = match[0].replace(/[.,;!?]+$/, '');
        if (!LINK_KEYWORD_RE.test(url)) continue;
        pushLink(links, seen, url, '');
    }
    return links;
};

/**
 * @param {{subject?: string, text?: string, html?: string}} mail
 * @returns {{codes: string[], links: {url: string, label: string}[]}}
 */
export const extractCodesAndLinks = ({ subject = '', text = '', html = '' } = {}) => {
    const bodyText = text || stripMailHtml(html);
    return {
        codes: extractCodes(subject, bodyText),
        links: extractLinks(text, html),
    };
};
