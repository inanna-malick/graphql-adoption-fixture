CREATE TABLE IF NOT EXISTS customers (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    email                 TEXT NOT NULL,
    tier                  TEXT NOT NULL,
    shipstream_account_id TEXT NOT NULL,
    created_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS customers_shipstream_account_id_idx
    ON customers (shipstream_account_id);
