# Maya: build spec (wife's Indie entry)

Meta Global AI Developer Hackathon · deadline **Nov 5 02:00 UTC** · written Nov 4, ~12:30 UTC.

This is an ideas and reference spec. Her repo starts empty, and she writes her own code and build prompts (contributor rule). Nothing comes from `~/Downloads/Nursemaya` or `~/Downloads/Demoly`.

> **Maya, an AI care companion for families.** It remembers where Mum left her glasses and her pill box. It passes the caregiver's reminders and voice messages on to Mum, and sends anything health-related to the caregiver. It notices when the usual signs of daily life don't appear.
> *"Watching over, without watching."*

The guiding principle: **the models perceive and phrase; our code decides.** SAM 3.1 finds things, Voice Transcribe hears, and Spark interprets and words the answers. Memory, zones, identity, permissions, approvals, schedules, escalation and privacy are our own deterministic pipeline.

---

## 0. Guardrails (they keep the entry past the Stage 1 screen)

| Rule | Implementation |
|---|---|
| Name is **Maya**, never "Nurse Maya" | Repo, UI, video |
| No medical advice | Maya has **no tool** that creates reminders or answers health questions. A policy gate in code sends every health-related utterance to `ask_caregiver`. |
| The caregiver authors anything medical | Mum's spoken note is stored as **UNCONFIRMED** and only becomes a reminder after the caregiver taps Confirm. |
| Claim only what's observed | "The pill box moved at 8:05", never "she took her pills". "Last seen at 10:42", never "it's there now" unless it's in the current clip. |
| No fall or choking claims | SAM doesn't detect falls or choking, and the hosted API works on clips, not real time. The inactivity check is the main safety feature. "Person on the floor" is an **experimental, staged, not-a-medical-device** check. Choking is stated out of scope in the README. |
| Benchmark claims match the table | "On our home footage, only SAM 3.1 found the glasses *and* kept their ID." The speed column, where YOLO wins, is shown too. |
| The runtime is Meta-only | Rival models run only in the offline Kaggle notebook, and the app shows their recorded outputs. Runtime calls are SAM 3.1, Spark 1.3, Voice Transcribe, plus DINOv2 (Meta open weights) as a stretch goal. |
| Video is labelled | "Dramatised scenario · real system · real model outputs" |

---

## 1. System overview

```
 ┌─────────────── HOME ───────────────┐            ┌──── CAREGIVER (Yuki) ────┐
 │ Pixel 7 "CCTV" page (Chrome)       │            │ PWA on phone             │
 │  getUserMedia 5 fps → motion gate  │            │  Today · Inbox · Plan ·  │
 │  → 10 s MP4 clip → upload          │            │  Permissions · Alerts    │
 │                                    │            └──────────▲───────────────┘
 │ Laptop "Maya screen" (Chrome)      │   Web Push / (LINE)   │
 │  wake word via ASR · big bubble UI │◄──────────┐           │
 │  reminders · messages · check-ins  │           │           │
 └──────┬──────────────────▲──────────┘           │           │
        │ clips            │ answers              │           │
 ┌──────▼──────────────────┴──────────────────────┴───────────┴──────┐
 │ Next.js API (Vercel)  +  Supabase (Postgres · Storage · Auth ·     │
 │ Realtime · pg_cron)                                                │
 │  ingest → PERCEPTION (SAM 3.1) → MEMORY ENGINE (zones, identity,   │
 │  events, state machine) → AGENT (Spark tools) ⇄ POLICY GATE        │
 │  → APPROVALS / SCHEDULER / ESCALATION / PRIVACY                    │
 └────────────────────────────────────────────────────────────────────┘
 Offline: Kaggle notebook → benchmark JSON + overlay MP4s → Compare page
```

---

## 2. Components: what the model does and what we build

