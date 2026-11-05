# Models

All runtime perception and reasoning is Meta. Two disclosed exceptions concern only the demo voice.

| Model | Job | Where it runs | Used by the website |
| --- | --- | --- | --- |
| SAM 3.1 | Finds and outlines objects and people in every frame of a clip, and keeps their IDs | Meta Model API (hosted) | Masks, sightings and person blur in Watch, How it works and Try come from its recorded outputs |
| Muse Spark 1.3 (standard tier) | Interprets requests, proposes zone names once at setup, compares lookalikes, words answers | Meta Model API (hosted) | `agent.reply`, `agent.tool` and `policy.check` events |
| Muse Voice Transcribe | Speech to text (English) | Meta Model API (hosted) | `asr.partial` and `asr.final` events |

Spark runs on the standard tier, not Contributor: Contributor-tier data trains Meta products, and these are images of a home.

## Disclosed exceptions (voice output only)

- **Demo voice:** ElevenLabs (voice Matilda), pre-rendered at build time with `text-to-speech/{voice_id}/with-timestamps`. The website plays the audio files and uses their character timestamps for lip-sync. No ElevenLabs call happens at runtime, and the key lives only in the builder's `.env`.
- **Optional live voice in Try:** off by default. A visitor can add their own ElevenLabs key ("Voice by ElevenLabs (not a Meta model)"). It is stored only in that tab's `sessionStorage`.

## Offline only

YOLO11 and RT-DETR run only in `benchmark/` (Grounding DINO tiny was attempted there but did not finish on CPU, so it has no numbers) (offline, on a laptop CPU) for `/proof`. They never run in the product. ultralytics is AGPL-3.0 and stays inside `benchmark/`.

## Where the calls happen

The website calls no model; it renders recorded `MayaEvent`s. The real calls happen in build-time scripts with the builder's key: `scripts/record.mjs` (SAM 3.1), `lib/maya/agent.ts` via `scripts/build-run.mjs` and `scripts/eval.mjs` (Spark 1.3 tool calls and the JSON classifier), `scripts/killtest.mjs` (Voice Transcribe). Every request is logged with its hash, model, time and cost in `fixtures/run-001/requests.json` and on the events themselves.
