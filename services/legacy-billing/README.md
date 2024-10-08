# legacy-billing

gRPC invoicing service. `proto/billing.proto` is the interface; there is no HTTP
surface and no gateway in front of it.

```
npm install
SEED_DATA_DIR=../../shared/seed-data npm start
```

Listens on `:50051` with insecure credentials on the internal network. Reflection
is not enabled, so clients need the `.proto`.
