#!/usr/bin/env bash
# Mints a dev JWT for the Meridian services (orders, inventory, customers).
# Usage: ./shared/auth/make-token.sh [subject]
set -euo pipefail

SECRET="${MERIDIAN_JWT_SECRET:-meridian-dev-secret-not-for-production}"
SUBJECT="${1:-dev@meridian.example}"

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

now=$(date +%s)
header='{"alg":"HS256","typ":"JWT"}'
payload="{\"sub\":\"${SUBJECT}\",\"iss\":\"meridian-dev\",\"iat\":${now},\"exp\":$((now + 86400))}"

h=$(printf '%s' "$header" | b64url)
p=$(printf '%s' "$payload" | b64url)
sig=$(printf '%s' "${h}.${p}" | openssl dgst -binary -sha256 -hmac "$SECRET" | b64url)

printf '%s.%s.%s\n' "$h" "$p" "$sig"
