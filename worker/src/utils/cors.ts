/**
 * Parse the CORS_ALLOWED_ORIGINS env var: a JSON array of exact origins,
 * e.g. ["https://decrypts.net"]. Returns [] when unset, empty or invalid;
 * callers treat an empty list as "keep the historical unrestricted `*`".
 *
 * Parsing mirrors getStringArray in ../utils (SEND_MAIL_DOMAINS style):
 * a JSON string is parsed, an actual array is used as-is, anything else
 * falls back to []. Kept self-contained (no ../utils import) so the pure
 * decision logic can be unit-tested outside the worker bundle.
 */
export const getCorsAllowedOrigins = (
    value: string | string[] | undefined | null
): string[] => {
    let parsed: unknown = value;
    if (value && !Array.isArray(value)) {
        try {
            parsed = JSON.parse(value);
        } catch (e) {
            console.error("Failed to parse CORS_ALLOWED_ORIGINS", e);
            parsed = [];
        }
    }
    const list = Array.isArray(parsed) ? parsed : [];
    return list
        .map((origin) => (typeof origin === "string" ? origin.trim() : ""))
        .filter(Boolean);
};

/**
 * Decide the Access-Control-Allow-Origin value for a request origin.
 *
 * - allowedOrigins empty  -> "*" (historical behaviour, unrestricted CORS,
 *   keeps upstream-style separate-frontend deployments working).
 * - otherwise             -> echo the request origin only when it is in the
 *   allow-list; return null (no CORS headers at all) for unknown origins or
 *   a missing Origin header. CORS only restricts browsers: requests without
 *   an Origin header (curl, scripts, same-origin GETs) keep working.
 */
export const resolveCorsOrigin = (
    allowedOrigins: string[],
    requestOrigin: string | null | undefined
): string | null => {
    if (allowedOrigins.length === 0) {
        return "*";
    }
    if (!requestOrigin) {
        return null;
    }
    return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
};
