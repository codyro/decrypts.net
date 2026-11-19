import { Context } from "hono";

import { getBooleanValue } from "../utils";
import { LocaleMessages } from "../i18n/type";
import { validatePublicKey } from "./mail_crypto";

/**
 * Shared validation of an optional per-mailbox `encryption_public_key`
 * request value, used by /api/new_address, /admin/new_address and
 * /telegram/new_address.
 *
 * - null/undefined means "no encryption": returns publicKey null and the
 *   address is created exactly as before.
 * - When a value is present, the ENABLE_MAIL_ENCRYPTION feature var must be
 *   on and the value must pass validatePublicKey (base64url of a 65-byte
 *   uncompressed P-256 point), otherwise an error Response is returned.
 */
export type OptionalEncryptionKeyResult =
    | { ok: true; publicKey: string | null }
    | { ok: false; response: Response };

export const validateOptionalEncryptionPublicKey = async (
    c: Context<HonoCustomType>,
    value: unknown,
    msgs: LocaleMessages
): Promise<OptionalEncryptionKeyResult> => {
    if (value === undefined || value === null) {
        return { ok: true, publicKey: null };
    }
    if (!getBooleanValue(c.env.ENABLE_MAIL_ENCRYPTION)) {
        return { ok: false, response: c.text(msgs.MailEncryptionDisabledMsg, 400) };
    }
    const publicKey = typeof value === "string" ? value.trim() : "";
    if (publicKey.length === 0 || !(await validatePublicKey(publicKey))) {
        return { ok: false, response: c.text(msgs.InvalidMailEncryptionPublicKeyMsg, 400) };
    }
    return { ok: true, publicKey };
};
