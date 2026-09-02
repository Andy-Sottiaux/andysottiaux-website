# Website Operations

## Data Paths

- Portfolio HTML and API routes: Vercel
- Cam 1 media: password session -> same-origin `/api/v3/camera/*` -> authenticated relay
- Cam 2 media: password session -> same-origin `/api/v3/camera2/*` -> authenticated relay
- Physical writes: same-origin Vercel API, then authenticated relay request
- Public health summary: same-origin `/api/v3/health` (service state only; no frames or credentials)
- Infrastructure management: Tailscale only

The browser must never receive `V3_DEVICE_CONTROL_RELAY_TOKEN`, camera
credentials, or a private relay path token. Public gateway host variables are
used only for the short-lived-ticket Cam 2 control socket.

Cam 2 WebSocket control uses a 30-second HMAC ticket issued only to an
authenticated control session. Relay and nginx logs redact or omit that ticket.

## Control Password

Generate a password hash without storing the plaintext in the repository:

```bash
printf '%s' '<password>' | npm run control:hash
openssl rand -base64 48
```

Store the digest as `CONTROL_AUTH_PASSWORD_HASH` and the random value as
`CONTROL_AUTH_SECRET` in Vercel Production. Control sessions are HttpOnly,
SameSite Strict, signed, and valid for 12 hours. Rotating the signing secret
invalidates every existing session immediately.

`V3_DEVICE_CONTROL_RELAY_TOKEN` must exactly match
`DEVICE_CONTROL_RELAY_TOKEN` on `cayley-relay`. Rotate both sides before
restarting relay services, then redeploy the website.

The route-level attempt bucket is defense in depth only because Vercel can run
multiple function instances. Production also has a Vercel WAF fixed-window
rule on exactly `POST /api/v3/control-auth`: six requests per IP per 600
seconds, followed by HTTP 429. Keep that rule active whenever this access
boundary is public.

## Relay Source Ownership

The canonical relay runtime, installers, systemd units, and recovery utilities
live in `https://github.com/Andy-Sottiaux/cayley-relay`. This website repository
keeps only browser-facing configuration and operator notes; do not copy relay
executables back into `ops/`.

## Deployment

1. Run `npm run check`.
2. Commit only the intended files.
3. Push `main`; GitHub Actions and Vercel run automatically.
4. Wait for the GitHub quality check and Vercel deployment to finish.
5. Run `npm run monitor:production`, then run
   `CAMERA_ACCESS_PASSWORD='<password>' npm run test:camera`.
6. Confirm unauthenticated POSTs to fan/control/settings return `401`.
7. Unlock controls in the Field Live dialog and confirm a safe fan command and Cam 2 stop command succeed.

## Incident Checks

```bash
test "$(curl -sS -o /dev/null -w '%{http_code}' https://andysottiaux.com/api/v3/camera/diagnostics)" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' https://andysottiaux.com/api/v3/camera2/diagnostics)" = 401
curl -fsS https://andysottiaux.com/api/v3/health | jq .ok
npm run monitor:production
```

Use the unlocked `/lab` surface for private diagnostics. Camera incidents
should be traced in this order: production API, authenticated gateway, relay
service, local camera reachability. Do not begin by changing frontend code.
