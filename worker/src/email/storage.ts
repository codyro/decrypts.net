import { Context } from "hono";
import { createMimeMessage } from "mimetext";

import { compressText } from "../gzip";
import { getBooleanValue } from "../utils";
import { encryptMail } from "../utils/mail_crypto";

let tableColumnsCache: Map<string, Set<string>> | undefined;

export const getTableColumns = async (
    env: Bindings, table: string, requiredColumns: string[]
): Promise<Set<string>> => {
    const cachedColumns = tableColumnsCache?.get(table);
    if (cachedColumns && requiredColumns.every(column => cachedColumns.has(column))) {
        return cachedColumns;
    }
    const tableInfo = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    const columns = new Set(tableInfo.results.map(column => column.name));
    if (requiredColumns.every(column => columns.has(column))) {
        tableColumnsCache = tableColumnsCache ?? new Map();
        tableColumnsCache.set(table, columns);
    }
    return columns;
}

const getRawMailTableColumns = async (
    env: Bindings, requiredColumns: string[]
): Promise<Set<string>> => {
    return getTableColumns(env, "raw_mails", requiredColumns);
}

const getSendboxTableColumns = async (
    env: Bindings, requiredColumns: string[]
): Promise<Set<string>> => {
    return getTableColumns(env, "sendbox", requiredColumns);
}

/**
 * Look up the encryption public key of an address. Only queries the
 * encryption_public_key column when the feature is enabled, so deployments
 * that have not migrated keep working with the feature off.
 * Returns null for addresses without a key (stored plaintext).
 */
export const getAddressEncryptionPublicKey = async (
    env: Bindings,
    address: string
): Promise<string | null> => {
    if (!getBooleanValue(env.ENABLE_MAIL_ENCRYPTION)) return null;
    const row = await env.DB.prepare(
        `SELECT encryption_public_key FROM address WHERE name = ?`
    ).bind(address).first<{ encryption_public_key: string | null }>();
    return row?.encryption_public_key ?? null;
};

