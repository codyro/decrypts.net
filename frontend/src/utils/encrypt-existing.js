/**
 * "Encrypt existing mail" browser-side driver.
 *
 * Loops over the address's plaintext rows (inbox and/or sendbox): fetches a
 * batch via GET /api/encrypt_existing/pending, encrypts each raw with the
 * address public key returned by the server (only the public key ever
 * leaves the worker; the private key never does) and uploads strictly the
 * "cfte1." envelopes via POST /api/encrypt_existing. The server re-encrypts
 * the stored rows irreversibly — only the holder of the private key can
 * read them afterwards.
 *
 * The loop is:
 * - idempotent / resumable: every run re-fetches whatever plaintext remains,
 *   and an interrupted run simply leaves the remaining plaintext untouched;
 * - cancellable: pass an AbortSignal; cancellation throws an error named
 *   'AbortError' and uploads nothing further;
 * - fail loud: any request or encryption error aborts the run and is thrown
 *   to the caller, never swallowed.
 */
import { api } from '../api'
import { encryptMail } from './mail-crypto'

const BATCH_LIMIT = 20
const BOXES = ['inbox', 'sendbox']

/**
 * The server's current public key matches none of the keys this device holds
 * for the address. Encrypting would be irreversible, so the run stops before
 * uploading anything (a malicious or stale server key could otherwise lock
 * the user out of their own history).
 */
export class EncryptExistingKeyMismatchError extends Error {
    constructor() {
        super('The server public key does not match any key stored on this device')
        this.name = 'EncryptExistingKeyMismatchError'
    }
}

export class EncryptExistingCancelledError extends Error {
    constructor() {
        super('Encrypt existing mail cancelled')
        this.name = 'AbortError'
    }
}

const throwIfAborted = (signal) => {
    if (signal?.aborted) throw new EncryptExistingCancelledError()
}

/**
 * Encrypt all remaining plaintext mail of the logged-in address.
 *
 * @param {object} opts
 * @param {string} [opts.box] - 'inbox' or 'sendbox'; when omitted both run.
 * @param {(p: {box: string, done: number, remaining: number, encrypted: number, skipped: number}) => void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal]
 * @param {string[]} [opts.expectedPublicKeys] - public keys this device holds for the address;
 *   when non-empty the server key must be one of them or the run stops before any upload.
 * @returns {Promise<{encrypted: number, skipped: number}>} totals across all processed boxes
 */
export const encryptExistingMail = async ({ box, onProgress, signal, expectedPublicKeys } = {}) => {
    const boxes = box ? [box] : BOXES
    const totals = { encrypted: 0, skipped: 0 }
    for (const currentBox of boxes) {
        let afterId = 0
        for (;;) {
            throwIfAborted(signal)
            const { publicKey, remaining, results } = await api.fetch(
                `/api/encrypt_existing/pending?box=${currentBox}`
                + `&limit=${BATCH_LIMIT}&after_id=${afterId}`,
                { showLoading: false }
            )
            if (!Array.isArray(results) || results.length === 0) break
            if (Array.isArray(expectedPublicKeys) && expectedPublicKeys.length > 0
                && !expectedPublicKeys.includes(publicKey)) {
                throw new EncryptExistingKeyMismatchError()
            }
            const items = []
            for (const row of results) {
                throwIfAborted(signal)
                items.push({
                    id: row.id,
                    raw: await encryptMail(publicKey, row.raw, { gzip: false }),
                })
            }
            throwIfAborted(signal)
            const res = await api.fetch('/api/encrypt_existing', {
                method: 'POST',
                body: JSON.stringify({ box: currentBox, items }),
                showLoading: false,
            })
            totals.encrypted += (res.encrypted || []).length
            totals.skipped += (res.skipped || []).length
            afterId = Math.max(...results.map((row) => row.id))
            const done = totals.encrypted + totals.skipped
            onProgress?.({
                box: currentBox,
                done,
                remaining: Math.max(0, (remaining ?? 0) - results.length),
                encrypted: totals.encrypted,
                skipped: totals.skipped,
            })
        }
    }
    return totals
}
