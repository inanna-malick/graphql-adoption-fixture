# shipping-mock

Local stand-in for ShipStream, the third-party carrier aggregator we integrate
with. Same paths, same auth header, same rate limit, same `Link` pagination —
so that code written against the sandbox works against production.

Vendor documentation is mirrored in `docs/shipstream-api.md`.

```
npm install
SHIPSTREAM_API_KEY=... SEED_DATA_DIR=../../shared/seed-data npm start
```

The key goes in `X-ShipStream-Key`; see `.env.example`. This service does not
understand Meridian JWTs.
