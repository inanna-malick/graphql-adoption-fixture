# Meridian auth

## Internal services

`orders`, `inventory` and `customers` all expect a bearer token:

```
Authorization: Bearer <jwt>
```

Tokens are HS256, signed with a shared secret read from the `MERIDIAN_JWT_SECRET`
environment variable. Every service reads the same variable — there is no key
rotation, no JWKS endpoint, and no per-service audience. Claims we actually look
at: none. The services verify the signature and the `exp` claim, and that is it.

Missing or invalid token gets a `401` with a JSON body:

```json
{ "error": "unauthorized", "message": "missing or invalid bearer token" }
```

Mint a dev token with:

```
./shared/auth/make-token.sh
./shared/auth/make-token.sh someone@meridian.example   # custom subject
```

The script honours `MERIDIAN_JWT_SECRET` and falls back to the same dev default
the compose stack uses, so a token minted with no env set works against a
freshly-composed stack.

## shipping-mock

`shipping-mock` is a stand-in for ShipStream, a third-party SaaS. It does **not**
use our JWTs. It wants a vendor API key in a header:

```
X-ShipStream-Key: <key>
```

See `.env.example` at the repo root for the sandbox key, and
`services/shipping-mock/docs/shipstream-api.md` for their docs.

## legacy-billing

No auth. It is gRPC on an internal port and predates the token work.
