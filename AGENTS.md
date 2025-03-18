# Working in this repository

This is the Meridian Logistics services monorepo — everything that runs behind
`api.meridian-logistics.example`. Read this before making changes; the repo does
not look the way a greenfield monorepo would, and most of that is on purpose.

## The shape of the thing

Five services, each owned by a different team, each with its own runtime, its own
dependency manifest and its own database. There is no shared library, no shared
ORM and no shared base image. A change to one service should not require touching
another.

```
services/
  orders/          Node 20, Express, Prisma -> SQLite.        Orders team.
  inventory/       Python 3.12, FastAPI, SQLModel -> SQLite.  Warehouse team.
  customers/       Go, stdlib net/http, database/sql.         Identity team.
  shipping-mock/   Node 20, Express. Stands in for a vendor.  Platform.
  legacy-billing/  Node 20, gRPC. No HTTP surface.            Platform.
shared/
  auth/            Token minting and notes on how auth works.
  seed-data/       Canonical fixture JSON, loaded by every service.
scripts/
  smoke.sh         End-to-end checks against a running stack.
```

Ports, environment variables and service dependencies are declared in
`docker-compose.yml`. That file is the authority — prefer it over prose.

## Where each service's interface is defined

There is no single place to look, which is a recurring source of pain:

| Service          | Interface lives in                                      |
|------------------|---------------------------------------------------------|
| `orders`         | `services/orders/openapi.yaml`, describing the v1 API.    |
| `inventory`      | FastAPI generates it; the running service serves it at `/openapi.json`. |
| `customers`      | Nothing published. Read `main.go` and `routes.go`.        |
| `shipping-mock`  | The vendor's own docs, mirrored in `docs/shipstream-api.md`. |
| `legacy-billing` | `proto/billing.proto`. Reflection is not enabled.         |

## Conventions

**Naming is not consistent between services and you should not make it
consistent as a drive-by.** `orders` serves camelCase. `inventory` and
`customers` serve snake_case. Each one has external consumers that would break.
There is a ticket (MER-2291) if you want to argue about it. When editing a
service, match what that service already does.

**Money is always an integer count of cents.** Never a float, never a string,
never a currency-formatted value. The field is suffixed `_cents` / `Cents`.

**Timestamps are ISO 8601 in UTC**, stored as strings.

**Databases are private.** Each service owns a SQLite file inside its own
container. Nothing reads another service's database — if you need someone else's
data, you call their API.

**Cross-service calls are rare and deliberate.** Today there is exactly one:
`customers` calls `orders` to assemble a customer's order history, forwarding
the caller's bearer token. Adding a second one is a design decision, not an
implementation detail — the teams have pushed back on new runtime coupling
before.

## Auth

`orders`, `inventory` and `customers` expect `Authorization: Bearer <jwt>`,
HS256, signed with a secret all three read from the same environment variable.
`shared/auth/make-token.sh` mints one for local use.

`shipping-mock` is different: it imitates a third-party vendor and wants that
vendor's API key in a header instead. `legacy-billing` has no auth at all. This
asymmetry is real and is not worth "fixing" without talking to Platform.

## Fixture data

`shared/seed-data/*.json` is mounted into every service and is the reason the
services agree about anything. The ids are stable and are referenced by hand in
docs, tickets and the smoke checks — `cus_001`, `ord_1001`, `SKU-001` in
particular. Changing these files changes every service at once, so treat edits
to them as a cross-team change rather than a local one.

Note that the data intentionally contains disagreements between services: an
order's stored line-item price is a snapshot from order time and is not expected
to match what inventory currently charges. Do not "correct" these.

## Before you call something done

```bash
docker compose up -d --build
./scripts/smoke.sh
```

`smoke.sh` is read-only by default. `./scripts/smoke.sh --all` additionally
exercises order creation, stock reservation and the vendor rate limit; it leaves
data behind, so bring the stack down afterwards if you care about a clean slate.

There is no unit test suite. The smoke checks are what we have.
