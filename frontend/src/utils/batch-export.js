/**
 * Pure CSV building for the admin batch-create export.
 *
 * Rows are { address, jwt, privateKey? }. When any row carries a privateKey
 * (batch created with mail encryption enabled), the export gains
 * `private_key` and `decryption_link` columns; without keys the output is
 * byte-identical to the historical two-column format.
 */

export const quoteCsvValue = (value, spreadsheetSafe) => {
    let text = String(value)
    // Leading ' keeps spreadsheets from evaluating a cell (e.g. an =PREFIX address) as a formula.
    if (spreadsheetSafe) text = text.replace(/^[=+\-@\t\r]/, "'$&")
    return `"${text.replace(/"/g, '""')}"`
}

/**
 * Build the export CSV plus suggested filename.
 * origin is the frontend base URL used for login/decryption links.
 */
export const buildBatchExportCsv = (rows, { spreadsheetSafe = true, origin } = {}) => {
    const encrypted = rows.some((row) => typeof row.privateKey === 'string' && row.privateKey.length > 0)
    const header = encrypted
        ? ['address', 'login_url', 'private_key', 'decryption_link']
        : ['address', 'login_url']
    const lines = [header, ...rows.map((row) => {
        const values = [
            row.address,
            `${origin}/?jwt=${encodeURIComponent(row.jwt)}`,
        ]
        if (encrypted) {
            values.push(
                row.privateKey || '',
                row.privateKey
                    ? `${origin}/#k=${encodeURIComponent(row.privateKey)}&a=${encodeURIComponent(row.address)}`
                    : '',
            )
        }
        return values
    })]
    const csv = lines.map((line) => line.map((value) => quoteCsvValue(value, spreadsheetSafe)).join(',')).join('\r\n')
    return {
        csv,
        filename: spreadsheetSafe ? 'mailbox-login-links.csv' : 'mailbox-login-links-raw.csv',
    }
}
