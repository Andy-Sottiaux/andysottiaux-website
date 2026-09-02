#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUDIT_URL="${CAMERA_TRANSPORT_AUDIT_URL:-https://andysottiaux.com}"
STREAM="${CAMERA_TRANSPORT_STREAM:-cayley-sub}"
IMAGE="${CAMERA_TRANSPORT_AUDIT_IMAGE:-node:22-bookworm-slim}"
BLOCK_RANGES="${CAMERA_TRANSPORT_BLOCK_RANGES:-100.64.0.0/10 192.168.0.0/16 10.0.0.0/8}"

docker run --rm \
  --platform linux/amd64 \
  --cap-add NET_ADMIN \
  -e CAMERA_TRANSPORT_AUDIT_URL="$AUDIT_URL" \
  -e CAMERA_TRANSPORT_STREAM="$STREAM" \
  -e CAMERA_ACCESS_PASSWORD="${CAMERA_ACCESS_PASSWORD:-}" \
  -e CAMERA_TRANSPORT_OFFER_URL="${CAMERA_TRANSPORT_OFFER_URL:-/api/v3/camera/webrtc/offer}" \
  -e CAMERA_TRANSPORT_SOURCE_PARAM="${CAMERA_TRANSPORT_SOURCE_PARAM:-stream}" \
  -e CAMERA_TRANSPORT_BLOCK_RANGES="$BLOCK_RANGES" \
  -e CAMERA_TRANSPORT_TIMEOUT_MS="${CAMERA_TRANSPORT_TIMEOUT_MS:-45000}" \
  -e CAMERA_TRANSPORT_ICE_GATHER_TIMEOUT_MS="${CAMERA_TRANSPORT_ICE_GATHER_TIMEOUT_MS:-2500}" \
  -e CAMERA_TRANSPORT_CONNECT_TIMEOUT_MS="${CAMERA_TRANSPORT_CONNECT_TIMEOUT_MS:-9000}" \
  -e CAMERA_TRANSPORT_BROWSER_CHANNEL="${CAMERA_TRANSPORT_BROWSER_CHANNEL:-chrome}" \
  -e CAMERA_TRANSPORT_REQUIRE_CONNECTED="${CAMERA_TRANSPORT_REQUIRE_CONNECTED:-1}" \
  -v "$ROOT_DIR:/work" \
  -w /work \
  "$IMAGE" \
  bash -lc '
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update >/dev/null
apt-get install -y ca-certificates curl gnupg iproute2 dnsutils >/dev/null
npx playwright@1.60.0 install chrome >/dev/null

HOST="$(node -e "console.log(new URL(process.env.CAMERA_TRANSPORT_AUDIT_URL).hostname)")"
IP="$(getent ahostsv4 "$HOST" | awk "NR==1 {print \$1}")"
if [ -z "$IP" ]; then
  echo "failed to resolve $HOST" >&2
  exit 2
fi
echo "$IP $HOST" >> /etc/hosts

for range in $CAMERA_TRANSPORT_BLOCK_RANGES; do
  ip route add blackhole "$range" 2>/dev/null || true
done

node scripts/audit-camera-transport.mjs
'
