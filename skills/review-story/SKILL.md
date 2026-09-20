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

- Page 1 maps components and responsibilities. Page 2 explains execution with sequence diagrams. Reuse the shared player and source workspace.
- Use solid arrows for calls, dashed arrows for returns, and self-loops for local work. State when internals are condensed. Label exceptions explicitly.
- Divide narration into short beats. Add phrase cues at meaningful changes in attention. Each cue selects a message, file, line ranges, and pointer destination.
- Point at code when discussing an implementation detail. Leave enough spoken time to read it. Highlight the full relevant block, not just its first line.
- Generate speech from the final text. Use measured word timings; do not estimate them from character counts. Audio time drives captions, highlighting, and movement.
- Keep player controls and participants pinned. Reveal the whole active message and code block when they fit; otherwise show the active block's start. Recompute pointer geometry after scrolling.
- Preserve the provided cursor behavior: oval-boundary target, inward aim, forward curved motion, settling wiggle, reduced motion, and current-beat path toggle.
- Retain auto/manual advancement. In manual mode, Space advances between beats. Focused controls keep their normal keyboard behavior.

Use the bundled assets and builder. Change the runtime only when the requested behavior requires it. A review is disposable; avoid a new app framework or backend.

## Verify and deliver

- Build the HTML; check every cue against the pinned source and spoken phrase.
- Exercise page changes, diagram selection, seeking, manual boundaries, source highlights, pointer visits, and the path toggle.
- When browser access is available, inspect both panes at the intended viewport and play representative audio. Test long blocks and transitions between panes. Distinguish browser checks from mocked DOM tests.
- Deliver the HTML, input JSON, and any source notes needed to reproduce it. Do not publish or send it unless requested.
- For a shareable example, use fictional source and newly generated audio. Check captions, source excerpts, URLs, metadata, and recordings for private content; renaming labels alone is insufficient.
