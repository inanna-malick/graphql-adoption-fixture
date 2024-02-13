# orders

Node 20 + Express + Prisma (SQLite). Owns orders and their line items.

```
npm install
npx prisma migrate deploy
npm start
```

Needs `DATABASE_URL`, `MERIDIAN_JWT_SECRET`, and `SEED_DATA_DIR` (pointing at
`shared/seed-data`). The database seeds itself from `orders.json` on first boot
and is a no-op after that.

The v1 API is described in `openapi.yaml`.

Note that line items store `productName` and `unitPriceCents` as captured at
order time. Billing needs invoices to reproduce exactly, so we never re-read
those from inventory.
