# Maya demo readiness — 5 November 2026

Reviewed the supplied screenshots, SPEC.md, SITE.md, README, implementation, recorded events, model request ledger, benchmark outputs, audio, and saved UI evidence. Checkout at review start: `1da43db`.

## Decision

Maya is close to a **recorded prototype demo**. It is not yet a live care companion. Record the voiceover now; finish the presentation items below before the final screen capture. There is no need to finish the entire live backend to make an accurate recorded demo.

The second supplied screenshot shows other coding sessions paused by their usage limits. It does not establish that their remaining work was completed. The files are the evidence for this review.

## What exists

- Ink intro/loader, hero, responsive navigation, mascot, theme controls.
- `/demo`: six-chapter replay, camera/Maya/caregiver panes, captions, chapter seeking, explanation drawer. The last event is at about 2:08, rather than the three minutes still advertised in one home card.
- Real recorded SAM 3.1 perception on the creator's footage; object masks, sightings, location/time memory code, recorded Muse Spark tool calls and health routing.
- Maya's rendered voice and lip-sync. Her repeated glasses answer has now been shortened to the factual answer, with speech and timing updated. The prompt now asks for patience without pointing out repetition.
- Ten technical walkthrough stages under `/demo#how`. Identity matching is an illustration, not a demonstrated model call. Escalation is simulated.
- `/proof`: three available comparison videos, results and evaluation data. YOLO11 and RT-DETR ran; Grounding DINO did not complete and has no scored result.
- `/trust` and documented prototype limitations.

## Before final screen capture

1. **Make the promised flow explicit.** Current flow is Home → Story → technical walkthrough, with Proof as a separate navigation destination. Requested flow is intro → hero → story showing glasses and bottle → model comparison → technical walkthrough. Add a clear “Compare the models” transition from Story and a “How Maya works” transition from Proof, or capture those pages as separate shots in that order. The comparison itself already exists.
2. **Correct privacy and feature claims.** Trust currently says raw clips are deleted after 24 hours and pre-wake-word speech is discarded. There is no deployed retention service or wake-word pipeline. It also mentions an experimental floor check that was not built. Label these as planned behavior or remove the claims. The identity stage's explanatory wording also needs to distinguish the illustration from implemented identity verification.
3. **Check all public media.** The SAM comparison render blurs people, but `fixtures/run-001/stills/glasses-table.jpg` contains an unblurred person and is copied to the served fixtures directory; its localhost URL returned 200 during review. This conflicts with the general privacy promise. Exclude unused raw stills from deployment, or create blurred replacements. Review the other stills, posters and baseline videos too.
4. **Fix outbound links.** `REPO_URL` in `components/site/Nav.tsx` is `https://github.com/`; the walkthrough links also reference absent `worker/*.ts` and `lib/capture.ts` files. Set the real public repository and link to implemented files. This checkout has no configured Git remote; no public deployment or submission was verified.
5. **Label Try accurately.** `try-001` is still a placeholder run. Camera preview/capture is real, but the masks and answers do not analyze the visitor's scene. “Teach Maya an object” and the camera CTA imply more than currently works. Present it as a guided replay, or remove it from the recording path until live analysis exists.
6. **Choose the audio approach.** Eight human dialogue/message assets in `run-001` are silent WAV placeholders. Record and integrate the human lines if the website needs a complete standalone conversation. For the final narrated video, the screen recording can instead be muted and explained by Samiha's voiceover. Keep placeholder/scripted disclosures accurate either way.
7. **Replace the old production script and subtitles.** SPEC.md and SUBMISSION.md still contain an on-camera introduction and older shot order. The existing captions.srt does not match the new voiceover and still names Grounding DINO in the comparison. Generate final subtitles from the actual recorded narration after editing. Use VOICEOVER.md for the new screen-only plan.

## Larger unfinished product work

- `lib/source/live.ts` throws `NotWiredYet`: live model analysis, live voice proxy, authenticated backend, persistent data/permissions, delivery, retention and scheduled jobs are unfinished.
- Caregiver pairing uses BroadcastChannel between tabs of one browser; scanning the QR code on a different phone does not provide working cross-device pairing.
- Caregiver confirmations and messages in Watch are scripted events. They demonstrate the intended interaction, not delivered push notifications or a persistent caregiver service.
- Quiet-morning escalation is simulated; floor/emergency detection is absent.
- The full spoken conversation is not established as real ASR output. The scripts preserve staged text/partial transcripts; a separate kill test demonstrates Voice Transcribe on one recorded utterance.
- Natural conversational speed is not achieved: real recorded answer requests took about 11–25 seconds. Replay timing is edited and should not be presented as live latency.
- Lookalike identity verification, broader memory evaluation and deployment testing remain incomplete. Benchmark scope is two clips in one room; SAM-derived reference boxes do not support an independent SAM accuracy score.

## Copy that the evidence supports

Use **SAM 3.1**, pronounced “Sam three point one,” rather than SAM 3D. The implementation names Muse Spark 1.3 and Muse Voice Transcribe; do not call them the newest models without checking that claim.

Say: “In our two home videos, SAM 3.1 found the glasses and kept one object ID within each clip. The tested YOLO11 and RT-DETR models could detect bottles, but their built-in categories did not include glasses.”

Avoid “perfect detection,” “all other models failed,” general superiority, clinical benefit claims, live cross-device pairing, or claiming the language model itself stores object memory. Location/time memory is application code.

The introductory ageing-population framing is supported by Japan's [Cabinet Office 2026 report](https://www8.cao.go.jp/kourei/whitepaper/w-2026/html/zenbun/s1_1_1.html). It is more accurate to say “an ageing population” than to imply older adults outnumber everyone younger. Meta describes [SAM 3.1 as a video detection and tracking model](https://ai.meta.com/blog/segment-anything-model-3/).

## Verification and limits of this review

TypeScript checking passed. All 24 existing unit tests passed. Copy checking passed. ESLint returned zero errors and 24 existing warnings. All five main routes returned HTTP 200; all 25 fixture URLs referenced by the recorded story existed. Existing Playwright results report a prior pass, but a fresh interactive browser review was unavailable because browser-control calls failed. Saved UI screenshots were inspected; several are older placeholder-era captures and do not establish the current visual result. A fresh production build and external deployment test were not performed.

## Final video handoff

Record clean voiceover and screen footage separately, following VOICEOVER.md. Capture each scene with a few seconds of extra footage before and after the action. Sync cuts and holds to the recorded voice, then generate subtitles and export the final video. The final mix cannot be made until those recordings exist.
