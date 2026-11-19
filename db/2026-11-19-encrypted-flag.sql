-- Explicit is_encrypted flag on stored mail (raw_mails and sendbox).
--
-- The flag is authoritative for detecting encrypted envelopes: a
-- sender-controlled plaintext whose raw happens to start with "cfte1." must
-- NOT be treated as encrypted on a migrated database. Readers on un-migrated
-- databases (without the column) keep falling back to the prefix check.
-- Existing envelope rows are backfilled to is_encrypted = 1.
ALTER TABLE raw_mails ADD COLUMN is_encrypted INTEGER DEFAULT 0;
ALTER TABLE sendbox ADD COLUMN is_encrypted INTEGER DEFAULT 0;

UPDATE raw_mails SET is_encrypted = 1 WHERE substr(raw, 1, 6) = 'cfte1.';
UPDATE sendbox SET is_encrypted = 1 WHERE substr(raw, 1, 6) = 'cfte1.';
