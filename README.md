# andysottiaux.com

Andy Sottiaux's portfolio and live field-system dashboard. The site combines a
static portfolio with opt-in Cam 1/Cam 2 streams, edge-AI diagnostics, solar
telemetry, health monitoring, and authenticated physical controls.

## Stack

- Next.js 15 App Router, React 18, and TypeScript
- Tailwind CSS
- Vercel deployment from GitHub `main`
- Cloudflare camera gateways with same-origin Vercel fallbacks
- Tailscale for private infrastructure management
- Playwright, axe, React Doctor, Knip, and dependency-cruiser quality gates

## Local Development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run check
npm run monitor:production
npm run test:camera
```

`npm run check` runs type checking, a production build, React Doctor, unused
code/dependency audits, architecture rules, and desktop/mobile Playwright tests.
GitHub Actions runs the same gate for every pull request and push to `main`.

## Architecture

Public camera viewing remains read-only and goes directly through the camera
gateways when available. Fan, Cam 2 pan/tilt, and persistent stream settings use
same-origin API routes, a signed HttpOnly session, and a server-only bearer token
shared with `cayley-relay`. An authenticated session can mint a 90-second signed
ticket for low-latency Cam 2 WebSocket control; the permanent token stays server-side.

The home page is ISR-cached and probes relay health during regeneration with a
short timeout. A relay outage therefore cannot make every page request wait on
the edge system; client polling updates live state after load.

See [docs/operations.md](docs/operations.md) for environment variables, control
password rotation, deployment, and incident checks.
