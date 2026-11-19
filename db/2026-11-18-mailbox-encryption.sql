-- Optional per-mailbox encryption of stored mail: worker holds only the
-- address public key and encrypts each incoming mail before storage.
-- See vitepress-docs guide/feature/mail-encryption.md
ALTER TABLE address ADD COLUMN encryption_public_key TEXT;
