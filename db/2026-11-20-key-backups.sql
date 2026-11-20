-- Passkey (WebAuthn PRF) wrapped key backups for logged-in user accounts.
-- The server stores ONLY the opaque wrapped blob (AES-GCM wrapped mailbox
-- private key) plus metadata identifying which mailbox key and which passkey
-- credential it belongs to. It never sees the PRF output, the passkey secret
-- or the private key, and cannot unwrap the blob.
CREATE TABLE IF NOT EXISTS user_key_backups (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    key_id TEXT NOT NULL,
    passkey_id TEXT NOT NULL,
    blob TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_key_backups_unique
    ON user_key_backups(user_id, address, key_id, passkey_id);

CREATE INDEX IF NOT EXISTS idx_user_key_backups_user_address
    ON user_key_backups(user_id, address);
