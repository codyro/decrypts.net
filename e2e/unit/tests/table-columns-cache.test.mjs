import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';

// Regression: getTableColumns(env, table, []) must never pin a column set that
// predates a migration applied later (a warm isolate would otherwise keep
// writing encrypted rows without the is_encrypted flag).
const storageUrl = new URL('../../../worker/src/email/storage.ts', import.meta.url);
const loadStorage = async () => {
    const source = readFileSync(storageUrl, 'utf8')
        .replace(/^import .*\n/gm, '')
        .replace(/^import\s*\{[\s\S]*?\}\s*from .*\n/gm, '');
    const stubs = `const createMimeMessage = () => ({});
        const compressText = async () => new ArrayBuffer(0);
        const getBooleanValue = () => false;
        const encryptMail = async () => '';`;
    return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(`${stubs}\n${source}`)).toString('base64')}`);
};

const makeEnv = (columnsRef) => ({
    DB: {
        prepare: () => ({
            all: async () => ({ results: columnsRef.columns.map((name) => ({ name })) }),
        }),
    },
});

test('getTableColumns with no required columns never serves a stale cache', async () => {
    const { getTableColumns } = await loadStorage();
    const ref = { columns: ['id', 'raw'] };
    const env = makeEnv(ref);
    assert.equal((await getTableColumns(env, 'raw_mails', [])).has('is_encrypted'), false);
    // migration applied while the isolate is warm
    ref.columns = ['id', 'raw', 'is_encrypted'];
    assert.equal((await getTableColumns(env, 'raw_mails', [])).has('is_encrypted'), true);
});

test('getTableColumns still caches when required columns are present', async () => {
    const { getTableColumns } = await loadStorage();
    const ref = { columns: ['id', 'raw', 'is_unread'] };
    const env = makeEnv(ref);
    assert.equal((await getTableColumns(env, 'raw_mails', ['is_unread'])).has('is_unread'), true);
    ref.columns = ['id'];
    // served from cache (existing behaviour for required columns)
    assert.equal((await getTableColumns(env, 'raw_mails', ['is_unread'])).has('is_unread'), true);
});
