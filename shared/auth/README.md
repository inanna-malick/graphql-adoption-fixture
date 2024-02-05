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
