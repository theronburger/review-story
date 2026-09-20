# Authoring

Paths below are relative to the skill folder. The repository includes `examples/catalog/review.json`, a complete fictional input.

## Source and structure

Create a JSON object with these fields:

| Field | Content |
| --- | --- |
| `title`, `subtitle` | Review scope and concrete change |
| `source` | `kind`, `root`, `revision`, `url` |
| `legend` | Labels for `changed` (purple) and `context` (blue) |
| `initialPage` | `map` or `sequences` |
| `map` | `width`, `height`, `nodes`, `edges`, `beats` |
| `cards` | Source excerpts keyed by card ID |
| `sequences` | Ordered diagrams and narrated rows |

For real reviews, use `source.kind: "git"`, a full head SHA in `revision`, and the checkout path in `root` (relative to the input file). The builder reads committed source with `git show`; working-tree edits are excluded. Record the full base SHA in the subtitle or companion notes.

Use a commit-pinned source URL such as `https://github.com/OWNER/REPO/blob/{revision}/{file}#L{line}`. For fictional fixtures, `kind: "snapshot"` reads local files. Relative URLs support offline source pages: `source/{file}.html#L{line}`.

Map nodes require `id`, `x`, `y`, `w`, `h`, `label`, `subtitle`, `side`, `description`, `boundary`, and `file`. `side` is `changed` or `context`. Edges use node IDs in `from`/`to`, an SVG path in `d`, and optional `label`, `x`, `y`, `secondary`. Beats use `target` (node ID), `title`, and `text`.

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

Changing text or cue phrases requires regenerating narration. Changing target lines or pointer destinations only requires rebuilding. Audio is cached by text and voice in `audio/.cache`.

If source evidence disagrees with narration or a diagram, fix the authored review and rebuild. Do not patch generated HTML.
