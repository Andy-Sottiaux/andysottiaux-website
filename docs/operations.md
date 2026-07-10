# Website Operations

## Data Paths

- Portfolio HTML and API routes: Vercel
- Cam 1 media: `cam1.andysottiaux.com` with `/api/v3/camera/*` fallback
- Cam 2 media: `cam2.andysottiaux.com` with `/api/v3/camera2/*` fallback
- Physical writes: same-origin Vercel API, then authenticated relay request
- Infrastructure management: Tailscale only

The browser must never receive `V3_DEVICE_CONTROL_RELAY_TOKEN`, camera
credentials, or a private relay path token. Public environment variables are
limited to read-only gateway URLs.

Cam 2 WebSocket control uses a 90-second HMAC ticket issued only to an
authenticated control session. Relay and nginx logs redact or omit that ticket.

## Control Password

Generate a password hash without storing the plaintext in the repository:

```bash
printf '%s' '<password>' | shasum -a 256
openssl rand -base64 48
```

Store the digest as `CONTROL_AUTH_PASSWORD_HASH` and the random value as
`CONTROL_AUTH_SECRET` in Vercel Production. Control sessions are HttpOnly,
SameSite Strict, signed, and valid for 30 days. Rotating the signing secret
invalidates every existing session immediately.

`V3_DEVICE_CONTROL_RELAY_TOKEN` must exactly match
`DEVICE_CONTROL_RELAY_TOKEN` on `cayley-relay`. Rotate both sides before
restarting relay services, then redeploy the website.

## Deployment

1. Run `npm run check`.
2. Commit only the intended files.
3. Push `main`; GitHub Actions and Vercel run automatically.
4. Wait for the GitHub quality check and Vercel deployment to finish.
5. Run `npm run monitor:production` and `npm run test:camera`.
6. Confirm unauthenticated POSTs to fan/control/settings return `401`.
7. Unlock controls in the Field Live dialog and confirm a safe fan command and Cam 2 stop command succeed.

## Incident Checks

```bash
curl -fsS https://andysottiaux.com/api/v3/camera/diagnostics | jq .
curl -fsS https://andysottiaux.com/api/v3/camera2/diagnostics | jq .
curl -fsS https://andysottiaux.com/api/v3/health | jq .ok
npm run monitor:production
```

Camera incidents should be traced in this order: production API, public gateway,
relay service, local camera reachability. Do not begin by changing frontend code.
