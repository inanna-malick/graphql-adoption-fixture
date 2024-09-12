# ShipStream API — Shipments

**Version 2.3** · Last updated 14 November 2024

Welcome to the ShipStream API. This reference covers the Shipments resource.
For onboarding, webhooks and returns, see the sections linked in the sidebar of
the developer portal.

Base URL:

```
https://api.shipstream.example
```

Sandbox accounts are served from the same paths; your sandbox key determines
which environment you reach.

---

## Authentication

Every request must carry your API key in the `X-ShipStream-Key` header. We do
not support HTTP Basic, bearer tokens, or query-string keys.

```
GET /api/shipments HTTP/1.1
Host: api.shipstream.example
X-ShipStream-Key: ss_sandbox_7f3a9c21b6e04d5f
```

A missing or unrecognised key returns `401 Unauthorized`:

```json
{
  "error": {
    "type": "authentication_error",
    "message": "Invalid or missing API key. Pass it in the X-ShipStream-Key header.",
    "doc_url": "https://docs.shipstream.example/errors#authentication_error"
  }
}
```

Keys are scoped to an account. The `shipstream_account_id` on each shipment
tells you which of your sub-accounts the shipment belongs to; it is **not** the
same identifier as your own customer id, and we do not store yours.

---

## Rate limits

Sandbox and production keys are both limited to **30 requests per minute**.
Exceeding the limit returns `429 Too Many Requests` with a `Retry-After` header
giving the number of seconds until the window rolls over.

```
HTTP/1.1 429 Too Many Requests
Retry-After: 41
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0
```

```json
{
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit of 30 requests per minute exceeded.",
    "doc_url": "https://docs.shipstream.example/errors#rate_limit_error"
  }
}
```

Successful responses always include `X-RateLimit-Limit` and
`X-RateLimit-Remaining` so you can back off before you are throttled.

---

## Pagination

List endpoints are cursor paginated. **Pagination lives in the `Link` response
header** ([RFC 5988](https://www.rfc-editor.org/rfc/rfc5988)), not in the
response body — a frequent source of confusion for clients that expect a
`next_page` field in the JSON.

```
Link: <https://api.shipstream.example/api/shipments?limit=10&cursor=shp_5010>; rel="next",
      <https://api.shipstream.example/api/shipments?limit=10>; rel="first"
```

Follow `rel="next"` until it is no longer present; that is the end of the
collection. Cursors are opaque — do not construct them yourself. `limit`
defaults to `10` and is capped at `50`.

---

## List shipments

```
GET /api/shipments
```

### Query parameters

| Parameter  | Type    | Description                                        |
|------------|---------|----------------------------------------------------|
| `order_id` | string  | Filter to a single merchant order reference.        |
| `limit`    | integer | Page size. Default `10`, maximum `50`.              |
| `cursor`   | string  | Opaque cursor from a `Link` header.                 |

### Response

```json
{
  "shipments": [
    {
      "id": "shp_5001",
      "order_id": "ord_1001",
      "shipstream_account_id": "SS-ACCT-4201",
      "shipment_status": "in_transit",
      "carrier": "NorthPoint Freight",
      "tracking_number": "1Z9000037",
      "created_at": "2025-01-01T09:40:00Z",
      "last_scan_location": "Akron, OH"
    }
  ]
}
```

---

## Retrieve a shipment

```
GET /api/shipments/{id}
```

### Response

```json
{
  "shipment": {
    "id": "shp_5001",
    "order_id": "ord_1001",
    "shipstream_account_id": "SS-ACCT-4201",
    "shipment_status": "in_transit",
    "carrier": "NorthPoint Freight",
    "tracking_number": "1Z9000037",
    "created_at": "2025-01-01T09:40:00Z",
    "last_scan_location": "Akron, OH"
  }
}
```

Unknown ids return `404 Not Found` with an error object of type `not_found`.

---

## Shipment status values

| Value            | Meaning                                                     |
|------------------|-------------------------------------------------------------|
| `label_created`  | A label has been purchased; the carrier has not scanned it.  |
| `in_transit`     | The carrier has the parcel and is moving it.                 |
| `delivered`      | Delivery confirmed at the destination.                       |

Status transitions are one-way. ShipStream is the system of record for
shipment status; values you may have cached at label-creation time will go
stale, so re-read this endpoint rather than trusting a local copy.
