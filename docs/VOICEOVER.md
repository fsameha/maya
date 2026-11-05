# Maya — Samiha's voiceover and screen recording plan

Screen recording with Samiha's voiceover throughout; nobody needs to appear on camera. Short introduction followed by a detailed technical demo. Allow approximately four minutes at a clear speaking pace. The recorded voice determines the final timing.

## Read-aloud copy

Hello, I'm Samiha. I'm a university student in Japan, where I've lived for two years. Seeing the need for support for older adults inspired me to build Maya, an AI care companion for people living with memory loss.

This demonstration replays recorded model outputs alongside a scripted caregiver scenario. The three panels show the home camera, Maya's conversation, and the caregiver's view.

First, I ask, “Maya, where are my glasses?” Maya calls the find-object tool and retrieves a saved sighting: the side table, to the right, at 7:41. The answer is tied to that sighting, rather than a guess about where the glasses are now.

Next, asking about today's plans calls the get-day tool, which returns appointments entered by the caregiver.

When I describe my medicine, Maya saves an unconfirmed note. When I ask, “Can I take another one?”, the question is routed to the caregiver. The next chapter demonstrates caregiver confirmation. Maya cannot create a medication reminder by itself.

To test the vision component, I compared SAM three point one with YOLO eleven and R T D E T R on two home videos, covering 257 frames. The tested detectors could recognize bottles, but their built-in categories did not include glasses. SAM found the glasses and maintained one object ID within each clip.

This is a small comparison on my footage. SAM also supplied the reference boxes, so I don't claim an independent accuracy score for SAM itself.

Now, here's how the pipeline works.

SAM three point one processes short clips using prompts such as “glasses” and “white bottle.” It returns object masks, bounding boxes, and tracking IDs.

My memory code maps each sighting to a named room zone using the bottom-centre of its bounding box. It stores the time and updates the object's state, including whether it overlaps a person or was last seen in a location.

The speech-input component uses Muse Voice Transcribe. Muse Spark one point three selects tools and phrases answers from the returned facts.

Before that agent runs, a policy gate checks a health-related word list and a model classifier. If either flags the question, code restricts the agent to caregiver tools. In the recorded evaluation, all twenty health-related examples were routed to the caregiver.

The technical walkthrough exposes the masks, memory rows, tool results, and routing decisions. Maya's demo voice is pre-rendered with ElevenLabs, with audio timestamps driving the mouth animation.

Live analysis and pairing across devices are still the next step. This prototype demonstrates the perception, memory, and caregiver workflow through replay.

Maya remembers, so they don't have to.

## Screen recording cues — do not read aloud

| Narration cue | Screen action |
| --- | --- |
| Hello / why I built Maya | Loader and hero. Keep this introduction to about 15–20 seconds. |
| Three panels | Click Watch; show the camera, Maya and caregiver panels. |
| Where are my glasses? | Chapter 1: hold the glasses outline and last-seen answer, then show its explanation drawer/tool result. |
| Today's plans | Chapter 2: show the caregiver-entered appointment and pickup time. |
| Medicine / caregiver confirmation | Chapters 3–4: unconfirmed note → routed question → scripted caregiver confirmation. Keep replay/scripted labels visible. |
| Compared SAM | Proof page: play the three available comparison tiles; show the 257-frame scope and results table. |
| Pipeline / masks and tracking | How it works: Perception stage, raw SAM lines, mask and object ID. |
| Named zones / memory | Zones and Memory stages: named region, stored sighting/time and state changes. |
| Speech / Spark / policy gate | Agent and gate stage: switch between Find my glasses and Health question. Show the restricted tool route. |
| Twenty health-related examples | Proof evaluation card, or show a small caption identifying the 20-example health subset of the 40-case evaluation. |
| Technical walkthrough / voice | Tool explanation drawer, then the Voice stage. |
| Next step / closing | Hold the Replay badge, then return to the hero. |

Capture separate shots and leave several seconds before and after each action. The screen edit should follow the recorded narration, rather than attempting one uninterrupted run through every chapter.

## Recording instructions

- Record the voiceover first in a quiet room. Leave one or two seconds between paragraphs, and several seconds of room tone at the start. WAV is preferred; a clean phone recording is usable.
- Record the website separately at 1920×1080, 30 fps if available. Keep browser zoom consistent and leave a few seconds before and after each action for editing.
- For this narration-only version, mute site audio during the screen capture so Maya's voice does not overlap Samiha. If Maya's reply is included in the final mix, pause the narration and give that reply its own space.
- Keep Replay and Simulated labels visible where relevant. The quiet-morning chapter is optional and is omitted from this short script.
- Use “Sam three point one,” “Muse Spark,” “YOLO eleven,” and spell out “R T D E T R.”
- Once the narration and screen clips are available, sync the scene changes to the spoken cues, generate captions from the actual audio, and export an H.264 MP4 at 1080p. Do not reuse the older captions.srt timing.

## Website copy to use before capture

- Hero headline: “Maya remembers, so they don't have to.”
- Hero supporting copy: “An AI care companion for older adults living with memory loss, and the families who look after them.”
- Primary action: “Watch the story.”
- Secondary action while live analysis is unfinished: “Explore the guided replay.”
- Story disclosure: “Recorded model outputs · Dramatised scenario · Caregiver workflow scripted.”
- Story-to-proof action: “Compare the models.”
- Proof-to-technical action: “How Maya works.”
- Repeated glasses answer: “Your glasses were last seen at 7:41 on the side table, to your right.”

This document defines the proposed narration and page transitions; only the repeated-question wording/audio has been changed in the implementation during this review.
