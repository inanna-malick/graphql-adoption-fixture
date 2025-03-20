#!/usr/bin/env bash
# Smoke checks for the Meridian stack. Assumes `docker compose up -d` has run
# and every service reports healthy.
#
#   ./scripts/smoke.sh          read-only checks (leaves the fixture untouched)
#   ./scripts/smoke.sh --all    also exercises writes and the ShipStream rate limit
#
# Host ports come from docker-compose.yml and can be overridden via env.
set -uo pipefail

ORDERS="${ORDERS_BASE:-http://localhost:8001}"
INVENTORY="${INVENTORY_BASE:-http://localhost:8012}"
CUSTOMERS="${CUSTOMERS_BASE:-http://localhost:8003}"
SHIPPING="${SHIPPING_BASE:-http://localhost:8004}"
SHIPSTREAM_KEY="${SHIPSTREAM_API_KEY:-ss_sandbox_7f3a9c21b6e04d5f}"
export MERIDIAN_JWT_SECRET="${MERIDIAN_JWT_SECRET:-meridian-dev-secret-not-for-production}"

RUN_ALL=0
[ "${1:-}" = "--all" ] && RUN_ALL=1

TOKEN="$("$(dirname "$0")/../shared/auth/make-token.sh")"
AUTH="Authorization: Bearer ${TOKEN}"
KEY="X-ShipStream-Key: ${SHIPSTREAM_KEY}"

pass=0
fail=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  ok    %s\n' "$name"
    pass=$((pass + 1))
  else
    printf '  FAIL  %s\n        expected: %s\n        actual:   %s\n' "$name" "$expected" "$actual"
    fail=$((fail + 1))
  fi
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "health"
check "orders healthy"          200 "$(status "$ORDERS/health")"
check "inventory healthy"       200 "$(status "$INVENTORY/health")"
check "customers healthy"       200 "$(status "$CUSTOMERS/health")"
check "shipping-mock healthy"   200 "$(status "$SHIPPING/health")"
billing="$(docker ps --filter 'label=com.docker.compose.service=legacy-billing' --format '{{.ID}}' | head -1)"
check "legacy-billing healthy"  inv_9001 \
  "$([ -n "$billing" ] && docker exec "$billing" node src/healthcheck.js 2>/dev/null | tr -d '\r')"

echo "auth"
check "orders rejects no token"     401 "$(status "$ORDERS/v1/orders")"
check "inventory rejects no token"  401 "$(status "$INVENTORY/items")"
check "customers rejects no token"  401 "$(status "$CUSTOMERS/customers")"
check "orders rejects bad token"    401 "$(status -H 'Authorization: Bearer nonsense' "$ORDERS/v1/orders")"

echo "orders"
check "v1 order body" \
  'ord_1001|packed|cus_001|14045' \
  "$(curl -s -H "$AUTH" "$ORDERS/v1/orders/ord_1001" | jq -r '"\(.id)|\(.status)|\(.customerRef)|\(.totalCents)"')"
check "v1 pagination envelope" \
  '2|5' \
  "$(curl -s -H "$AUTH" "$ORDERS/v1/orders?page=2&limit=5" | jq -r '"\(.page)|\(.data|length)"')"
check "v1 line items keep order-time price" \
  'SKU-001|1999' \
  "$(curl -s -H "$AUTH" "$ORDERS/v1/orders/ord_1001/items" | jq -r '.data[0]|"\(.sku)|\(.unitPriceCents)"')"
check "v1 unknown order 404" 404 "$(status -H "$AUTH" "$ORDERS/v1/orders/ord_9999")"
check "v2 order exposes shippingStatus" \
  'label_created|cus_001|2' \
  "$(curl -s -H "$AUTH" "$ORDERS/v2/orders/ord_1001" | jq -r '"\(.shippingStatus)|\(.customerRef)|\(.itemCount)"')"
check "v2 status filter" \
  'true' \
  "$(curl -s -H "$AUTH" "$ORDERS/v2/orders?status=cancelled" | jq -r '[.data[].status]|unique == ["cancelled"]')"

echo "inventory"
check "live field is qty_on_hand" \
  'SKU-001|2199|true' \
  "$(curl -s -H "$AUTH" "$INVENTORY/items/SKU-001" | jq -r '"\(.sku)|\(.unit_price_cents)|\(has("qty_on_hand"))"')"
