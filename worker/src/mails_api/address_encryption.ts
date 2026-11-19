import { Context } from 'hono'

import i18n from '../i18n';
import { getBooleanValue } from '../utils';
import { validatePublicKey } from '../utils/mail_crypto';

const getAddressEncryption = async (c: Context<HonoCustomType>) => {
    const enabled = getBooleanValue(c.env.ENABLE_MAIL_ENCRYPTION);
    if (!enabled) {
        return c.json({ enabled: false, publicKey: null });
    }
    const { address } = c.get("jwtPayload");
    const row = await c.env.DB.prepare(
        `SELECT encryption_public_key FROM address WHERE name = ?`
    ).bind(address).first<{ encryption_public_key: string | null }>();
    return c.json({ enabled: true, publicKey: row?.encryption_public_key ?? null });
};

const saveAddressEncryption = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_MAIL_ENCRYPTION)) {
        return c.text(msgs.MailEncryptionDisabledMsg, 400)
    }
    const { publicKey } = await c.req.json<{ publicKey: string | null }>();
    const { address } = c.get("jwtPayload");
    if (publicKey === null) {
        await c.env.DB.prepare(
            `UPDATE address SET encryption_public_key = NULL WHERE name = ?`
        ).bind(address).run();
        return c.json({ success: true, publicKey: null });
    }
    if (!(await validatePublicKey(publicKey))) {
        return c.text(msgs.InvalidMailEncryptionPublicKeyMsg, 400)
    }
    // Rotating the key only affects mail stored from now on; mails already
    // stored stay encrypted under the key that was active when they arrived
    // and can only be decrypted with the matching private key.
    await c.env.DB.prepare(
        `UPDATE address SET encryption_public_key = ? WHERE name = ?`
    ).bind(publicKey, address).run();
    return c.json({ success: true, publicKey });
};

export default { getAddressEncryption, saveAddressEncryption };
