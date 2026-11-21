-- One-time sign-in codes mailed to existing users (/login). One row per
-- address; a new code replaces the old one. Only a hash of the code is kept,
-- and a row is deleted on use, after too many wrong tries, or once expired.
CREATE TABLE IF NOT EXISTS login_codes (
    email      TEXT PRIMARY KEY NOT NULL REFERENCES users(email) ON DELETE CASCADE,
    code_hash  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    sent_at    INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0
);