check "item catalogue size" 30 "$(curl -s -H "$AUTH" "$INVENTORY/items" | jq -r 'length')"
check "unknown sku 404" 404 "$(status -H "$AUTH" "$INVENTORY/items/SKU-999")"

echo "customers"
check "customer profile" \
  'Ada Okonkwo|SS-ACCT-4201' \
  "$(curl -s -H "$AUTH" "$CUSTOMERS/customers/cus_001" | jq -r '"\(.name)|\(.shipstream_account_id)"')"
check "customer list size" 20 "$(curl -s -H "$AUTH" "$CUSTOMERS/customers" | jq -r '.total')"
check "unknown customer 404" 404 "$(status -H "$AUTH" "$CUSTOMERS/customers/cus_999")"
check "customers -> orders inter-service call" \
  'cus_001|ord_1001' \
  "$(curl -s -H "$AUTH" "$CUSTOMERS/customers/cus_001/orders" | jq -r '"\(.customer_id)|\(.orders[0].id)"')"

echo "shipping-mock"
check "rejects missing key"  401 "$(status "$SHIPPING/api/shipments")"
check "rejects wrong key"    401 "$(status -H 'X-ShipStream-Key: nope' "$SHIPPING/api/shipments")"
check "Link header carries the cursor" \
  'true' \
  "$(curl -s -D- -H "$KEY" "$SHIPPING/api/shipments?limit=3" -o /dev/null | grep -qi 'rel="next"' && echo true || echo false)"
check "pagination is absent from the body" \
  'shipments' \
  "$(curl -s -H "$KEY" "$SHIPPING/api/shipments?limit=3" | jq -r 'keys|join(",")')"
check "shipment status for ord_1001" \
  'in_transit' \
  "$(curl -s -H "$KEY" "$SHIPPING/api/shipments?order_id=ord_1001" | jq -r '.shipments[0].shipment_status')"
check "unknown shipment 404" 404 "$(status -H "$KEY" "$SHIPPING/api/shipments/shp_9999")"

echo "cross-service consistency"
order_price="$(curl -s -H "$AUTH" "$ORDERS/v1/orders/ord_1001/items" | jq -r '.data[0].unitPriceCents')"
live_price="$(curl -s -H "$AUTH" "$INVENTORY/items/SKU-001" | jq -r '.unit_price_cents')"
check "ord_1001 price differs from live inventory" \
  'true' "$([ "$order_price" != "$live_price" ] && echo true || echo false)"
orders_view="$(curl -s -H "$AUTH" "$ORDERS/v2/orders/ord_1001" | jq -r '.shippingStatus')"
carrier_view="$(curl -s -H "$KEY" "$SHIPPING/api/shipments?order_id=ord_1001" | jq -r '.shipments[0].shipment_status')"
check "order status split across services" \
  'true' "$([ "$orders_view" != "$carrier_view" ] && echo true || echo false)"

if [ "$RUN_ALL" = 1 ]; then
  echo "writes (mutates the fixture)"
  check "create order" 201 \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$AUTH" -H 'Content-Type: application/json' \
       -d '{"customerRef":"cus_002","items":[{"sku":"SKU-003","productName":"Smoke Widget","unitPriceCents":500,"quantity":2}]}' \
       "$ORDERS/v1/orders")"
  before="$(curl -s -H "$AUTH" "$INVENTORY/items/SKU-002" | jq -r '.qty_on_hand')"
  after="$(curl -s -X POST -H "$AUTH" -H 'Content-Type: application/json' -d '{"quantity":1}' \
           "$INVENTORY/items/SKU-002/reserve" | jq -r '.qty_on_hand')"
  check "reserve decrements stock" "$((before - 1))" "$after"
  check "over-reserve 409" 409 \
    "$(status -X POST -H "$AUTH" -H 'Content-Type: application/json' -d '{"quantity":999999}' \
       "$INVENTORY/items/SKU-002/reserve")"

  echo "rate limit (burns the ShipStream minute budget)"
  seen429=false
  for _ in $(seq 1 35); do
    [ "$(status -H "$KEY" "$SHIPPING/api/shipments/shp_5001")" = "429" ] && seen429=true && break
  done
  check "429 after 30 req/min" true "$seen429"
  check "429 carries Retry-After" 'true' \
    "$(curl -s -D- -H "$KEY" "$SHIPPING/api/shipments/shp_5001" -o /dev/null | grep -qi '^retry-after:' && echo true || echo false)"
fi

echo
echo "${pass} passed, ${fail} failed"
[ "$fail" -eq 0 ]
