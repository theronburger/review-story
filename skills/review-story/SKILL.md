---
name: review-story
description: Build narrated, interactive code reviews with an architecture map, sequence diagrams, exact source excerpts, and synchronized pointing. Use for a visual PR walkthrough or for updating an existing review story.
---

# Review Story

Produce a standalone HTML review. Write for a busy, tired reader: short sentences, concrete behavior, no storytelling.

## Review the code

- Resolve the requested base and head to full commit SHAs. For stacked PRs, compare the top head against the requested base. Record the resolved revisions.
- Read the combined diff, callers, callees, and relevant tests. Separate unchanged behavior, moved code, and behavior changes.
- Start with a short high-level explanation. Then choose diagrams around execution paths, decisions, and failure paths. Use as many as the review needs.
- Read source excerpts directly from the pinned head. Include enough surrounding code to explain the operation. Show multiple files when a step crosses a boundary.
- Distinguish confirmed behavior from inference and review findings. Report validation actually performed.

## Build the walkthrough

Read [authoring.md](references/authoring.md) for the input format and commands.

- Page 1 maps behavior and responsibility: meaningful states, labelled transitions, decisions, failure outcomes, and feedback or recovery paths. Include timing, ownership, or transaction boundaries where they affect behavior. Use section labels and captions to explain the layout. A component inventory is enough only when the relationships themselves are the review's subject; do not flatten a complex workflow to fit a node budget. Page 2 follows execution with sequence diagrams. Reuse the shared player and source workspace.
- Use solid arrows for calls, dashed arrows for returns, and self-loops for local work. State when internals are condensed. Label exceptions explicitly.
- Divide narration into short beats. Add phrase cues at meaningful changes in attention. Each cue selects a message, file, line ranges, and pointer destination.
- Separate context from pointing. Highlight the relevant block; when narration discusses a particular name, value, operator, or expression, give that phrase an exact `codeTarget`. For example, keep the union expression highlighted while the pointer visits `sharedInputs`, `inputs`, and `derived` as each is explained. Retain block targets for block-level explanations and node targets for maps. Move at meaningful changes of attention, with time to read each target.
- Author exact source text and a line for token targets; identify the occurrence when the same text appears more than once. The builder must reject missing, ambiguous, or out-of-context targets. Target the rendered text fragments across syntax spans and wrapping, never an estimated character position or the surrounding block as a silent fallback.
- Generate speech from the final text. Use measured word timings; do not estimate them from character counts. Audio time drives captions, highlighting, and movement.
- Keep player controls and participants pinned. Reveal the whole active message and code block when they fit; in a long block, prioritize the exact code target, or the block's start for a block-level cue. Recompute pointer geometry after scrolling.
- Author attention targets only. The player automatically groups nearby consecutive targets, keeps a shared pointing direction, and uses short slides between them. Preserve curved travel for distant targets and reduced motion.
- Retain auto/manual advancement. In manual mode, Space advances between beats. Focused controls keep their normal keyboard behavior.

Use the bundled assets and builder. Change the runtime only when the requested behavior requires it. A review is disposable; avoid a new app framework or backend.

## Verify and deliver

- Build the HTML; check every cue against the pinned source and spoken phrase.
- Exercise page changes, diagram selection, seeking, manual boundaries, source highlights, and pointer visits.
- When browser access is available, inspect both panes at the intended viewport and play representative audio. Verify that the pointer follows successive tokens inside one unchanged highlighted block. Test repeated names, expressions spanning syntax spans, wrapped targets, long blocks, resizing, and transitions between panes. Check map branches, boundary labels, and recovery loops visually. Distinguish browser checks from mocked DOM tests.
- Deliver the HTML, input JSON, and any source notes needed to reproduce it. Do not publish or send it unless requested.
- For a shareable example, use fictional source and newly generated audio. Check captions, source excerpts, URLs, metadata, and recordings for private content; renaming labels alone is insufficient.
