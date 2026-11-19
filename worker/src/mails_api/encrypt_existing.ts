import { Context } from 'hono'

import i18n from '../i18n';
import { getBooleanValue } from '../utils';
import { getTableColumns } from '../email/storage';
import { resolveRawEmail } from '../gzip';
import { isEncryptedMailRow, validateEnvelope } from '../utils/mail_crypto';

/**
 * "Encrypt existing mail" endpoints (address-JWT authed).
 *
 * The browser fetches each plaintext message via GET pending, encrypts it
 * to the address's current public key and uploads only the envelope via
 * POST. The server never sees any private key and must NEVER accept
 * anything that downgrades or stores plaintext: uploads are strictly
 * validated as "cfte1." envelopes, must target a row owned by the JWT
 * address, and must currently be plaintext (an encrypted row is never
 * overwritten).
 */

const BOXES = ['inbox', 'sendbox'] as const;
type Box = typeof BOXES[number];

const MAX_ITEMS = 50;
const DEFAULT_LIMIT = 20;
// Bound the pending response even when `limit` rows would exceed it.
const MAX_PENDING_TOTAL_CHARS = 10 * 1024 * 1024;

type SkipReason = 'invalid_envelope' | 'not_found' | 'already_encrypted';

type EncryptItem = { id: number, raw: string };

const boxToTable = (box: Box): string => box === 'inbox' ? 'raw_mails' : 'sendbox';

/**
 * SQL predicate matching plaintext rows of this address's box. On a migrated
 * database the explicit is_encrypted flag is authoritative (a
 * sender-controlled plaintext may start with "cfte1."); un-migrated
 * databases fall back to the envelope prefix. `raw IS NULL` covers
 * pre-migration gzip rows whose plaintext lives in raw_blob.
 */
const plaintextFilter = (hasEncryptedFlag: boolean): string => hasEncryptedFlag
    ? `(is_encrypted IS NULL OR is_encrypted = 0)`
    : `(raw IS NULL OR raw NOT LIKE 'cfte1.%')`;

const getPending = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_MAIL_ENCRYPTION)) {
        return c.text(msgs.MailEncryptionDisabledMsg, 400)
    }
    const { address } = c.get("jwtPayload");
    const keyRow = await c.env.DB.prepare(
        `SELECT encryption_public_key FROM address WHERE name = ?`
    ).bind(address).first<{ encryption_public_key: string | null }>();
    if (!keyRow?.encryption_public_key) {
        return c.text(msgs.MailEncryptionNoPublicKeyMsg, 400)
    }

    const boxParam = c.req.query('box') || 'inbox';
    if (boxParam !== 'inbox' && boxParam !== 'sendbox') {
        return c.text(msgs.InvalidRequestBodyMsg, 400)
    }
    const box: Box = boxParam;
    const limitParam = Number.parseInt(c.req.query('limit') ?? '', 10);
    const limit = Number.isNaN(limitParam) ? DEFAULT_LIMIT : limitParam;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ITEMS) {
        return c.text(msgs.InvalidRequestBodyMsg, 400)
    }
    const afterIdParam = Number.parseInt(c.req.query('after_id') ?? '', 10);
    const afterId = Number.isNaN(afterIdParam) ? 0 : afterIdParam;
    if (!Number.isSafeInteger(afterId) || afterId < 0) {
        return c.text(msgs.InvalidRequestBodyMsg, 400)
    }

    const table = boxToTable(box);
    const columns = await getTableColumns(c.env, table, []);
    const filter = plaintextFilter(columns.has('is_encrypted'));

    const remainingRow = await c.env.DB.prepare(
        `SELECT count(*) AS count FROM ${table} WHERE address = ? AND ${filter}`
    ).bind(address).first<{ count: number }>();
    const remaining = remainingRow?.count ?? 0;

    const selectColumns = ['id', 'raw'];
    if (box === 'inbox' && columns.has('raw_blob')) {
        selectColumns.push('raw_blob');
    }
    const rows = await c.env.DB.prepare(
        `SELECT ${selectColumns.join(', ')} FROM ${table}`
        + ` WHERE address = ? AND ${filter} AND id > ?`
        + ` ORDER BY id ASC LIMIT ?`
    ).bind(address, afterId, limit).all<{ id: number, raw?: string, raw_blob?: unknown }>();

    const results: { id: number, raw: string }[] = [];
    let totalChars = 0;
    for (const row of rows.results ?? []) {
        // resolveRawEmail decompresses raw_blob (gzip) when needed.
        const raw = await resolveRawEmail(row);
        if (results.length > 0 && totalChars + raw.length > MAX_PENDING_TOTAL_CHARS) {
            break;
        }
        totalChars += raw.length;
        results.push({ id: row.id, raw });
    }
    return c.json({
        publicKey: keyRow.encryption_public_key,
        remaining,
        results,
    });
};