### A. Capture: the "CCTV" page (Pixel 7, mounted high in a corner)
- `getUserMedia({video:{frameRate:{ideal:5}, width:1280}})`. Five fps keeps SAM's per-frame billing low, and a 10 s clip is about 50 frames, which is exactly SAM's 50-frame minimum.
- **Motion gate (our code, no model):** downscale frames to 64×36 on a canvas, take the mean absolute difference, and upload only when it's over a threshold, plus one heartbeat clip every 10 min.
- **Format:** SAM accepts **MP4/MOV with H.264/H.265 only and rejects WebM**. Use `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` (Chrome 126+ records fragmented MP4). If SAM rejects the fMP4, remux in the browser with `ffmpeg.wasm` (`-c copy -movflags +faststart`). The kill test settles this.
- A visible "Maya is watching for: glasses · pill box" banner is part of consent.

### B. Perception: SAM 3.1 (hosted, `POST https://api.meta.ai/v1/responses`)
- **Enrolment:** Mum or Yuki taps the object in a still frame, which becomes a point prompt `<|point;x;y;w;h|>` → mask. Store the crop, the mask and a **concept phrase** ("black reading glasses", "white pill box with blue lid"). Colour attributes narrow SAM's matches.
- **For each clip:** one request **per enrolled concept** (SAM allows one concept per request), streamed, with `mask_encoding: one_bit` and `include_confidence: true`. Up to 16 objects per frame, with IDs tracked through the clip. Also one `person` request, used for privacy blur, "on your head" and the floor check.
- **Parsing:** `@meta-sam/parser` ≥0.0.13 → `decodeMaskToRaster`. Every frame line carries its `<Nf>` marker.
- **Cost (vendor list price, secondary source, verify on the dashboard):** about $0.20 per 1,000 frames. That's about $0.01 per clip per concept, so about $0.03 per clip for 2 items plus a person. Images cost about $2.50 per 1,000.

### C. Memory engine (our code: the core of "technical depth")
1. **Zones.** At setup, Spark vision looks at a CCTV still and *proposes* named regions with boxes ("bedside table", "kitchen shelf"). The user drags polygons to correct them and confirms. A sighting's zone is decided by point-in-polygon on the bottom-centre of its mask.
2. **Identity.** If a concept returns more than one candidate (for example two white bottles), Spark vision compares each candidate crop with the enrolled crop and returns JSON `{same:boolean, reason}`. Stretch goal: DINOv2-small embeddings via transformers.js (Meta, Apache-2.0) as a fast first filter.
3. **Sightings table:** `(item, clip, frame, t, zone, box, mask, conf, overlaps_person:boolean, person_region)`.
4. **Per-item state machine:**
   - `SEEN(zone)`.
   - `ON_PERSON`: the mask overlaps the top 25% of a person mask, which gives "it's on your head".
   - `PICKED_UP`: it disappears while overlapping a person.
   - `LAST_SEEN(zone, t)`: it's absent while the zone is visible and not blocked by a person.
   - `MOVED`.
