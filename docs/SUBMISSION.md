# Submission drafts (for Fairoz Sameha to review, edit and submit)

## Form answers

- **Project name:** Maya
- **Track:** Build for Your World · Indie
- **One line:** An AI care companion that remembers where things were last seen, passes the family's messages on, and sends every health question to the caregiver.
- **What it does (≈100 words):** Maya turns a phone in the corner of the room into a memory for an older adult living with memory loss. SAM 3.1 finds and tracks small everyday objects (glasses, a pill bottle) in each 10-second clip and blurs people. Our code turns those sightings into zones, times and an item state machine. When Mum asks "where are my glasses?", Muse Spark 1.3 calls our tools and words the answer only from the facts code returns: "last seen at 7:41 on the side table, to your right". Anything about medicine goes through a policy gate to her daughter. Maya has no tool that can write a reminder.
- **How we used Meta models:** SAM 3.1 (hosted, video, concept prompts, one_bit masks, stable IDs, person masks for privacy blur). Muse Spark 1.3 standard tier (tool calling with six tools, plus a JSON-schema health classifier in the policy gate). Muse Voice Transcribe (speech to text). Every runtime perception and reasoning step is Meta. Disclosed: the demo voice is ElevenLabs, pre-rendered at build time.
- **What surprised us:** SAM 3.1 kept one ID on clear glasses about 100×45 px in a 1080p wide shot, through hand-carry and occlusion, from a one-word prompt. COCO detectors have no glasses class at all (see Proof). Long descriptive prompts made SAM return nothing; short names worked.
- **Technical depth:** deterministic memory engine (point-in-polygon zones, person overlap, state machine with supersession); policy gate that removes tools on health routes and forces the caregiver route in code; request ledger (hash, model, latency, cost) on every recorded event; offline benchmark against YOLO11 and RT-DETR with ByteTrack; 40-utterance safety eval with 100% health recall.
- **Limits we're honest about:** recorded run, not a live backend; 10–25 s answers; the quiet-morning ladder is a Simulated beat; small benchmark (2 clips). See docs/LIMITS.md.
- **Bonus prizes:** Agentic (Spark tool loop with a policy gate and visible log). Viral (X post below).
- **Repository:** https://github.com/fsameha/maya
- **Live website:** https://maya-web.fsameha.workers.dev
- **Story:** https://maya-web.fsameha.workers.dev/demo
- **Technical proof:** https://maya-web.fsameha.workers.dev/proof
- **Video / X post:** add the final video and post links before submitting.
- **Team:** Fairoz Sameha (solo).

## 3-minute video shot list

| Time | Shot | Source | On-screen text / voice |
|---|---|---|---|
| 0:00–0:12 | Close-up: Sameha holds up the glasses, then the Vitamin C bottle | `incoming/glasses-opened.mp4`, `vitamin.mp4` | "Glasses. Keys. The pill bottle. Every search is a call to the family." |
| 0:12–0:20 | Home hero, Maya's eyes follow the cursor | site `/` | "Maya remembers, so they don't have to." |
| 0:20–0:55 | Watch, chapter 1: corner clip, mask locks on the glasses, Maya answers | site `/demo?ch=1` | Real line: "Your glasses were last seen at 7:41 on the side table to your right." |
| 0:55–1:05 | Zoom loupe on the far-view glasses mask | `fixtures/benchmark/grid/sam31.glasses-table.mp4` | "Clear glasses, 1080p wide shot, one ID the whole clip." |
| 1:05–1:35 | Watch, chapter 3: "This is my medicine…" → shield chip → Unconfirmed card → "Can I take another one?" → "I will check with Yuki." | `/demo?ch=3` | "Maya has no tool that can write a reminder." |
| 1:35–1:55 | Chapter 4: Yuki's phone, Confirm, card flips | `/demo?ch=4` | "The caregiver writes every reminder." |
| 1:55–2:05 | Chapter 5 with the Simulated chip | `/demo?ch=5` | "Simulated: the quiet-morning check." |
| 2:05–2:30 | Proof page synced grid: YOLO11 · RT-DETR · SAM 3.1 | `/proof` (screen-record; tiles from `fixtures/benchmark/grid/{yolo11,rtdetr,sam31}.mp4`) | "Same clip, same prompts. Of the models we ran, only SAM 3.1 found the glasses." |
| 2:30–2:45 | How it works: policy gate stage, then the Why drawer | `/demo#how-stage-6` | "The models perceive and phrase. Our code decides." |
| 2:45–3:00 | Trust page, then the logo | `/trust` | "Watching over, without watching. Built with SAM 3.1, Muse Spark and Muse Voice Transcribe." |

Captions: `docs/captions.srt`. Keep the "Dramatised scenario · real system · real model outputs" chip visible in Watch shots.

## X post

> Maya remembers, so they don't have to.
>
> A phone in the corner becomes a memory for someone living with memory loss. SAM 3.1 tracks her glasses and pill bottle; Muse Spark answers "last seen at 7:41, side table" and sends every health question to her daughter.
>
> No live feed. People blurred. Not a medical device.
>
> Built for the Meta Global AI Developer Hackathon · Agentic bonus: Spark tool loop + policy gate
> [video] [repo]
