# Maya — moving to another PC

This archive contains the current project, including uncommitted changes, original footage in `incoming/`, recorded demo fixtures, benchmark outputs, rendered audio, posters, documentation, the updated voiceover script, and deployment configuration.

Excluded: installed dependencies, build caches, Git history, the Python virtual environment, downloaded benchmark weights, test output, and real `.env` files/API keys. The served `public/fixtures` copy is excluded because the project recreates it automatically before development and production builds. The source fixtures are included.

## Run the recorded website

1. Extract the ZIP, then open a terminal in the extracted `Maya` folder (the folder containing `package.json`).
2. Install Node.js and pnpm. This copy was checked on Node.js 26.12.0 and pnpm 12.14.0. `package.json` pins pnpm 12.14.0; you can install it using `npm install --global pnpm@12.14.0`.
3. Install the project dependencies:

   ```sh
   pnpm install --frozen-lockfile
   ```

4. Start it:

   ```sh
   pnpm dev -p 3310
   ```

5. Open http://localhost:3310/.

The recorded website needs no API keys, Python environment, model downloads or GPU. Its predev/prebuild hook copies the included fixtures to `public/fixtures`.

## Build and run in production mode

```sh
pnpm build
pnpm start
```

The production server defaults to port 3000. To use port 3310, run `pnpm start -p 3310`.

For a host that runs Next.js directly, the install command is `pnpm install --frozen-lockfile`, the build command is `pnpm build`, and the start command is `pnpm start`. This project is not configured as a plain static HTML export.

## Cloudflare deployment — existing project configuration

The project already includes OpenNext and `wrangler.jsonc` for Cloudflare Workers. After installing dependencies, sign in to the Cloudflare account you want to use:

```sh
pnpm exec wrangler login
```

Preview the Worker locally:

```sh
pnpm preview
```

Deploy when ready:

```sh
pnpm deploy
```

The configured Worker name is `maya-web`; change `name` in `wrangler.jsonc` if your destination account requires a different name. The deployment commands build the Worker and website assets on the new PC. No build artifacts from the old PC are required.

Cloudflare authentication is deliberately not included. A successful fresh production build and external deployment have not been verified by this transfer package.

## Optional: regenerate the model outputs

Only do this if you intend to make new API calls. Copy `.env.example` to `.env` and fill your own credentials locally. `.env.example` is included with empty key values; actual keys have not been packaged.

See README.md for recording/evaluation commands. Re-running the Python benchmark/media scripts also requires installing their Python dependencies and any model weights; the old machine's environment is intentionally not portable or included. Existing recordings work without this step.

## Read before publishing

- `docs/DEMO_READINESS.md`: the completed review and remaining presentation/privacy issues. This archive preserves the current project; it does not fix those outstanding items.
- `docs/VOICEOVER.md`: the shorter introduction, expanded technical narration, and matching screen-capture cues.
- `docs/LIMITS.md`: recorded replay versus unfinished live functionality.

In particular, repository/code links are still placeholders, Try uses placeholder analysis, some human audio is silent, and the privacy wording/media need review. Moving and deploying this project does not implement the live backend or cross-device caregiver pairing.
