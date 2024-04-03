CREATE TABLE IF NOT EXISTS customers (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    tier       TEXT NOT NULL,
    created_at TEXT NOT NULL
);
