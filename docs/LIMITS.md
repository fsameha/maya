# Known limits

## System

- **No live backend.** The Cloudflare system in the spec (D1, R2 with a 24 h lifecycle, Durable Objects, Cron Triggers, the `/api/meta/*` bring-your-own-key proxy and `lib/source/live.ts`) was not built in time. The site replays one recorded real run. The memory engine, policy gate and agent (`lib/maya/`) are written to run in a Worker but only run in build-time scripts today.
- **Recorded, not live.** `run-001` is real SAM 3.1 and Spark 1.3 output on our own clips. Mum's and Yuki's voice recordings are still placeholders (`*.placeholder.wav`). Chapters 4–6 (caregiver confirm, quiet morning, messages) are scripted caregiver-side beats; the quiet morning is labelled Simulated.
- **No fall detection.** The experimental floor check was not built. Choking is out of scope.
- **Slow answers.** Ask → answer took 10.9–24.9 s in the recorded run (classifier + up to 3 Spark calls). A real product needs streaming and a single call.
- **Prompt sensitivity.** SAM 3.1 returned nothing for "reading glasses on the table" and "small white pill bottle" on one clip; short names ("glasses", "white bottle") worked.
- **Small benchmark.** 2 clips, 257 frames, one room, daylight. Reference boxes are SAM's own boxes checked by eye, so SAM's recall is not self-scored. Baselines ran on a laptop CPU, so their latency is not comparable to a GPU. Grounding DINO tiny was attempted but did not finish on that CPU before the deadline, so it has no numbers and no Proof tile.
- **Cautious gate.** The word list sends "Where is my pill bottle?" to the caregiver (1 false route in 20). We prefer that to missing a health question.
- **Cost.** About $16.60 a day of SAM at 15 fps with a heartbeat clip every 10 minutes; heartbeats at 5 fps would bring it near $7.

## Website
- **Home time.** Sighting times are stored in UTC and shown in the home's time zone (Asia/Tokyo), so 22:41 UTC reads 07:41.
- **Identity stage.** §14 has no identity-check event, so How it works stage 5 uses an illustration, labelled as such.
- **Live mode.** The Meta key sheet stores the key in `sessionStorage` and calls the live source stub, which throws `NotWiredYet`. The UI says so, and the key is not sent anywhere.
- **Live voice.** The "Add voice" sheet stores a visitor's ElevenLabs key in the tab only. Speech needs the backend's `/api/voice` proxy, which is not part of this phase.
- **Be Yuki pairing** uses `BroadcastChannel`, so it works between tabs of the same browser. Cross-device pairing comes with the Durable Object WebSocket.
- **Try in replay** uses the visitor's real camera preview and a real 10-second capture, measures real motion, and then discards the capture. The analysis and answer are the recorded try run, at its recorded timing.
- **Mask overlay** is SVG rather than canvas. The mask PNG is traced to an outline in the browser so DrawSVG can stroke it on. Watch's zoom inset draws the same mask on a canvas crop of the live video; the mask is the sighting's frame, so while the clip plays the outline can lag the moving object by a few frames.
- **F/V, L and TH mouths** are smooth approximations. The style has no teeth or tongue.
- **Head motion** is a ±2° tilt only. The reference pack's yaw poses are discrete drawings, not a rig.
