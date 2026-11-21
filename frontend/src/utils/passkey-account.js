/**
 * Passkey-only accounts have no email; the server generates a
 * `pk-<hex>@passkey.invalid` pseudo-email for them (the reserved `.invalid`
 * TLD can never receive mail or match a real login). The user center and
 * admin console show "Passkey account" instead of these pseudo-emails.
 *
 * @param {unknown} email
 * @returns {boolean}
 */
export const isPasskeyPseudoEmail = (email) => {
    return typeof email === 'string' && email.trim().toLowerCase().endsWith('.invalid');
};

/**
 * True when the browser can create and use WebAuthn passkeys.
 *
 * @returns {boolean}
 */
export const isWebAuthnSupported = () => {
    return typeof window !== 'undefined'
        && typeof window.PublicKeyCredential === 'function'
        && typeof navigator !== 'undefined'
        && !!navigator.credentials;
};