export const storeRawMail = async (
    env: Bindings,
    source: string,
    address: string,
    messageId: string | null,
    raw: string,
    encryptionPublicKey?: string | null,
): Promise<D1Result> => {
    const gzipEnabled = getBooleanValue(env.ENABLE_MAIL_GZIP);
    const readStatusEnabled = getBooleanValue(env.ENABLE_MAIL_READ_STATUS);
    const requiredColumns: string[] = [];
    if (encryptionPublicKey) requiredColumns.push('is_encrypted');
    if (gzipEnabled && !encryptionPublicKey) requiredColumns.push('raw_blob');
    if (readStatusEnabled) requiredColumns.push('is_unread');

    let tableColumns = new Set<string>();
    if (requiredColumns.length > 0) {
        tableColumns = await getRawMailTableColumns(env, requiredColumns);
    }

    if (encryptionPublicKey) {
        // Encrypt the whole raw MIME before storage. The envelope always goes
        // into the raw TEXT column (never raw_blob); the flag byte inside the
        // envelope records whether the content was gzipped before encryption.
        // Any encryption failure propagates: the store must fail, never fall
        // back to plaintext.
        const envelope = await encryptMail(encryptionPublicKey, raw, { gzip: gzipEnabled });
        // Encrypted rows keep no plaintext metadata: the real sender and
        // Message-ID live inside the encrypted MIME headers and are shown by
        // the browser after decryption.
        const encryptedSource = '';
        const encryptedMessageId = null;
        const storeEncryptedFlag = tableColumns.has('is_encrypted');
        const storeUnreadStatus = readStatusEnabled && tableColumns.has('is_unread');
        const columns = ['source', 'address', 'raw', 'message_id'];
        const values: (string | null)[] = [encryptedSource, address, envelope, encryptedMessageId];
        if (storeEncryptedFlag) {
            columns.push('is_encrypted');
            values.push('1');
        }
        if (storeUnreadStatus) {
            columns.push('is_unread');
            values.push('1');
        }
        return env.DB.prepare(
            `INSERT INTO raw_mails (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
        ).bind(...values).run();
    }

    let rawBlob: ArrayBuffer | undefined;
    if (gzipEnabled && tableColumns.has('raw_blob')) {
        try {
            rawBlob = await compressText(raw);
        } catch (error) {
            console.error("gzip compression failed, falling back to plaintext", error);
        }
    }

    const storeUnreadStatus = readStatusEnabled && tableColumns.has('is_unread');
    if (rawBlob) {
        if (!storeUnreadStatus) {
            return env.DB.prepare(
                `INSERT INTO raw_mails (source, address, raw_blob, message_id) VALUES (?, ?, ?, ?)`
            ).bind(source, address, rawBlob, messageId).run();
        }
        return env.DB.prepare(
            `INSERT INTO raw_mails (source, address, raw_blob, message_id, is_unread) VALUES (?, ?, ?, ?, 1)`
        ).bind(source, address, rawBlob, messageId).run();
    }
    if (!storeUnreadStatus) {
        return env.DB.prepare(
            `INSERT INTO raw_mails (source, address, raw, message_id) VALUES (?, ?, ?, ?)`
        ).bind(source, address, raw, messageId).run();
    }
    return env.DB.prepare(
        `INSERT INTO raw_mails (source, address, raw, message_id, is_unread) VALUES (?, ?, ?, ?, 1)`
    ).bind(source, address, raw, messageId).run();
}

export const deleteRawMail = async (
    env: Bindings, mailId: number, address: string
): Promise<void> => {
    try {
        const { success } = await env.DB.prepare(
            `DELETE FROM raw_mails WHERE id = ? AND address = ?`
        ).bind(mailId, address).run();
        if (!success) throw new Error(`Failed to delete mail ${mailId}`);
    } catch (error) {
        console.error("delete mail error", error);
    }
};

/**
 * Store a sendbox raw payload, encrypting it at rest when the address has an
 * encryption public key. The stored value is the same JSON string the
 * plaintext path stores — either as-is or wrapped in a "cfte1." envelope —
 * and is flagged with is_encrypted when the column exists. Callers must not
 * fall back to plaintext storage when encryption fails.
 */
export const storeSendboxRaw = async (
    env: Bindings,
    address: string,
    raw: string,
    encryptionPublicKey?: string | null,
): Promise<D1Result> => {
    const requiredColumns: string[] = [];
    if (encryptionPublicKey) requiredColumns.push('is_encrypted');
    const tableColumns = requiredColumns.length > 0
        ? await getSendboxTableColumns(env, requiredColumns)
        : new Set<string>();
    let storedRaw = raw;
    let isEncrypted = false;
    if (encryptionPublicKey) {
        storedRaw = await encryptMail(encryptionPublicKey, raw, { gzip: false });
        isEncrypted = true;
    }
    if (isEncrypted && tableColumns.has('is_encrypted')) {
        return env.DB.prepare(
            `INSERT INTO sendbox (address, raw, is_encrypted) VALUES (?, ?, 1)`
        ).bind(address, storedRaw).run();
    }
    return env.DB.prepare(
        `INSERT INTO sendbox (address, raw) VALUES (?, ?)`
    ).bind(address, storedRaw).run();
};

export const sendAdminInternalMail = async (
    c: Context<HonoCustomType>, toMail: string, subject: string, text: string
): Promise<boolean> => {
    try {
        const msg = createMimeMessage();
        msg.setSender({
            name: "Admin",
            addr: "admin@internal"
        });
        msg.setRecipient(toMail);
        msg.setSubject(subject);
        msg.addMessage({
            contentType: 'text/plain',
            data: text
        });
        const messageId = Math.random().toString(36).substring(2, 15);
        // Encrypt for the destination address when it has an encryption key,
        // so admin internal mails are never stored as plaintext for encrypted mailboxes.
        const encryptionPublicKey = await getAddressEncryptionPublicKey(c.env, toMail);
        const { success } = await storeRawMail(
            c.env, "admin@internal", toMail, messageId, msg.asRaw(),
            encryptionPublicKey
        );
        if (!success) {
            console.log(`Failed save message from admin@internal to ${toMail}`);
        }
        return success;
    } catch (error) {
        console.log("sendAdminInternalMail error", error);
        return false;
    }
};
