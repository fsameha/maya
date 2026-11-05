# Maya: site and experience spec

Companion to `SPEC.md`, which covers the system. English only. Written Nov 4, ~13:15 UTC, about 12.75 h before the deadline.

**Asset and ownership rule.** The mascot pack (`~/Documents/Codex/2026-10-25/.../talking-character`) and **Tomo** (`~/Downloads/tomo-prototype`) were made by the husband, and Tomo was made before the Oct 26 – Nov 4 window. A participant can only be on one submission, and pre-event work disqualifies. So **neither can be copied into her repo**. Both serve as *references for ideas*: she redraws the mascot herself (spec in §4) and re-implements any idea taken from Tomo. Every commit lands inside the window.

---

## 1. Design language

**Base: Meta's official open-source design system, Astryx** (`@astryxdesign/core`, MIT, React 19+, ships pre-built CSS with no StyleX build step, 150+ accessible components, dark mode, MCP server for coding agents, `defineTheme` for colour, type, radius and motion). Docs: astryx.atmeta.com · repo: github.com/facebook/astryx. *"Built on Meta's own design system"* is a line for judges.

**Brand tokens:** the community Meta DESIGN.md (getdesign.md / shadcn.io/design/meta). It's unofficial, so use it as a style reference only.

| Role | Token | Hex |
|---|---|---|
| Accent blue (Maya's colour: focus, live states, the "found" mask) | primary | `#0064e0` (pressed `#0457cb`, soft `#0091ff`) |
| Ink: text, primary CTA, mascot | ink-deep | `#0a1317` |
| Body text | ink | `#1c1e21` |
| Canvas | canvas | `#ffffff` |
| Soft surface: panes, thumbnails | surface-soft | `#f1f4f7` |
| Hairlines | hairline / soft | `#ced0d4` / `#dee3e9` |
| Muted text | steel | `#5d6c7b` |
| Status | success / attention / critical | `#31a24c` / `#f2a918` / `#e41e3f` |

- **Shape:** every button, chip and badge is a **pill** (100px radius). Cards are 32px, small cards 16px. Borders, not shadows; the one allowed shadow is `0 1px 4px rgba(20,22,26,.3)` for floating device frames.
- **Type:** Meta's Optimistic face isn't licensable, so use the documented fallback **Montserrat** for display (500 weight; 64/48/36px) and body (16/14px, −1% tracking). Long text stays at 16px with 1.5 line height.
- **Spacing:** 4·8·12·16·24·32·40 and section gaps of 64/80/120.
- **Dark mode:** canvas `#0a1317`, ink white, blue unchanged. The Astryx theme generates the pairs.
- **CTAs:** black pill = main marketing action, blue pill = **live** action only ("Try it live"). Blue stays rare on purpose, so it means "Maya is doing something".

**Motion system** (Astryx motion tokens plus libraries):
- `motion` (motion.dev, MIT) for micro-interactions and layout transitions.
- **GSAP** (free, including DrawSVG and MorphSVG since 2025) for the ink loader and SVG morphs.
- **Lenis** (MIT) for smooth scrolling.
- Timing: hover 150 ms, surfaces 200–250 ms ease-out, page sections 400 ms, staggers of 40–60 ms.
- Everything respects `prefers-reduced-motion`, which falls back to instant states.

**Micro-interactions:**
- Pills press to 0.97 scale.
- Cards lift 2px on hover with a border tint.
- Chips count up when numbers arrive.
- Masks draw on with a 300 ms stroke and then fill.
- Mascot attention: it glances at whatever is hovered or "speaking".
- The cursor gets a soft blue halo over live elements.

---

## 2. Loader: the ink signature (≤3.2 s; skipped on repeat visits via sessionStorage)

1. **0–1.6 s: write.** On a white screen, a pen-nib dot appears and writes **"Maya"** in **one continuous stroke**. Use a hand-drawn single-line path made in Inkscape or Figma, or start from an OFL single-line font (for example Relief SingleLine). Animate it with GSAP DrawSVG, easing `power2.inOut`, about 6px stroke, round caps.
2. **The ink is shiny and bold:**
   - the stroke uses a `linearGradient` from ink `#0a1317` to blue `#0457cb`;
   - a second, thinner white stroke at 35% opacity sits on top as a specular highlight, offset −1px;
   - a gradient "gloss" band sweeps across the word (1.6–2.0 s, `gradientTransform` translate);
   - a soft 0–4px blur shadow gives it a wet-ink depth.
3. **2.0–2.5 s: unravel.** The word's own stroke **pulls taut into a horizontal line**. MorphSVG goes from the word path to a straight path with the same point count, drawn from the end of the word, like pulling a thread.
4. **2.5–3.0 s: travel and form.** The line shrinks, rises to the **top-centre**, and redraws itself as the **outline of the mascot's bob haircut**. The silhouette fills with ink, the eyes "blink open" (a 150 ms blink curve), and the mascot settles as the **nav logo**.
5. **2.8–3.2 s: reveal.** The hero fades and rises in (y 16→0px, opacity 0→1) with 60 ms staggers: headline, subhead, CTAs, the large mascot, the stat row.

**Engineering:** pure inline SVG with no image assets. Real assets preload during the animation. If loading finishes early, the animation still completes. If loading is slow, it holds on the gloss sweep rather than looping.

---

## 3. Information architecture and flow

```
/            Home: loader → hero → problem → 3 doors
/demo        WATCH: the recorded story (Samiha ⇄ Maya ⇄ Yuki), real outputs
  └ #how     HOW IT WORKS: scroll-driven, technical, uses the same run's data
/try         TRY: live with your own camera (real Meta calls, capped)
/proof       Benchmark (YOLO11 · RT-DETR · Grounding DINO · SAM 3.1) + evals
/trust       Privacy and safety: guardrails, not a medical device, what Yuki can see
```

### Home
- **Nav:** mascot logo (its eyes follow the cursor), then Story · Try it · How it works · Proof · GitHub. Black pill **"Watch the demo"**.
- **Hero (left):**
  - **"Maya remembers, so they don't have to."**
  - Subhead: "An AI care companion for older adults living with memory loss, and the families who look after them."
  - CTAs: black **Watch the demo** and blue **Try it live**.
- **Hero (right):** the large mascot. The eyes follow the cursor (or the last touch point on mobile) and blink at idle. Hovering a CTA makes Maya glance at it, and pressing it gives a tiny smile.
- **Stat row** (counts up when it scrolls into view, each with a source link): **5.84 M** people with dementia in Japan by 2040 · **570,000** care-worker shortfall · **76,020** people died alone at home in 2024.
- **Problem:** three quiet cards. "Lost glasses, every day." · "Families can't be there." · "Cameras feel like surveillance." Each ends with Maya's answer in one line.
- **Three doors** (big 32px cards): **Watch** the story (3 min) · **Try** it with your camera · **Inspect** how it works and the proof.

### /demo: Watch (the story, all real recorded outputs)

**Layout: a three-pane theatre** (desktop):

| Pane | Width | Contents |
|---|---|---|
| **Home camera** (left) | 40% | The Pixel "CCTV" replay, timestamp burned in |
| **Maya** (centre) | 30% | Mascot plus conversation bubbles |
| **Yuki's phone** (right) | 30% | A device frame showing the caregiver app |

A **chapter timeline** runs along the bottom: ① Glasses ② Today ③ Medicine ④ Yuki confirms ⑤ Quiet morning ⑥ Messages. It has play/pause, a scrubber, and keyboard ← → controls.

**On mobile**, the same panes become swipeable tabs (Camera · Maya · Yuki) that switch automatically to the pane where the action is, with a dot that pulses on the active tab.

**Chapter 1, the magic moment.** Each stage corresponds to a real event in the recorded run, so there are no fake "thinking" stages:
1. Samiha's bubble: "Maya, I can't find my glasses." Her line plays as recorded audio, and a live transcript fills in word by word, taken from the Voice Transcribe output.
2. Maya's **listening** expression: the eyes widen slightly, and a level ring pulses with the input.
3. The **Thinking** expression. The camera pane shows "Searching memory…":
   - the clip rewinds to the sighting (a quick scrub animation);
   - candidate masks flicker in;
   - the **glasses mask locks in blue** with an ID chip `glasses · conf 0.93`;
   - the zone polygon "table, right" highlights;
   - the chip `10:42` drops in.
4. **Happy** expression. Maya speaks: "They're on the table to your right. You put them there at 10:42." The mouth is lip-synced (§5), and the bubble types in time with the audio.
5. A small **"Why did Maya say this?"** link opens a drawer showing the real agent log for that turn: tool call, result JSON, and the policy gate verdict.

**Chapters 2–6** follow SPEC.md §6:
- the day's plan card;
- the pill box outlined and the note marked UNCONFIRMED;
- the push notification arriving on **Yuki's phone**, then Confirm, then the card in the Maya pane flips to "Reminder set by Yuki" (a 3D card-flip micro-interaction);
- the quiet-morning escalation ladder, labelled simulated, ending on the **Call Yuki** button;
- Yuki's voice message playing as Samiha walks by.

**Also from the Tomo ideas:**
- **Repeated questions:** answer patiently without pointing out repetition: "Your glasses were last seen at 7:41 on the side table, to your right."
- **Supersession:** a newer placement replaces the last-known location without deleting history, and the camera pane shows the old sighting greyed out.

**At the bottom of the theatre:** an animated arrow pill **"See how it works ↓"**. It scrolls smoothly (Lenis) into #how, **starting at the stage that matches the current chapter**.

### #how: How it works (scroll-driven, technical, the same run's real data)

The page is one vertical pipeline. A sticky left rail shows the stage list with a blue progress line. Each stage is a full-height "glass box" card that animates as it scrolls into view:

1. **Capture:** frames from the phone feed a live **motion-gate sparkline** (frame difference against a threshold line), and the moment a 10-s MP4 clip is cut. Caption: "5 fps · motion-gated · ~$0.03 per clip".
2. **Perception (SAM 3.1):**
   - left: the raw streamed response lines (`<12f> …`) scrolling in monospace;
   - right: the decoded mask drawing on the frame;
   - a toggle between **concept prompt** ("black reading glasses") and **tap prompt** (a point);
   - an ID chip that stays the same across frames.
3. **Memory:** a top-down zone map (the room's polygons). The sightings table gets rows animating in. A **state-machine diagram** has the current state glowing: SEEN → ON_PERSON → PICKED_UP → LAST_SEEN.
4. **Identity:** two lookalike bottles, each crop compared with the enrolled one, and Spark's JSON verdict `{same:false, reason:"blue lid"}` typed out.
5. **Agent and policy gate:**
   - the utterance flows into the gate, with health-list hits highlighted and the classifier JSON shown;
   - **tool-call chips** (`find_object`) feed into the result JSON;
   - a split caption: **"Numbers from code"** (zone, time, left/right in ink) / **"words from the model"** (the sentence in blue).
6. **Approvals:** the note's states UNCONFIRMED → CONFIRMED with the audit trail (who, when, which device).
7. **Escalation:** a ladder of timers (usual-by 9:00 → check-in → alert → second contact), with every step stamped from the log.
8. **Privacy:** frame → `person` mask → blur. A clip-deletion countdown. A **"What Yuki can see"** comparison of blurred thumbnails against raw video, with raw video marked **never**.
9. **Voice:** transcript → speech waveform → **viseme track** → mouth shapes, so the lip-sync is visible.
10. **Benchmark** (teaser, links to /proof): the 2×2 grid of the same clip plus a 3-number summary.

Each card has a **"See the code"** link to the exact file in the repo, and a **"Raw data"** toggle that shows the JSON. That's what makes the site credible to a judge, or a judge's AI, reading the repo.

### /try: Try it live (answers "what can judges actually do?")

1. **Permission card:** "Your camera becomes Maya's home camera. Nothing is stored after this session."
2. **Teach:** "Show Maya something on your desk." Tap it, and a **live SAM 3.1 point prompt** returns the mask. Name it by voice or text ("my keys").
3. **Hide or move it:** Maya records a 10-s clip on motion. A progress ring fills, then the clip is uploaded and analysed.
4. **Ask:** by mic (Voice Transcribe) or by typing. You get a **real answer, a real clip and a real mask**, spoken with lip-sync.
5. **Be Yuki (QR pairing):** scan a QR code and your phone becomes the caregiver app. Say "This is my medicine, twice a day", and **your own phone** gets the approval. Tap Confirm and watch the desktop update in real time (Supabase Realtime).
6. **A side inspector** shows *your* session's How-it-works data live: your masks, your sightings rows, your state machine, your agent log.

**Spend guard:** 20 clips per visitor (signed cookie plus IP hash), a **$5 global daily cap**, and a kill switch. When the cap is reached, the page switches to Watch mode with an honest banner ("Today's live budget is used; here's a recorded run").

**Costs:** SAM about $0.01 per clip per concept, Spark fractions of a cent per turn, Voice Transcribe $0.18 per hour of audio, and **voice output free** (runs in the browser).

### /proof
- The full benchmark table (recall, false alarms per frame, mask IoU, **ID switches**, latency, cost), with the column where YOLO wins on speed highlighted honestly.
- The synced 2×2 grid with per-model toggles.
- The memory QA results, safety routing (100% recall on health questions), latency p50/p95, and cost per day.
- Links to the Kaggle notebook and to `fixtures/`.

### /trust
- What Maya never does: diagnose, advise on medicine, call emergency services, stream video to anyone.
- What Yuki can and can't see.
- Data lifetime.
- "Not a medical device".
- "Experimental floor check" disclosure.
- "Why Spark standard tier, not Contributor".

---

## 4. Mascot "Maya" (she draws it fresh as SVG; the old pack is a style reference only)

- **Look:** a black **bob-haircut silhouette** and a white face with a thin ink outline. **Solid oval eyes** (no pupils), a small hooked nose line, and a small mouth. Black and white with one blue accent: a hair clip, or the glow when "live".
- **Build:** one inline SVG with layers `hair`, `face`, `eyes(g)`, `nose`, `mouth(path)`. Every mouth shape is a path **with the same point count**, so it morphs smoothly (GSAP MorphSVG or `flubber`).
- **Mouth shapes (9):** rest smile · M/B/P closed · A small · A medium · A large · E wide · O round · U/W small round · F/V.
- **Expressions:** neutral · listening · thinking · happy · concerned. These change only the eye shape and the mouth curve.
- **Eyes follow the cursor or touch** (tuned values from the earlier research):
  - normalise the pointer to [−1, 1] relative to the mascot centre and clamp it;
  - a **0.06 dead zone**;
  - **exponential smoothing with τ = 90 ms** (`α = 1 − exp(−dt/90)`);
  - maximum eye shift **±5px horizontal and ±3px vertical** at an 800px head;
  - both eyes move together as one;
  - on touch devices they follow the last touch point, and after 4 s idle they drift back to centre;
  - **gaze targets:** when a pane is "speaking", Maya looks at it.
- **Blink:** open 0 → half 40 → closed 65 → half 100 → open 150 ms, every 3–5.5 s at random, plus a blink right after each answer.
- **Idle:** a breathing scale of 1.00 to 1.01 over 4 s. When listening, a small bob driven by the input level.

## 5. Voice and lip-sync

- **Voice out:** Meta **MMS-TTS English** (`facebook/mms-tts-eng`, a Meta open-weights model) running **in the browser** through `@huggingface/transformers` (the ONNX conversion `Xenova/mms-tts-eng`). It's free per visitor, keeps the runtime Meta-only, and adds a small **open-weights** angle. **Its licence is CC-BY-NC-4.0, which is fine for a non-commercial hackathon demo; disclose it in the README.** The model lazy-loads after the hero, and its progress shows in Maya's "warming up" state. If it fails to load, Maya shows captions only.
- **Lip-sync pipeline:**
  1. Spark's answer text goes to MMS-TTS, which returns PCM audio.
  2. A Web Audio `AnalyserNode` gives **RMS per frame**, which drives jaw openness and detects voiced segments.
  3. **Text to visemes:** a simple grapheme rule set (m/b/p → MBP, f/v → FV, o/u/w → O/U, e/i/y → E, a → A, everything else → A small), with the visemes spread across the voiced segments in proportion to their length.
  4. **Coarticulation:** a 60 ms look-ahead blend, then a critically damped spring to the target shape. Closed shapes (MBP) take priority and are never skipped.
  5. MorphSVG renders the mouth at 60 fps.

  Recorded human audio (Samiha's lines, Yuki's messages) uses steps 2 and 4 only.
- **Voice in:** Muse Voice Transcribe in English. Realtime WebSocket with built-in turn detection on /try, the file endpoint for recorded lines. A push-to-talk pill is always available. The wake word is optional, and the button is enough in English.

## 6. What a judge (or a judge's AI) finds in the repo

- `pnpm i && pnpm dev` runs **Watch mode and the How-it-works page with no API key**. They play back `fixtures/*.jsonl` **recorded from real Meta API runs**, each entry with its request hash, model, timestamp and cost.
- With a key, `MODEL_API_KEY=… pnpm dev` turns on /try live.
- `pnpm test` covers the memory engine, state machine, zones, policy gate, approval transitions and escalation ladder, run against the fixtures.
- `pnpm eval` regenerates every number on /proof from the fixtures, and the README embeds its output.
- `/benchmark` holds the Kaggle notebook (with its AGPL dependency noted), the labels, `metrics.csv` and the overlay MP4s.
- Docs:
  - `ARCHITECTURE.md` (the diagram);
  - `MODELS.md` (each model's job, and what breaks without it);
  - `LIMITS.md` (honest gaps);
  - `TRUST.md`;
  - a README section "Built Oct 26 – Nov 4" with the commit range.
- **No fake stages:** every animated step in the UI subscribes to a real event type. A test asserts that each UI stage maps to an event in the fixture.

## 7. Scope reality (about 12.75 h left)

This site plus the system is more than one person can finish in the time left unless it's cut hard. **Shortcut:** the **video is mostly a screen recording of /demo Watch mode**, plus the intro and the Compare grid. That removes most of the editing time.

| Priority | Item |
|---|---|
| **Must** | System core (SPEC §2 A–D, F) · /demo three-pane Watch mode with chapters 1, 3, 4 · mascot (eyes, blink, lip-sync with MMS-TTS) · loader · #how stages 2, 3, 5, 8 · fixtures, tests, README |
| **Should** | /try teach → hide → ask (without the QR) · #how stages 1, 4, 6, 7 · /proof with the 2×2 grid · chapters 2, 5, 6 |
| **Could** | QR "Be Yuki" pairing · #how stages 9, 10 · /trust page (fold it into the README) · dark mode polish · experimental floor check |

**Revised clock (UTC):**

| Time | Work |
|---|---|
| 13:15–14:00 | Kill test (SAM on a Pixel clip, MMS-TTS loads in the browser, Voice Transcribe in English) |
| 14:00–17:30 | System core |
| 17:30–20:30 | Site: tokens, mascot, loader, /demo, #how |
| 15:30 (background) | Kaggle benchmark |
| 20:30–21:15 | /try (Should items) |
| 21:15–22:45 | Film CCTV takes, record the Watch run, intro |
| 22:45–23:45 | Light edit |
| 23:45–01:15 | README, fresh-clone test, submit |
| 01:15–02:00 | Buffer |
