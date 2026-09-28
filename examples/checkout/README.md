# One order. Three consumers.

A 54-second showcase, written from scratch for Review Story. A readable event tree
leads into two short sequences: parallel consumers, then receipt composition and
a delivery failure. It starts on the map and continues into code after 19 seconds.

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