const postEncrypt = async (c: Context<HonoCustomType>) => {
    const msgs = i18n.getMessagesbyContext(c);
    if (!getBooleanValue(c.env.ENABLE_MAIL_ENCRYPTION)) {
        return c.text(msgs.MailEncryptionDisabledMsg, 400)
    }
    const { address } = c.get("jwtPayload");
    const keyRow = await c.env.DB.prepare(
        `SELECT encryption_public_key FROM address WHERE name = ?`
    ).bind(address).first<{ encryption_public_key: string | null }>();
    if (!keyRow?.encryption_public_key) {
        return c.text(msgs.MailEncryptionNoPublicKeyMsg, 400)
    }

    const body = await c.req.json<{ box?: unknown, items?: unknown }>();
    if (body?.box !== 'inbox' && body?.box !== 'sendbox') {
        return c.text(msgs.InvalidRequestBodyMsg, 400)
    }
    const box: Box = body.box;
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ITEMS) {
        return c.text(msgs.InvalidRequestBodyMsg, 400)
    }
    for (const item of body.items) {
        if (!item || typeof item !== 'object'
            || !Number.isSafeInteger((item as EncryptItem).id)
            || (item as EncryptItem).id <= 0
            || typeof (item as EncryptItem).raw !== 'string') {
            return c.text(msgs.InvalidRequestBodyMsg, 400)
        }
    }
    const items = body.items as EncryptItem[];

    const table = boxToTable(box);
    const columns = await getTableColumns(c.env, table, []);
    const hasEncryptedFlag = columns.has('is_encrypted');

    const skipped: { id: number, reason: SkipReason }[] = [];
    const encrypted: number[] = [];
    const statements: { id: number, stmt: D1PreparedStatement }[] = [];

    const selectColumns = ['id', 'raw'];
    if (hasEncryptedFlag) {
        selectColumns.push('is_encrypted');
    }

    for (const item of items) {
        // validateEnvelope only enforces the envelope shape: the server has
        // no private key and can never verify which key the content was
        // encrypted to (nor may it decrypt). Anything that is not a
        // well-formed envelope is skipped so no plaintext path exists.
        if (!validateEnvelope(item.raw)) {
            skipped.push({ id: item.id, reason: 'invalid_envelope' });
            continue;
        }
        const row = await c.env.DB.prepare(
            `SELECT ${selectColumns.join(', ')} FROM ${table} WHERE id = ? AND address = ?`
        ).bind(item.id, address).first<{ id: number, raw?: string, is_encrypted?: number | null }>();
        if (!row) {
            // also covers rows of other addresses: the address filter above
            // never lets a client touch another address's mail.
            skipped.push({ id: item.id, reason: 'not_found' });
            continue;
        }
        if (isEncryptedMailRow(row)) {
            skipped.push({ id: item.id, reason: 'already_encrypted' });
            continue;
        }
        const sets = ['raw = ?'];
        const values: (string | null)[] = [item.raw];
        if (box === 'inbox' && columns.has('raw_blob')) {
            sets.push('raw_blob = NULL');
        }
        if (hasEncryptedFlag) {
            sets.push('is_encrypted = 1');
        }
        if (box === 'inbox') {
            // metadata hardening: the real sender and Message-ID live inside
            // the encrypted MIME headers, shown by the browser after decrypt.
            if (columns.has('source')) {
                sets.push(`source = ''`);
            }
            if (columns.has('message_id')) {
                sets.push('message_id = NULL');
            }
        }
        const stmt = c.env.DB.prepare(
            `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ? AND address = ?`
            // re-apply the plaintext filter in the UPDATE itself so an
            // encrypted row can never be overwritten, even if it changed
            // between the check above and this statement.
            + ` AND ${plaintextFilter(hasEncryptedFlag)}`
        ).bind(...values, item.id, address);
        statements.push({ id: item.id, stmt });
    }

    if (statements.length > 0) {
        const results = await c.env.DB.batch(statements.map(entry => entry.stmt));
        results.forEach((result, index) => {
            const id = statements[index].id;
            if ((result.meta?.changes ?? 0) > 0) {
                encrypted.push(id);
            } else {
                // the plaintext guard rejected the update: the row became
                // encrypted in the meantime.
                skipped.push({ id, reason: 'already_encrypted' });
            }
        });
    }

    return c.json({ success: true, encrypted, skipped });
};

export default { getPending, postEncrypt };
