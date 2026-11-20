import { Context } from 'hono';

import i18n from '../i18n';
import { getBooleanValue } from '../utils';
import { validatePublicKey } from '../utils/mail_crypto';
import {
    KEY_BACKUP_MAX_PER_ADDRESS,
    KEY_BACKUP_MAX_PER_USER,
    validateKeyBackupBlob,
} from '../utils/key_backup';

/**
 * Passkey (WebAuthn PRF) wrapped key backup storage for logged-in user
 * accounts. The browser wraps the mailbox private key with an AES-GCM key
 * derived from the WebAuthn PRF output; the server only stores the opaque
 * wrapped blob. Available only when ENABLE_MAIL_ENCRYPTION is on.
 */

type KeyBackupRow = {
    id: number;
    address: string;
    key_id: string;
    passkey_id: string;
    blob: string;
    created_at: string;
    updated_at: string;
}

// The address must be bound to this user (users_address join address).
const getUserBoundAddress = async (
    c: Context<HonoCustomType>,
    user_id: number,
    address: string
): Promise<{ name: string; encryption_public_key: string | null } | null> => {
    return await c.env.DB.prepare(
        `SELECT a.name, a.encryption_public_key FROM address a`
        + ` JOIN users_address ua ON ua.address_id = a.id`
        + ` WHERE ua.user_id = ? AND a.name = ?`
    ).bind(user_id, address).first<{ name: string; encryption_public_key: string | null }>();
}

export default {
    getKeyBackups: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        if (!getBooleanValue(c.env.ENABLE_MAIL_ENCRYPTION)) {
            return c.text(msgs.MailEncryptionDisabledMsg, 400)
        }
        const { user_id } = c.get("userPayload");
        const { address } = c.req.query();
        if (!address) {
            return c.text(msgs.InvalidInputMsg, 400)
        }
        const bound = await getUserBoundAddress(c, user_id, address);
        if (!bound) {
            return c.text(msgs.AddressNotBindedMsg, 400)
        }
        const { results } = await c.env.DB.prepare(
            `SELECT id, address, key_id, passkey_id, blob, created_at, updated_at`
            + ` FROM user_key_backups WHERE user_id = ? AND address = ? ORDER BY id`
        ).bind(user_id, address).all<KeyBackupRow>();
        return c.json(results || []);
    },
    putKeyBackup: async (c: Context<HonoCustomType>) => {
        const msgs = i18n.getMessagesbyContext(c);
        if (!getBooleanValue(c.env.ENABLE_MAIL_ENCRYPTION)) {
            return c.text(msgs.MailEncryptionDisabledMsg, 400)
        }
        const { user_id } = c.get("userPayload");
        const { address, key_id, passkey_id, blob } = await c.req.json<{
            address?: string;
            key_id?: string;
            passkey_id?: string;
            blob?: string;
        }>();
        if (!address || !key_id || !passkey_id) {
            return c.text(msgs.InvalidInputMsg, 400)
        }
        const bound = await getUserBoundAddress(c, user_id, address);
        if (!bound) {
            return c.text(msgs.AddressNotBindedMsg, 400)
        }
        if (!bound.encryption_public_key) {
            return c.text(msgs.MailEncryptionNoPublicKeyMsg, 400)
        }
        if (!(await validatePublicKey(key_id))) {
            return c.text(msgs.InvalidMailEncryptionPublicKeyMsg, 400)
        }
        // The blob may only be attached to one of this user's own registered
        // passkeys so it cannot be pinned to an arbitrary credential.
        const ownPasskey = await c.env.DB.prepare(
            `SELECT id FROM user_passkeys WHERE user_id = ? AND passkey_id = ?`
        ).bind(user_id, passkey_id).first("id");
        if (!ownPasskey) {
            return c.text(msgs.InvalidKeyBackupMsg, 400)
        }
        if (!validateKeyBackupBlob(blob)) {
            return c.text(msgs.InvalidKeyBackupMsg, 400)
        }
        // An upsert of an existing (address, key_id, passkey_id) tuple is
        // always allowed; only brand-new tuples count against the caps.
        const existing = await c.env.DB.prepare(
            `SELECT id FROM user_key_backups`
            + ` WHERE user_id = ? AND address = ? AND key_id = ? AND passkey_id = ?`
        ).bind(user_id, address, key_id, passkey_id).first("id");
        if (!existing) {
            const perAddress = await c.env.DB.prepare(
                `SELECT COUNT(*) AS count FROM user_key_backups WHERE user_id = ? AND address = ?`
            ).bind(user_id, address).first<number>("count") || 0;
            if (perAddress >= KEY_BACKUP_MAX_PER_ADDRESS) {
                return c.text(msgs.KeyBackupLimitReachedMsg, 409)
            }
            const perUser = await c.env.DB.prepare(
                `SELECT COUNT(*) AS count FROM user_key_backups WHERE user_id = ?`
            ).bind(user_id).first<number>("count") || 0;
            if (perUser >= KEY_BACKUP_MAX_PER_USER) {
                return c.text(msgs.KeyBackupLimitReachedMsg, 409)
            }
        }
        const { success } = await c.env.DB.prepare(
            `INSERT INTO user_key_backups (user_id, address, key_id, passkey_id, blob)`
            + ` VALUES (?, ?, ?, ?, ?)`
            + ` ON CONFLICT(user_id, address, key_id, passkey_id)`
            + ` DO UPDATE SET blob = excluded.blob, updated_at = datetime('now')`
        ).bind(user_id, address, key_id, passkey_id, blob).run();
        if (!success) {
            return c.text(msgs.OperationFailedMsg, 500)
        }
        return c.json({ success: true });
    },
    deleteKeyBackup: async (c: Context<HonoCustomType>) => {
        const { user_id } = c.get("userPayload");
        const { id } = c.req.param();
        // only the user's own row is ever deleted
        const { success } = await c.env.DB.prepare(
            `DELETE FROM user_key_backups WHERE user_id = ? AND id = ?`
        ).bind(user_id, id).run();
        return c.json({ success });
    },
}
