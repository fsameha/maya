# Website architecture

The website never calls a model. Everything it shows arrives as `MayaEvent`s through one interface, `MayaSource` (`lib/contract.ts`, PRD §14). Swapping placeholder fixtures for recorded runs, and later for live, needs no UI change.

```
fixtures/<run>/run.json  ─┐                     ┌─ CameraPane  (camera slice)
(or run.placeholder.json) ├─ MayaSource ─ Player ┼─ MayaPane    (conversation slice)
live (Durable Object WS) ─┘  lib/source   lib/player └─ PhonePane (caregiver slice)
                                                   └─ How it works stages, Try inspector
```

## Data flow

- `lib/source/index.ts` picks the source from `NEXT_PUBLIC_MAYA_SOURCE` (`fixture` by default; `live` is a stub that throws `NotWiredYet`).
- `lib/source/fixture.ts` reads `/fixtures/index.json` (written by `scripts/sync-fixtures.mjs`) and loads `run.json` when the backend has recorded one, else `run.placeholder.json`.
- `/fixtures` at the repo root is the source of truth. `predev`/`prebuild` copy it to `public/fixtures` so it is served at `/fixtures/...`.
- `lib/player.ts` keeps one clock (play, pause, seek, speed) and emits events at their `at` time. A backward seek resets subscribers and replays from t=0, so state is deterministic.
- `components/theatre/model.ts` folds events into pane state with a pure `step()`. Unit tests assert that every fixture event changes the UI and that a seek rebuilds identical state.

## Mascot and lip-sync

- `components/maya/` is one inline SVG rig. The head is traced from the reference PNGs (potrace, rounded). Every mouth and eye pose is the same 4-cubic "lens" path, so poses interpolate point-for-point.
- One `requestAnimationFrame` loop per mascot: gaze (τ = 90 ms, dead zone 0.06), saccades, blink (0 → 40 → 65 → 100 → 150 ms), breathing, head tilt, and a critically damped spring (ω ≈ 28) on the mouth parameters. It pauses off-screen and in hidden tabs.
- `lib/lipsync.ts` turns ElevenLabs character alignment (or word times, or text at 14 chars/s) into a viseme track with hold rules, MBP priority and a 60 ms look-ahead. It is sampled on the player clock, with amplitude from the shared `AnalyserNode`.

## Audio

`lib/audio.ts` holds one `AudioContext`, started on the first user gesture. `AudioScheduler` keeps every spoken clip in step with the player across play, pause, seek and 1.5×.

## Styling

Astryx (`@astryxdesign/core`) with the pre-built `maya` theme (`lib/theme/`, rebuilt with `pnpm theme:build`). Tailwind v4 is used for layout only. Colours and motion tokens live in `lib/tokens.css` (PRD §3, §4).

## Deploy

Next.js on Cloudflare Workers via `@opennextjs/cloudflare` (`open-next.config.ts`, `wrangler.jsonc`). Use `pnpm preview` for a local Worker and `pnpm deploy` to publish.

# System (backend) as built

```
Pixel 7 corner camera ──► 10 s clips (H.264 MP4)
        │  motion gate: 64×36 grey, mean abs difference (scripts/extract_media.py → capture.clip.motion)
        ▼
SAM 3.1  one request per concept ("glasses", "white bottle", "person"), streamed, one_bit masks
        │  scripts/record.mjs → perception/*.raw.txt, decoded masks, requests.json (hash, ms, $)
        ▼
Memory (lib/maya/memory.ts, code only)
        │  zone = point-in-polygon on the box's bottom-centre · person overlap → ON_PERSON
        │  state machine SEEN → ON_PERSON → PICKED_UP → LAST_SEEN → MOVED, history kept
        ▼
Policy gate (lib/maya/policy.ts)  word list + Spark JSON classifier → route
        │  health → only propose_note / ask_caregiver are offered; code forces ask_caregiver if Spark skips it
        ▼
Agent (lib/maya/agent.ts)  Muse Spark 1.3 standard tier, tool calls, tool results from code,
        │  Spark words the reply from those facts
        ▼
fixtures/run-001/run.json  (MayaEvents, lib/contract.ts)  ──► website replays it
```

Privacy: person masks blur people in every rendered frame and thumbnail. Raw phone footage (`incoming/`) is never committed.
