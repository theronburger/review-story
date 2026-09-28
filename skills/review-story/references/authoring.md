# Authoring

Paths below are relative to the skill folder. The repository includes `examples/checkout/review.json`, a short showcase; `examples/notices/review.json`, an extended fictional review; and `examples/catalog/review.json`, a small starter.

## Source and structure

Create a JSON object with these fields:

| Field | Content |
| --- | --- |
| `title`, `subtitle` | Review scope and concrete change |
| `source` | `kind`, `root`, `revision`, `url` |
| `legend` | Labels for `changed` (purple) and `context` (blue) |
| `initialPage` | `map` or `sequences` |
| `playThrough` | Optional boolean; continue from the map into sequences in Auto mode (default false) |
| `map` | `width`, `height`, `nodes`, `edges`, `beats` |
| `cards` | Source excerpts keyed by card ID |
| `sequences` | Ordered diagrams and narrated rows |

For real reviews, use `source.kind: "git"`, a full head SHA in `revision`, and the checkout path in `root` (relative to the input file). The builder reads committed source with `git show`; working-tree edits are excluded. Record the full base SHA in the subtitle or companion notes.

Use a commit-pinned source URL such as `https://github.com/OWNER/REPO/blob/{revision}/{file}#L{line}`. For fictional fixtures, `kind: "snapshot"` reads local files. Relative URLs support offline source pages: `source/{file}.html#L{line}`.

Map nodes require `id`, `x`, `y`, `w`, `h`, `label`, `subtitle`, `side`, `description`, `boundary`, and `file`. `side` is `changed` or `context`. Edges use node IDs in `from`/`to`, an SVG path in `d`, and optional `label`, `x`, `y`, `secondary`. Beats use `target` (node ID), `title`, and `text`.

Map the behavior that matters to the review: state changes, branch conditions, success and failure outcomes, and recovery or repair loops. Label relationships with what they do. Distinguish automatic execution from human actions and separate runs. Use `secondary: true` for supporting relationships so the main route stays readable. Keep a high-level overview when the number of components is itself the point; there is no required node count.

Optional map annotations restore structure without adding fake components:

```json
{
  "sections": [{"label": "VALIDATE AND REPORT", "x": 900, "y": 28, "width": 600}],
  "boundaries": [{"x1": 860, "y1": 90, "x2": 860, "y2": 600, "label": "SELECTED ONLY", "labelX": 860, "labelY": 65, "anchor": "middle"}],
  "captions": [{"text": "Empty selection bypasses validation.", "x": 540, "y": 620, "anchor": "middle"}]
}
```

Coordinates use the map's SVG view box. Text anchors are `start` (default), `middle`, or `end`. Keep annotations clear of node boxes and paths. Node `boundary` text remains the detailed contract shown on selection; `map.boundaries` draws boundaries on the diagram itself.

Source cards specify `file`, inclusive one-based `start`/`end`, `label`, and `context` line ranges. The builder extracts the lines; never paste hand-edited source into the review data.

## Sequence cues

Each sequence has `id`, `title`, `subtitle`, `actors`, `file`, and `rows`. Actor positions are zero-based. Keep actor labels short enough for their boxes.

Each row is one narrated beat:

```json
{
  "text": "The renderer calls the helper. The helper validates each quantity.",
  "cards": ["render", "derive"],
  "messages": [
    {"kind": "call", "from": 0, "to": 1, "label": "deriveSummary(items)"},
    {"kind": "local", "from": 1, "to": 1, "label": "Validate quantities"}
  ],
  "phases": [
    {"phrase": "The renderer", "card": "render", "ranges": [[7, 7]], "message": 0, "point": "diagram"},
    {"phrase": "validates each quantity", "card": "derive", "ranges": [[2, 6]], "message": 1, "point": "code"}
  ]
}
```

Each cue phrase must occur exactly once, in narration order. Choose a phrase beginning at a spoken word. `message` indexes that row's messages. `ranges` may cover multiple blocks inside the selected card. The first cue starts at the beat boundary. Later cues use aligned speech timestamps.

`kind` is `call`, `return`, or `local`; only `local` uses the same source and destination actor. Cards remain visible for the whole beat. Only the active card receives strong line highlights.

### Point at exact code

`ranges` controls the context highlight. An optional `codeTarget` controls the pointer independently:

```json
{
  "phrase": "Shared inputs",
  "card": "contract",
  "ranges": [[3, 6]],
  "message": 0,
  "point": "code",
  "codeTarget": {"line": 5, "text": "sharedInputs"}
}
```

For `new Set([...sharedInputs, ...inputs, ...derived])`, keep the same `ranges` in subsequent cues and change `codeTarget.text` to `inputs` and then `derived`. Give the narration enough time on each. The whole expression can also be a target. Leave out `codeTarget` when the explanation concerns the highlighted block as a whole; graph and sequence-message pointing is unchanged.

`line` is an absolute, one-based source line inside both the card and its highlighted ranges. `text` is an exact substring on that source line, including any punctuation. A repeated substring requires an explicit one-based `occurrence`; for example `{"line": 29, "text": "name", "occurrence": 2}`. Matches are literal, not AST identifiers, so a name that occurs inside a longer name also counts. Missing text, ambiguous matches, invalid occurrences, and targets outside the highlighted context fail the build.

The builder resolves UTF-16 offsets from the actual source. Do not author offsets. The browser measures a DOM Range across syntax spans and reflows; wrapped expressions target a visible text fragment. A long context block scrolls to the precise target. An offscreen or unavailable precise target hides the pointer instead of silently pointing at a broader block.

Motion is automatic. Nearby consecutive targets share a pointing direction and use short slides; distant visits retain curved travel. The player decides from rendered positions and cue timing, including after reflow. No motion settings or grouping metadata belong in the review input.

## Generate and build

Building existing audio needs Python 3.10+ standard libraries only. New narration needs Python 3.12 and the speech dependencies. With `uv` installed:

```sh
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r scripts/requirements-speech.txt
.venv/bin/python scripts/narrate.py review.json --out audio
python3 scripts/build.py review.json --audio audio --out review.html
```

Run these from the skill folder, or use absolute script/input paths. The first speech run downloads Kokoro and language models. Synthesis runs locally. Available voices: `af_heart` (default), `af_bella`, `af_nicole`, `bf_emma`, `bf_isabella`; select with `--voice`.

To export browsable source pages, add `--source-pages source` and use matching relative source URLs. The HTML embeds its audio, timings, styles, runtime, and excerpts; playback needs no server. Full-source links may be separate files or remote URLs.

For a smaller hosted demo, add `--audio-format mp3`. This requires `ffmpeg` and compresses the verified WAV tracks during the build. The result still embeds all audio and works offline. Default WAV builds need only Python.

Changing text or cue phrases requires regenerating narration. Changing target lines or pointer destinations only requires rebuilding. Audio is cached by text and voice in `audio/.cache`.

If source evidence disagrees with narration or a diagram, fix the authored review and rebuild. Do not patch generated HTML.
