# Portfolio evidence and release notes

Reviewed September 4, 2026. This is a maintenance record, not a performance guarantee.

## Publication boundaries

- Professional aerospace work remains at role/discipline level. No employer-owned designs, program detail, footage, internal documents, or performance data are published.
- Describe Andy's e-paper contributions as interface design, custom driver work, integration, and reliability testing. Do not imply original authorship of every hardware component.
- Label 3D/CAD renders as visualizations. Do not present them as photos or a physical test.
- The lab guide is a static interactive explanation. Never mix invented or replayed readings into the live dashboard.

## Evidence ledger

- E-paper: 172 hardware-free checks were rerun successfully on September 4: 127 driver/framebuffer/refresh/power-policy checks and 45 runtime/scheduling checks. No physical hardware was exercised. No raw internal source or test documents are published.
- Travel Agent AI: Apple's public listing confirmed 1.38, released August 30, 2026. Test coverage and source review are not a passing test-run claim or an extraction benchmark. Live flight status is disabled in the reviewed product configuration.
- Native product captures: rendered the existing booking review and editor views in an isolated iOS preview with synthetic booking data. Network, account access, and saving were disconnected. The two 1320×2868 screenshots were converted to lossless WebP and their decoded pixels matched the original PNGs exactly. They demonstrate real interface views, not a live extraction run or a production booking.
- WYZECAR: public commit d669b8876eba341eb303227bde4e0a0e13adca70 is the pinned source for architecture, follower, and firmware links. No measured field benchmark or passing automated test result is claimed. The motor-stop flag is non-latching and must not be described as a validated safety interlock.
- Field camera: current operational status belongs to the live cards, not evergreen marketing copy. Missing readings must display an unavailable state, not zero or NaN.

## Analytics

Vercel Web Analytics and Speed Insights remain installed. Project-detail page views can be inspected using their route paths. The team was on the Hobby plan when inspected September 4; Vercel custom events require Pro/Enterprise according to https://vercel.com/docs/analytics/custom-events.

The allow-listed client events in `PortfolioAnalytics` are intentionally disabled. Only after an authorized plan/account change, set `NEXT_PUBLIC_PORTFOLIO_EVENTS=1`, rebuild, and verify events in the dashboard. Supported events: project opened, contact selected, lab opened, walkthrough explored, product opened. The handler records only approved route paths/event names, not email addresses, query strings, inputs, or booking data. Do Not Track suppresses custom events. No billing changes were made.

## Verification

The normal release command is `npm run check`. The finishing suite covers Chromium and WebKit, 320/360/768/1440px viewports, doubled root-font preference, keyboard controls, confidential-work boundaries, dated evidence, unavailable/stale telemetry, and accessibility. A doubled root-font preference is not equivalent to every browser's full-page zoom.

React Doctor is pinned to 0.9.13 after the previous 0.5.8 CLI stalled. The release command enforces errors rather than using score-only mode, and disables remote score/telemetry submission. Five narrow inline exceptions document independently reviewed false positives: three effects with explicit teardown, and two browser-only viewers whose importers disable SSR. No source-wide rule is disabled. Generated Next.js output is excluded; Knip and dependency-cruiser retain the unused-code and dependency checks.

Dependency maintenance raised Next.js and its ESLint configuration to the 15.5.25 patch line, PostCSS to 8.5.28, and compatible vulnerable transitive dependencies to patched releases. The resulting full npm audit reported zero known vulnerabilities. The release check now blocks high/critical dependency advisories. This is a point-in-time audit, not a security guarantee.

For a preview alongside a production build, set `NEXT_DIST_DIR=.next-dev` when launching the development server so its artifacts do not collide with `.next`. Keep preview-only output out of Git.
