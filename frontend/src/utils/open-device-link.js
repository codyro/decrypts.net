/**
 * "Open on another device" link builder.
 *
 * The link carries the mailbox credential — and, for encrypted mailboxes,
 * the passphrase-protected key backup — in the URL FRAGMENT:
 *
 *   #jwt=<credential>[&kp=<wrapped backup blob>&a=<address>]
 *
 * Browsers never send fragments to servers and they do not appear in server
 * logs, unlike the legacy `?jwt=` query parameter. On load the frontend
 * logs in with the credential, strips the fragment, and prompts for the
 * backup passphrase exactly like a plain `#kp=` link.
 *
 * SECURITY: a raw `#k=` private key is never accepted or emitted here — the
 * builder only takes the wrapped (passphrase-protected) blob, and only when
 * it already exists on a stored key record.
 */
export const buildOpenDeviceLink = ({ jwt, address = '', wrappedBackup = null, baseUrl } = {}) => {
    if (typeof jwt !== 'string' || jwt.length === 0) return ''
    const origin = baseUrl !== undefined
        ? baseUrl
        : (typeof window !== 'undefined' && window.location ? window.location.origin : '')
    let fragment = `jwt=${encodeURIComponent(jwt)}`
    if (typeof wrappedBackup === 'string' && wrappedBackup.length > 0) {
        fragment += `&kp=${encodeURIComponent(wrappedBackup)}&a=${encodeURIComponent(address)}`
    }
    return `${origin}/#${fragment}`
}
