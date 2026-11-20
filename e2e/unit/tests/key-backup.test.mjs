import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    KEY_BACKUP_BLOB_VERSION,
    KEY_BACKUP_MAX_BLOB_BYTES,
    KEY_BACKUP_MIN_BLOB_BYTES,
    KEY_BACKUP_MAX_PER_ADDRESS,
    KEY_BACKUP_MAX_PER_USER,
    validateKeyBackupBlob,
} from '../../../worker/src/utils/key_backup.ts';

const bytesToBase64Url = (bytes) => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return Buffer.from(binary, 'binary').toString('base64url');
};

const blobOf = (firstByte, length) => {
    const bytes = new Uint8Array(length);
    bytes[0] = firstByte;
    for (let i = 1; i < length; i++) bytes[i] = i % 256;
    return bytesToBase64Url(bytes);
};

const validBlob = (length = KEY_BACKUP_MIN_BLOB_BYTES) => blobOf(KEY_BACKUP_BLOB_VERSION, length);

test('constants follow the PRF wrap format contract', () => {
    assert.equal(KEY_BACKUP_BLOB_VERSION, 0x02);
    assert.equal(KEY_BACKUP_MIN_BLOB_BYTES, 62);
    assert.equal(KEY_BACKUP_MAX_BLOB_BYTES, 4096);
    assert.equal(KEY_BACKUP_MAX_PER_ADDRESS, 20);
    assert.equal(KEY_BACKUP_MAX_PER_USER, 200);
});

test('accepts the minimal and maximal valid blobs', () => {
    assert.equal(validateKeyBackupBlob(validBlob()), true);
    assert.equal(validateKeyBackupBlob(validBlob(KEY_BACKUP_MAX_BLOB_BYTES)), true);
});

test('rejects non-string and empty input', () => {
    assert.equal(validateKeyBackupBlob(undefined), false);
    assert.equal(validateKeyBackupBlob(null), false);
    assert.equal(validateKeyBackupBlob(123), false);
    assert.equal(validateKeyBackupBlob(''), false);
});

test('rejects a wrong version byte', () => {
    for (const version of [0x00, 0x01, 0x03, 0xff]) {
        assert.equal(validateKeyBackupBlob(blobOf(version, KEY_BACKUP_MIN_BLOB_BYTES)), false, `version ${version}`);
    }
});

test('rejects blobs outside the size bounds', () => {
    assert.equal(validateKeyBackupBlob(validBlob(KEY_BACKUP_MIN_BLOB_BYTES - 1)), false);
    assert.equal(validateKeyBackupBlob(validBlob(KEY_BACKUP_MAX_BLOB_BYTES + 1)), false);
});

test('rejects non-base64url characters and padding', () => {
    const good = validBlob();
    assert.equal(validateKeyBackupBlob(good + '=='), false);
    assert.equal(validateKeyBackupBlob(good.slice(0, -1) + '+'), false);
    assert.equal(validateKeyBackupBlob(good.slice(0, -1) + '/'), false);
    assert.equal(validateKeyBackupBlob(` ${good}`), false);
});

test('rejects undecodable base64url lengths', () => {
    // 1 char mod 4 cannot be valid unpadded base64url
    assert.equal(validateKeyBackupBlob('A'), false);
});
