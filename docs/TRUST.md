# Trust

The website's `/trust` page is the reader-facing version of this. The rules the UI enforces:

- The name is Maya, never "Nurse Maya". `pnpm check:copy` fails CI if banned words appear in UI copy.
- No medical advice. Maya "sends health questions to the caregiver". Every health utterance in the fixtures routes to `ask_caregiver`, and the UI shows the shield chip.
- Claims match what was observed: "last seen at 10:42", "the pill box was moved". Never "it is there now" or "she took her pills".
- Honesty labels: Watch shows "Dramatised scenario · real system · real model outputs". The quiet-morning beat carries a "Simulated" chip. Placeholder files carry "Placeholder data".
- No fake thinking stages. Every animated step maps to a fixture event (`tests/theatre.test.ts`).
- What Yuki can see: object answers, the daily rhythm and blurred thumbnails (if allowed). Never raw video and never a live feed.
- Current demo: published creator-recorded assets remain available. Person masks illustrate blurring; not every demo asset is anonymized. Automatic 24-hour deletion, wake-word filtering, persistent permissions, and caregiver delivery are planned rather than implemented.
- Not a medical device.
