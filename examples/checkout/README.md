# One order. Three consumers.

A 54-second showcase, written from scratch for Review Story. A readable event tree
leads into two short sequences: parallel consumers, then receipt composition and
a delivery failure. It starts on the map and continues into code after 19 seconds.

The repository's HTML demo adds an 18-second silent opening: a blank RFC fills
with deliberately clichéd AI prose, followed by a PR, another RFC, and two larger
PRs. RFC and PR counters together reach 103,271 total lines. Text streams in 2–3-character
chunks with a gradual acceleration. The chat ends with a real **Send** button on
“OK! Sound is on”; narration begins only when it is clicked.

Use **Skip intro** to open the review paused, or **Intro** to replay the opening.
Open `docs/review.html` to pause or scrub the intro and inspect any moment,
including the final chat. The animation holds there until Send. A 19-second guide then highlights the controls,
spoken captions, scene tabs, and overview before the review begins. The opening,
guide, and review total about 91 seconds,
plus however long you wait before enabling sound.

`intro/` contains this presentation. `npm run build` runs the normal skill builder,
then `scripts/add-demo-intro.py` embeds the demo-only layer. The installed skill
and its generated reviews do not include the intro.

For the video version, open `docs/video.html`. Its preview renders a fixed
1920×1080 frame with playback controls outside the frame. The two agent replies
use Kokoro narration and reveal only words whose measured speaking time has
arrived, with a one-second three-dot loader between messages. It continues into
the guide and walkthrough automatically. The interactive version keeps its silent intro
and Send button. To regenerate the video's dialogue:

```sh
PATH="$PWD/.venv/bin:$PATH" .venv/bin/python scripts/render-video-intro.py
npm run build
```

The guide uses the same voice, measured word highlights, and playback controls as
the review. Its dimmed background fades away over 0.5 seconds before the review
starts. Pause, scrub, skip the guide, or use **Preview guide** in the video
preview to inspect its four highlights. Its narration is demo-only:

```sh
.venv/bin/python scripts/render-demo-tutorial.py
npm run build
```

## Recording and editing the video

The interactive Pages demo fills `docs/index.html` directly, with no frame or
intro editing controls. The build generates it alongside `docs/review.html`,
which retains those controls for editing. Keep using
`docs/video.html` to preview the narrated video opening at 1920×1080. Both versions
share the review and guide, while `intro/video.js`, `intro/video.css`, and
`intro/video-narration.*` preserve the video-specific dialogue and timing.

The [September 30 recording](https://github.com/theronburger/review-story/releases/tag/demo-2026-09-30)
archives the 98-second, 1080p/30 fps MP4 and the exact source revision used for it.
The README's embedded video is a fixed recording. Future builds update the live
demo and video preview; they do not replace the published recording.

To prepare another recording after editing and rebuilding:

```sh
npm run build
python3 scripts/prepare-video-capture.py
python3 -m http.server 8765
```

Open `http://127.0.0.1:8765/.cache/capture/index.html?video=1&clean=1` in a browser
viewport of exactly 1920×1080. This temporary copy advances animation and audio
on the same frame clock. Press Enter once, save frame zero, then press Right and
capture each subsequent frame as `000001.jpg`, `000002.jpg`, and so on. Page Down
advances one second for inspection; do not use it while capturing frames.
Continue until the walkthrough completes, keeping about 1.5 seconds at the end.
The capture tab's `html` element exposes `data-capture-frame` and
`data-capture-audio`; save the latter JSON as `audio-timeline.json` beside the
frames. Browser-tool screenshots are JPEG, so the capture retains that limitation.

Encode directly from those frames and the original PCM narration, without a
large uncompressed intermediate:

```sh
python3 scripts/encode-demo-video.py /path/to/frames \
  --out /path/to/review-story.mp4 --target-mb 50
```

The two-pass H.264 encoder targets the requested size; simple footage may finish
smaller. Upload the finished MP4 as a GitHub attachment to embed its standalone
URL in the README, and create a dated release for the MP4 and matching source.

## Showcase source

The three consumers and their outcomes form separate lanes with no crossing
connections. Narration visits inventory, receipts, and shipping, then the same
three names in code. The receipt sequence demonstrates a horizontal arithmetic
sweep and vertical payload fields. Grouping and movement are decided by the
player; the review input contains attention targets only.

The source is executable, intentionally small, and entirely fictional. Event
delivery and external services are simulated in process. Amounts are integer
cents. The sample queues an email retry while stock reservation and label booking
succeed. It does not connect to a broker, send mail, take payment, or run retries.

```sh
node examples/checkout/source/demo.mjs
node --test tests/checkout.test.cjs
npm run build
```

`review.json` contains the diagram and narration. Source cards are extracted from
`source/`; audio and measured timings are in `audio/`. To change spoken text:

```sh
.venv/bin/python skills/review-story/scripts/narrate.py \
  examples/checkout/review.json --out examples/checkout/audio
npm run build
```