5. **Relative phrasing.** Code computes the facts (`zone`, Mum's last position from the person mask, left or right by x). Spark only *words* them: "On the table to your right. You put it there at 10:42." The numbers and places come from code; the words come from the model.
6. **Answer clip.** Store `clip_id` + frame. The Maya screen seeks the video to t−2 s and draws the decoded mask on a canvas overlay.

### D. Maya agent: Spark 1.3 (tool calling + JSON schema)
**Tools** (allow-listed for the elder role):

| Tool | What it does |
|---|---|
| `find_object(name)` | Memory lookup → answer card plus clip |
| `get_day(date)` | Appointments and reminders. "Doctor at 2 pm. Yuki will pick you up at 1:30." |
| `propose_note(kind, text, structured)` | Creates an **UNCONFIRMED** note (medication, appointment or other) and notifies the caregiver |
| `ask_caregiver(question)` | Relays a question. Maya says "I'll ask Yuki first." |
| `play_messages()` | Plays the caregiver's recorded voice messages |
| `check_in_reply()` | Records "I'm up" during an escalation |

**There's deliberately no tool that creates a reminder or answers a health question.**

**Policy gate** (code, applied before and after the model):
- a deterministic JA/EN health word list (薬, 飲, 錠, 痛, 具合, 病院, dose, pill, pain…);
- a Spark JSON classifier `{health_related:boolean}`.

If either flags the utterance, the gate **forces** `ask_caregiver` and the model's draft is discarded.

**Agent log:** every tool call is stored and shown in a "Why did Maya say this?" drawer, which gives judges a visible agentic loop.

Use the **standard Spark tier, not the Contributor tier** for anything with home images, because Contributor-tier data trains Meta products.

### E. Voice (**English only**, see SITE.md §5)
- **In:** Muse Voice Transcribe in English. The realtime WebSocket (`wss://api.meta.ai/v1/asr/realtime`, about $0.18 per hour) has turn detection. A **Talk to Maya** push-to-talk pill is always available. Recorded lines go to `POST /v1/asr/transcribe` (file).
- **Out:** Meta has no *hosted* TTS, so Maya speaks with **Meta MMS-TTS English** (`facebook/mms-tts-eng`, open weights, CC-BY-NC-4.0) running **in the browser** via transformers.js. That's free per visitor and keeps the runtime Meta-only. Lip-sync takes visemes from the text and amplitude from Web Audio. If it fails to load, there's a large caption bubble and a chime. **Yuki's own recorded voice messages** play with captions.

### F. Caregiver app (PWA)
- **Today:** a signs-of-life timeline ("glasses 7:40 · kettle 8:05 · pill box moved 8:06 · out 10:12"). Thumbnails have people blurred.
- **Inbox:** UNCONFIRMED notes (Confirm, Edit or Reject) and Mum's questions (reply by voice or text, played back on the Maya screen).
- **Plan:** appointments and reminders (RRULE), authored only here.
- **Permissions:** what Maya may tell Mum, whether the caregiver sees blurred thumbnails (yes/no), and raw clips (**never**).
- **Alerts:** check-in escalations and experimental floor flags.
- **Auth:** Supabase magic link. **Roles:** `elder_device`, `caregiver`, `second_contact`. Row Level Security enforces the permissions.
- **Notifications:** Web Push (`web-push`, VAPID) on Android Chrome. **Stretch:** LINE Messaging API, which is what Japanese families actually use. The free plan allows 200 pushes a month in Japan, and replies don't count.

### G. Scheduler and escalation (Supabase `pg_cron`, every minute)
- **Reminders:** at the set time, a chime and Yuki's text or voice on the Maya screen. **Done** logs an acknowledgement for the caregiver.
- **Inactivity ladder:** Yuki sets a "usual by" time (for example "kettle or any motion by 9:00"). Then:
  1. no signs by then → **CHECK_IN**: Maya chimes "Good morning, are you up?" and waits for a tap or "I'm up";
  2. 10 min without a reply → **ALERT** to Yuki with a "Call Mum" button;
  3. 15 min without acknowledgement → **second contact**.

  Each step is logged. The demo uses a **"Simulate morning"** control, labelled simulated.
- **Experimental floor check:** a SAM image request with the concept `person lying on the floor` on each motion clip's keyframe, plus code checks that the mask is mostly horizontal, sits in a floor zone and persists for ≥2 clips. If so, the caregiver gets "please check on Mum". It's labelled experimental, staged in the video, and not a medical device.

### H. Privacy (part of the product, shown in the demo)
- People are blurred in every stored thumbnail (SAM `person` masks → canvas blur).
- Raw clips are deleted after 24 h (`pg_cron`), except "answer clips" kept for Mum herself.
- The caregiver never gets a live feed, only answers about objects and signs of life.
- Audio is transcribed only to spot the wake word, and text before the wake word is discarded.
- A visible on-device indicator and a pause switch.

### I. Comparison benchmark: Kaggle notebook, offline only (free 2×T4, about 30 GPU h a week)

| Group | Model | Package and licence |
|---|---|---|
| Closed-set, real-time | YOLO11 (COCO) | `ultralytics`, **AGPL-3.0**: keep it in `/benchmark`, never ship it in the app |
| Closed-set transformer | RT-DETR (or D-FINE) | `transformers`, Apache-2.0 per the model card (verify) |
| Open-vocabulary, real-time | YOLO-World (or OWLv2) | `ultralytics` AGPL (or `transformers`) |
| Open-vocabulary, accurate | Grounding DINO | `transformers` |
| Meta | **SAM 3.1** | Hosted API outputs for the same clips |

- **Fairness:**
  - baselines get IDs through **ByteTrack** via `supervision` (MIT), so the ID-switch comparison is fair;
  - every model gets the same prompts;
  - thresholds are tuned on a separate set of 10 frames;
  - YOLO11 and RT-DETR are reported as "class not available" for glasses, pill box and keys, not as 0, and are compared on the classes they do have (cup, bottle, remote).
- **Data:** about 60 frames and 4 ten-second clips from her home. Items are glasses, pill box, keys, wallet, remote and kettle. Conditions are clutter, a wide shot with small objects, glasses on a head, a hand covering the object, lookalike bottles and low light. Labelled in **CVAT** (MIT) or **Label Studio** (Apache): boxes on all, masks on about 15.
- **Metrics:**
  - recall@IoU 0.5 and false alarms per frame (`supervision` / `pycocotools`);
  - mask IoU;
  - **ID switches** (`motmetrics`, MIT);
  - latency and cost.
- **Outputs:** `results/<model>/<clip>.json`, `metrics.csv`, and overlay MP4s drawn with `supervision` annotators.
- **Compare page:** a synced 2×2 video grid (YOLO11 · RT-DETR · Grounding DINO · SAM 3.1), per-model toggles, play and scrub, the metrics table, and a "Kaggle notebook · real outputs" badge.

### J. Evals (README "Proof" section)
1. **Detection benchmark** (section I).
2. **Memory QA:** 20 scripted hide-and-ask trials, scored on whether the answered zone is correct. Ablations: no identity check, no zones (raw box text).
3. **Safety routing:** 40 JA/EN utterances (20 health, 20 not). Health recall **must be 100%**. Report false routes.
4. **Latency:** capture → memory updated (p50/p95), and ask → answer.
5. **Cost:** dollars per day of capture at the measured motion rate.

### K. Live site modes (judges never need a key)
- **Replay (default):** a recorded day in Maya and the caregiver app, plus the Compare page. Costs nothing.
- **Try yours:** upload a ≤10 s clip, type an object name, and only SAM 3.1 runs. Capped at 3 runs per visitor (cookie plus IP hash), with a **$5 global daily cap** and a kill switch environment variable.

---

## 3. Data model (Supabase)
`households · members(role) · devices(kind) · items(name, concept, enrol_crop, enrol_mask) · zones(polygon, name) · clips(storage_path, t0, fps, frames, motion) · sightings(...) · item_state(item, state, zone, t, sighting) · notes(kind, text, structured, status UNCONFIRMED|CONFIRMED|REJECTED, author) · reminders(rrule, text, voice_path, author=caregiver) · appointments · messages(from, audio_path, transcript, played_at) · questions(from_elder, text, answer, answered_by) · escalations(state, step, t) · agent_log(utterance, tools, policy_flags, reply) · spend(day, api, units, usd)`

## 4. Stack (zero overlap with Demoly: no 3D, no R3F, no body capture)
Next.js + TypeScript on Vercel · Supabase (Postgres, Storage, Auth, Realtime, pg_cron) · Tailwind with one quiet design system (warm neutrals, large type for Mum's screen, light and dark) · `@meta-sam/parser` · OpenAI SDK pointed at `https://api.meta.ai/v1` · `web-push` · `ffmpeg.wasm` (fallback) · Kaggle: `transformers`, `ultralytics`, `supervision`, `motmetrics`, `pycocotools`. MIT licence for the app. The `/benchmark` folder notes its AGPL dependencies.

---

## 5. Build order (about 13 h; cut list at the end)

| Clock (UTC) | Block | Done when |
|---|---|---|
| 12:30–13:30 | **Kill test.** Pixel clip of glasses and pill box in clutter → SAM 3.1 concept and point prompts; Voice Transcribe on one Japanese line; Spark tool-call hello | Hits, latency, cost written down. **No-go means switching to Fill.** |
| 13:30–15:30 | Capture page, ingest, sightings, zones, state machine | "Where are my glasses?" works from the CLI |
| 15:30–17:00 | Maya screen: wake word/button → ASR → agent → answer card plus clip overlay | The magic moment works end to end |
| 15:30 (background) | Kaggle notebook running; label 60 frames in CVAT while it runs | `metrics.csv` and overlay MP4s exist |
| 17:00–18:30 | Caregiver PWA: Inbox approvals, Plan, reminders, Web Push, voice messages | The medicine → Confirm → reminder beat works |
| 18:30–19:15 | Inactivity ladder, "Simulate morning", experimental floor check | The alert beat works |
| 19:15–20:00 | Compare page, evals 2–5, replay mode, spend caps | Judges can run it without a key |
| 20:00–22:00 | **Filming** (section 7) | All shots recorded |
| 22:00–23:45 | Edit in DaVinci Resolve, captions, export, upload | Video URL |
| 23:45–01:15 | README (models and their jobs, Proof, Limits, "Built Oct 26 – Nov 4", running without a key), fresh-clone test, submit form, X post | Submitted |
| 01:15–02:00 | Buffer. **No pushes after submitting.** | |

**Cut order if she falls behind** (top first): LINE → DINOv2 → floor check → "Try yours" upload → live toggles on the Compare page (keep the video grid) → wake word (keep the button).

---

## 6. Video script (about 3:00)

| Time | Shot | What's said | On screen |
|---|---|---|---|
| 0:00–0:25 | ZV-E10, her to camera, soft light | "Hi, I'm Samiha. I've been studying in Japan for two years. Japan is facing a care crisis: more older people every year, more living with dementia, and not enough caregivers." | Stats one at a time, each with a source line: **5.84 M with dementia by 2040** · **570,000 care-worker shortfall** · **76,020 people died alone at home in 2024** |
| 0:25–0:40 | Her, continued | "I wanted to build something that remembers for them: where they left their glasses, their medicine, their day." | B-roll: glasses on a table, a pill box, a kettle |
| 0:40–1:05 | Compare page screen recording | "I tried the usual detectors first. They can't find glasses or small things like a pill box. SAM 3.1 can, and it keeps track of them." | 2×2 grid of the same kitchen clip, then the results table (recall, ID switches, **speed**) for 3 s. Badge: "Kaggle notebook · real outputs" |
| 1:05–1:10 | Title card | "So I built Maya." | **Maya**, an AI care companion for families · "Dramatised scenario · real system · real model outputs" |
| 1:10–1:30 | Pixel "CCTV", wide, timestamp burned in | — | She walks in, takes off her glasses, puts them on the table on the right, sits on the bed. "Maya is watching for: glasses · pill box" |
| 1:30–1:55 | Laptop webcam, Maya screen | "Maya, where did I leave my glasses?" | "Checking…" → **the CCTV clip with the glasses outlined** → "On the table to your right. You put them there at 10:42." **Hold 2–3 s.** |
| 1:55–2:10 | Webcam | "Maya, what's my day today?" | "Doctor's appointment at 2 pm. Yuki will pick you up at 1:30." Appointment card |
| 2:10–2:35 | Webcam, pill box in hand | "This is my medicine. I take it twice a day after eating." | SAM outlines the pill box. Maya: "Noted. I'll check with Yuki first." Card marked **UNCONFIRMED** |
| 2:35–2:50 | Caregiver phone screen recording | (caregiver's hand) | Push: "Mum says: pill box, twice a day after meals. Confirm?" → **Confirm** → laptop card turns to "Reminder set by Yuki" |
| 2:50–2:58 | Phone | — | Labelled simulated: "No activity since 9:12" → Maya check-in → **Call Mum** |
| 2:58–3:00 | End card | "Maya: watching over, without watching." | Repo URL · live demo URL · "Built Oct 26 – Nov 4" · "Runtime: Meta models only" |

If there's time, add a 2 s privacy insert after 2:50: the Permissions screen showing "Raw video: never shared".

## 7. Filming (about 2 h)
**Cameras.**
- Pixel 7 is the CCTV: high in a corner, wide, running the capture page, so the answers are real.
- Laptop webcam plus the app are recorded with **OBS**.
- ZV-E10 for the intro and b-roll.
- The caregiver phone is screen-recorded with Android's recorder, and your hand plays the caregiver's hand.

**Order.**
1. Kill-test clip.
2. **The magic moment in one continuous take.** The CCTV records while she puts the glasses down and sits, then she asks. Whatever Maya actually answers goes in. Do 3–5 takes and keep the best *real* one.
3. Appointment and medicine beats.
4. Caregiver phone.
5. Intro and b-roll.
6. Compare-page screen recording, plus 3–4 s of the Kaggle notebook actually running.

**Editing (DaVinci Resolve, Linux, about 1.5 h).**
- Cut between CCTV and webcam on the moment she sits down.
- English captions, with Japanese subtitles on her Japanese lines.
- Burned-in CCTV timestamps that visibly match "10:42".
- Calm music, slow cuts.
- 1080p, YouTube public or unlisted.

**Showing the live difference honestly**, in three layers:
1. In the video: the Compare grid of real outputs, plus the notebook running.
2. On the site: a Compare page judges can scrub themselves, at no cost.
3. Truly live: "Try yours" runs only SAM 3.1, capped.

## 8. Checklist map
- **Gate:** not medical advice (policy gate plus caregiver authorship), not RAG, not a simple image analyzer (memory, agent, approvals, escalation).
- **Impact:** real data on Japan's ageing and care shortage, firsthand framing, the i-Pot "Mimamori" precedent for acceptance.
- **Tooling:** open-vocabulary SAM 3.1 against 4 baselines with numbers, Voice Transcribe in Japanese, Spark as a tool-using agent behind a policy gate.
- **Depth:**
  - state machine, zones, identity, privacy pipeline;
  - eval suite and ablations;
  - "numbers from code, words from the model".
- **Demo:** a real continuous take for the magic moment, the caregiver loop, a replay site with no key needed.
- **Bonuses:** Agentic ✓ (tool calls, log, approvals), Viral ✓ (the glasses moment), Creative ✗, Open Weights ~ (DINOv2 stretch).
- **Repo:** public, her as the only contributor, MIT, `.env.example`, no secrets, a "Built Oct 26 – Nov 4" section, README sections on each model's job and on what breaks without it.

## 9. Open checks (all resolved in the kill test or the first hours)
- Does SAM accept Chrome's fragmented MP4? (Otherwise remux with `ffmpeg.wasm`.)
- SAM recall on small glasses in a wide shot, and the real cost per frame on her dashboard.
- Japanese Voice Transcribe accuracy on short questions, and whether 「マヤ」 is spotted reliably.
- Spark JSON-schema and tool-calling behaviour with Japanese input.
- Verify the licences on the RT-DETR, D-FINE and Grounding DINO model cards before publishing.
- Is the Kaggle quota available on her account (about 30 h a week, reported by the community)?
