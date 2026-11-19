import { describe, expect, it } from 'vitest';
import { buildBatchExportCsv, quoteCsvValue } from '../batch-export';

const ORIGIN = 'https://mail.example.com';

describe('batch-export', () => {
    it('keeps the historical two-column format without private keys', () => {
        const rows = [
            { address: 'a@test.example.com', jwt: 'jwt-a' },
            { address: '=1+1@test.example.com', jwt: 'jwt,"5"' },
        ]
        const { csv, filename } = buildBatchExportCsv(rows, { spreadsheetSafe: true, origin: ORIGIN })
        expect(csv).toBe(
            '"address","login_url"\r\n'
            + '"a@test.example.com","https://mail.example.com/?jwt=jwt-a"\r\n'
            + '"\'=1+1@test.example.com","https://mail.example.com/?jwt=jwt%2C%225%22"'
        )
        expect(filename).toBe('mailbox-login-links.csv')
    })

    it('lossless mode does not inject the spreadsheet guard', () => {
        const { csv, filename } = buildBatchExportCsv(
            [{ address: '+alice@test.example.com', jwt: 'jwt-1' }],
            { spreadsheetSafe: false, origin: ORIGIN },
        )
        expect(csv).toBe(
            '"address","login_url"\r\n'
            + '"+alice@test.example.com","https://mail.example.com/?jwt=jwt-1"'
        )
        expect(filename).toBe('mailbox-login-links-raw.csv')
    })

    it('adds private_key and decryption_link columns when a row has a key', () => {
        const rows = [
            { address: 'enc@test.example.com', jwt: 'jwt-enc', privateKey: 'private-key-b64url' },
        ]
        const { csv, filename } = buildBatchExportCsv(rows, { spreadsheetSafe: true, origin: ORIGIN })
        expect(csv).toBe(
            '"address","login_url","private_key","decryption_link"\r\n'
            + '"enc@test.example.com","https://mail.example.com/?jwt=jwt-enc",'
            + '"private-key-b64url",'
            + '"https://mail.example.com/#k=private-key-b64url&a=enc%40test.example.com"'
        )
        expect(filename).toBe('mailbox-login-links.csv')
    })

    it('applies spreadsheet-safe escaping to the key columns too', () => {
        const { csv } = buildBatchExportCsv(
            [{ address: 'a@test.example.com', jwt: 'jwt', privateKey: '=leading-equals' }],
            { spreadsheetSafe: true, origin: ORIGIN },
        )
        expect(csv.split('\r\n')[1]).toContain('"\'=leading-equals"')
    })

    it('quoteCsvValue escapes quotes and honors the spreadsheet guard', () => {
        expect(quoteCsvValue('a"b', false)).toBe('"a""b"')
        expect(quoteCsvValue('-lead', true)).toBe('"\'-lead"')
        expect(quoteCsvValue('-lead', false)).toBe('"-lead"')
    })
})
