# Maya deployment

- **Live site:** https://maya-web.fsameha.workers.dev
- **GitHub:** https://github.com/fsameha/maya
- **Local checkout:** `/home/sameha/Projects/Maya`
- **Local production server:** http://localhost:3000
- **Worker:** `maya-web`, deployed through OpenNext.

## Publish an update

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm deploy
```

Authenticate with `pnpm exec wrangler login` if required. GitHub pushes run the checks in `.github/workflows/ci.yml`; publishing to Cloudflare currently uses `pnpm deploy`.

## Runtime compatibility

Keep `cacheComponents` and `partialPrefetching` disabled in `next.config.ts` for this pinned Next.js 16.4.4 / OpenNext 1.20.15 deployment. The initial deployment built successfully and passed Node-based browser tests, but returned Cloudflare error 1101 on every page. Worker logs warned about Cache Components and `setTimeout()`, then reported a request that would never produce a response. Disabling that feature fixed the production requests. These replay routes prerender without it.

Verify in the actual Workers environment after deployment, even when local checks pass:

```bash
curl --fail --silent --show-error --output /dev/null \
  --write-out '%{http_code}\n' https://maya-web.fsameha.workers.dev/
E2E_BASE_URL=https://maya-web.fsameha.workers.dev pnpm e2e
```

Use `PW_CHROMIUM=/usr/bin/chromium` on this PC to run browser tests with its installed browser. On other machines, install the test browser with `pnpm exec playwright install chromium`.

The deployed site replays recorded model outputs; no Meta or ElevenLabs credentials are needed to run or deploy it. Raw footage, private environment files, and build output stay outside Git.
