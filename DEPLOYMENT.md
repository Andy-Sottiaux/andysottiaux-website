# Deployment

Production deploys automatically from the GitHub `main` branch through Vercel.
Do not use a local `vercel --prod` deployment for normal releases.

## Release Flow

```bash
npm ci
npm run check
git status --short
git push origin main
```

After GitHub Actions and Vercel complete, verify:

```bash
npm run monitor:production
npm run test:camera
```

The required Vercel variables are documented in `.env.example`; production
values must remain encrypted in Vercel and must not be committed.
`CONTROL_AUTH_PASSWORD_HASH` must use the versioned scrypt record produced by
`npm run control:hash`; the previous unversioned SHA-256 digest is not accepted.

Confirm the public pages and security headers after deployment:

```bash
curl -fsSI https://andysottiaux.com/work/travel-agent-ai
curl -fsSI https://andysottiaux.com/lab
curl -fsS https://andysottiaux.com/sitemap.xml
curl -fsS https://andysottiaux.com/api/v3/control-auth
```

## Rollback

Revert the bad commit on `main` and push the revert. Vercel will deploy the
previous behavior from the resulting commit while preserving an auditable Git
history.
