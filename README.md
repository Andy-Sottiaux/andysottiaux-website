# andysottiaux.com

Andy Sottiaux's portfolio and live field-system dashboard. The site combines a
personal portfolio with opt-in Cam 1/Cam 2 streams, edge-AI diagnostics, solar
telemetry, health monitoring, and authenticated physical controls.

## Public Surfaces

- `/` — personal one-screen desktop dashboard, projects, running, and public telemetry
- `/work/travel-agent-ai` — shipped iOS product case study
- `/work/field-camera` — edge camera, relay, and operations case study
- `/work/wyzecar` — robotics and autonomy case study
- `/work/epaper-dashboard` — runner-first embedded display and partial-refresh case study
- `/lab` — full live camera, inference, health, and solar dashboard
- `/lab/dashboard` — compact portfolio and live-system dashboard
- `/preview` — non-indexed dashboard preview

## Stack

- Next.js 15 App Router, React 18, and TypeScript
- Tailwind CSS
- Vercel deployment from GitHub `main`
- Authenticated same-origin media APIs backed by Cloudflare relay ingress
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
CAMERA_ACCESS_PASSWORD='<password>' npm run test:camera
```

`npm run check` runs type checking, a production build, React Doctor, unused
code/dependency audits, architecture rules, and desktop/mobile Playwright tests.
GitHub Actions runs the same gate for every pull request and push to `main`.

Playwright tests run against the production build using `next start`. When
running browser tests separately, build first:

```bash
npm run build
npm run test:e2e
```

The same build prerequisite applies to `npm run test:e2e:ui` and
`npm run audit:a11y`. Rebuild after source changes, and finish any development
server using the same `.next` directory before building or testing to avoid
overlapping development and production output. Playwright uses port 3100 by
default; an existing server on that port must be the production test server.

## Architecture

Cam 1 and Cam 2 viewing is private. The browser authenticates once through a
signed HttpOnly session and all media crosses same-origin API routes. Those
server routes authenticate to `cayley-relay` with a bearer token that never
reaches the browser. Fan, Cam 2 pan/tilt, and persistent settings use the same
access boundary; low-latency Cam 2 WebSocket control receives only a 30-second
signed ticket.

The public homepage and compact dashboard are server-rendered and probe sanitized
relay health with a strict 1.2-second timeout. This uncached probe makes these
routes dynamic even though they declare a revalidation interval. Shared client polling
updates public health and solar readings and pauses in hidden tabs. Camera
access stays opt-in and authenticated; the homepage never starts media simply
because it loaded or a spotlight tab changed. Normal desktop windows fit one
screen; mobile and short windows scroll naturally to keep controls accessible.

Featured project content is defined once in `content/caseStudies.ts` and reused
by the compact dashboard modal, route metadata, sitemap, and server-rendered case-study
pages. The live dashboard is isolated in `components/live` so the dedicated lab
does not load unrelated portfolio modal code.

See [docs/operations.md](docs/operations.md) for environment variables, control
password rotation, deployment, and incident checks.
