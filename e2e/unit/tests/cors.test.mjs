import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    getCorsAllowedOrigins,
    resolveCorsOrigin,
} from '../../../worker/src/utils/cors.ts';

// The e2e compose setup cannot vary per-test env vars without adding a
// dedicated worker container + fixture wrangler.toml, so the CORS
// origin-decision logic lives in a pure helper (worker/src/utils/cors.ts)
// that is unit-tested here; worker.ts wires it into hono cors().

test('getCorsAllowedOrigins: unset or empty keeps unrestricted behaviour', () => {
    assert.deepEqual(getCorsAllowedOrigins(undefined), []);
    assert.deepEqual(getCorsAllowedOrigins(null), []);
    assert.deepEqual(getCorsAllowedOrigins(''), []);
    assert.deepEqual(getCorsAllowedOrigins('[]'), []);
    // invalid JSON falls back to unrestricted
    assert.deepEqual(getCorsAllowedOrigins('not json'), []);
});

test('getCorsAllowedOrigins: parses JSON arrays and trims entries', () => {
    assert.deepEqual(
        getCorsAllowedOrigins('["https://decrypts.net", " http://localhost:5173 "]'),
        ['https://decrypts.net', 'http://localhost:5173'],
    );
    assert.deepEqual(
        getCorsAllowedOrigins(['https://decrypts.net']),
        ['https://decrypts.net'],
    );
    // a non-array JSON value must not crash or leak into the list
    assert.deepEqual(getCorsAllowedOrigins('{"origin":"https://evil.com"}'), []);
});

test('resolveCorsOrigin: unset allow-list echoes `*` for any origin', () => {
    assert.equal(resolveCorsOrigin([], 'https://evil.example'), '*');
    assert.equal(resolveCorsOrigin([], 'https://decrypts.net'), '*');
    // no Origin header (curl, scripts, same-origin GETs) also gets `*`,
    // matching today's cors() default
    assert.equal(resolveCorsOrigin([], undefined), '*');
    assert.equal(resolveCorsOrigin([], ''), '*');
});

test('resolveCorsOrigin: allowed origin is echoed', () => {
    const allowed = ['https://decrypts.net', 'http://localhost:5173'];
    assert.equal(resolveCorsOrigin(allowed, 'https://decrypts.net'), 'https://decrypts.net');
    assert.equal(resolveCorsOrigin(allowed, 'http://localhost:5173'), 'http://localhost:5173');
});

test('resolveCorsOrigin: disallowed origin gets no CORS headers (null)', () => {
    const allowed = ['https://decrypts.net'];
    assert.equal(resolveCorsOrigin(allowed, 'https://evil.example'), null);
    // scheme/port/subdomain must match exactly
    assert.equal(resolveCorsOrigin(allowed, 'http://decrypts.net'), null);
    assert.equal(resolveCorsOrigin(allowed, 'https://sub.decrypts.net'), null);
    assert.equal(resolveCorsOrigin(allowed, 'https://decrypts.net:4443'), null);
});

test('resolveCorsOrigin: no Origin header still succeeds (null = no CORS headers)', () => {
    const allowed = ['https://decrypts.net'];
    assert.equal(resolveCorsOrigin(allowed, undefined), null);
    assert.equal(resolveCorsOrigin(allowed, null), null);
    assert.equal(resolveCorsOrigin(allowed, ''), null);
});
