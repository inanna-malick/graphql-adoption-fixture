# Meridian Logistics — services monorepo

Everything that runs behind `api.meridian-logistics.example`. Five services, one
compose file, no shared runtime.

| Service          | Language       | Port  | What it owns                                  |
|------------------|----------------|-------|-----------------------------------------------|
| `orders`         | Node 20        | 8001  | Orders, line items, order lifecycle status     |
| `inventory`      | Python 3.12    | 8002  | SKUs, stock on hand, warehouse assignment      |
| `customers`      | Go             | 8003  | Customer identity, contact details, tier       |
| `shipping-mock`  | Node 20        | 8004  | Local sandbox for the ShipStream carrier API   |
| `legacy-billing` | Node 20 (gRPC) | 50051 | Invoices                                       |

## Getting started

```bash
git clone git@github.com:meridian-logistics/services.git
cd services
cp .env.example .env
docker compose up --build
make seed          # loads the fixture customers, orders and SKUs
```

Once the stack is healthy, mint yourself a development token:

```bash
./shared/auth/make-token.sh
```

and pass it to the internal services:

```bash
curl -H "Authorization: Bearer $(./shared/auth/make-token.sh)" \
     http://localhost:8001/v1/orders/ord_1001
```

`shipping-mock` is the exception — it is a stand-in for a third-party vendor and
uses their API key scheme instead. See `services/shipping-mock/docs/`.

## Layout

```
services/
  orders/          Express + Prisma. openapi.yaml describes the v1 API.
  inventory/       FastAPI + SQLModel. Schema is served at /openapi.json.
  customers/       net/http, no framework.
  shipping-mock/   Vendor sandbox stand-in, with the vendor's docs mirrored.
  legacy-billing/  gRPC. See proto/billing.proto.
shared/
  auth/            Token minting and notes on how auth works.
  seed-data/       Canonical fixture JSON. Every service seeds from here.
```

Each service owns its own SQLite file inside its container. Nothing is shared at
runtime — the only thing the services agree on is the contents of
`shared/seed-data`, and even then they disagree about what to call the fields.

## Conventions, such as they are

`orders` speaks camelCase. `inventory` and `customers` speak snake_case. This is
the result of the three teams shipping independently and nobody wanting to break
their consumers; there is a ticket to unify it (MER-2291) that has been open for
a while.

Money is always integer cents. Timestamps are ISO 8601 in UTC.

## A note on customers

`customers` owns the customer record. `orders` stores a `customerRef` and its own
copy of the shipping address, because the orders team did not want a hard runtime
dependency on customers for order capture. ShipStream knows our customers by
`shipstream_account_id`, which is stored as a column on the customers table and
is the only mapping between the two.

## A note on order status

`orders.status` covers what happens in our warehouses: `placed`, `packed`,
`cancelled`. Once a parcel leaves the building, ShipStream owns the state, and
that is where `label_created` / `in_transit` / `delivered` come from. Answering
"where is my order" means asking both.

## Checks

```bash
./scripts/smoke.sh          # read-only checks against a running stack
./scripts/smoke.sh --all    # also exercises writes and the vendor rate limit
```

## Known gaps

- MER-2291: field naming is inconsistent between services.
- MER-2377: `legacy-billing` has no HTTP interface, so the dashboard team cannot
  read invoices without a Node client.
- MER-2402: there is no single place to ask for an order, its customer, its
  items and its shipment. Every consumer stitches four calls together itself.
