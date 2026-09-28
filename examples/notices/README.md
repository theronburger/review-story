# Parcel notices: validation gate

An entirely fictional review, written for the public Review Story demo. The source,
catalog, notices, narration, and recordings were authored for this repository.
There are no private excerpts, private URLs, real PR numbers, or reused recordings.

The reviewed snapshot proposes a notice validator and a CI gate. Catalog entries,
templates, and input contracts are existing context; validation, selection, the
runner, and the workflow are the proposed additions. This is a snapshot fixture,
not a claim about real commits. Its restricted template language is JSON text with
`{{inputName}}` placeholders; it does not execute JavaScript or render HTML.

The walkthrough covers:

1. PR file selection and English-to-translation expansion.
2. Shared, direct, and derived input contracts; source-first validation.
3. Missing fields, malformed syntax, unknown inputs, and field-level token parity.
4. Batch error collection, exit status, and full-catalog audits.
5. A confirmed P2: contract data edits select zero files, so the scoped check passes.

The map includes selection and validation boundaries, success and failure branches,
an empty-selection bypass, and a human repair loop. In the second source-validation
step, the highlighted function stays fixed while the pointer visits `sharedInputs`,
`inputs`, and `derived` in time with their explanation. Exact targets are checked
against the source during the build, then measured from rendered text in the browser.

The last issue is intentional review material, not an open bug in the player.
`source/reproduce.mjs` removes `trackingUrl` from the contract in memory. The scoped
check reports `{ checked: 0, exitCode: 0 }`; a full audit fails five notices,
including partner overrides. The fix would expand contract changes through the
catalog's `contract` relationship. A text edit should still expand only through
the notice's `id` relationship.

From the repository root:

```sh
node examples/notices/source/cli.mjs --all
node examples/notices/source/reproduce.mjs
node --test tests/notices.test.cjs
npm run build
```

The illustrative `source/.github/workflows/notices.yml` assumes that `source/` is
the root of its own fictional repository. To exercise its `--base` path, copy that
directory into a scratch Git repository and create a base and head commit there.
The public demo build uses the snapshot directly; it does not run that workflow.

`review.json` defines every excerpt, message, and phrase cue. The builder reads
source lines from `source/`; no excerpt is hand-copied into the player. Audio and
measured word timestamps are in `audio/`. Regenerate speech after changing text:

```sh
.venv/bin/python skills/review-story/scripts/narrate.py \
  examples/notices/review.json --out examples/notices/audio
npm run build
```

The hosted HTML uses MP3 compression (requires `ffmpeg`) to keep its embedded audio
small. Omit `--audio-format mp3` when using the Python builder for a WAV-only build.
