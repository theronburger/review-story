# Review Story

A skill for turning piles of incomprencible AI babble into nice narrated easy to consume stories with pointing and stuff

It outputs simple HTML pages with narrated stories. The paradigm is well thought through but the review is up to you. This is just for the viewer. BYO review ideology. 

### [👉 Here is a live demo of what it outputs](https://theronburger.github.io/review-story/)


https://github.com/user-attachments/assets/03d19cbf-868c-4b62-809f-c2aa50806035

[Download the 1080p video](https://github.com/theronburger/review-story/releases/download/demo-2026-09-30/review-story-1080p.mp4) · [Try it yourself](https://theronburger.github.io/review-story/)



## Install

Review Story uses the open [Agent Skills format](https://agentskills.io/specification):
one `SKILL.md` with bundled scripts, references, and assets. The installable package
is **[`skills/review-story/`](skills/review-story/)**. The same package works with
Agent Skills-compatible coding agents, including Codex, Claude Code, Cursor, and
Gemini CLI. It requires a shell and Python to generate the HTML; new narration
also needs local speech dependencies and network access for the first model download.

### Install with the multi-agent skills CLI

Run from the project where you want to use the skill (requires Node.js/npm):

```sh
npx skills add theronburger/review-story --skill review-story
```

Select your agent or agents when prompted. Add `--global` to make it available
across projects. For an unattended install, name the target agents explicitly:

```sh
npx skills add theronburger/review-story --skill review-story --agent codex claude-code --global --yes
```

The [skills CLI](https://github.com/vercel-labs/skills) handles each agent's discovery
location. It is an installer for the shared format, not a runtime dependency.
To list the available skill without installing it:

```sh
npx skills add theronburger/review-story --list
```

### Manual install or agent-assisted install

Without Node/npm, clone this repository and copy the **entire**
`skills/review-story/` folder into your agent's documented skills directory.
Keep `SKILL.md`, `scripts/`, `references/`, and `assets/` together. The optional
`agents/openai.yaml` provides Codex UI metadata; the workflow does not depend on it.

Discovery paths differ by host even though the skill format is shared. For example,
[Codex](https://developers.openai.com/codex/skills/) reads project skills under
`.agents/skills/review-story/`, while
[Claude Code](https://code.claude.com/docs/en/skills) reads
`.claude/skills/review-story/`. Use your host's supported location or its built-in
skill installer. The repository root is not the skill folder.

If asking an agent to install it, use this request:

```text
Install the review-story Agent Skill from https://github.com/theronburger/review-story.
The skill is in skills/review-story/. Install that entire folder into this
agent's supported skills directory, including its scripts, references, and assets.
If it already exists, inspect it before updating. Verify SKILL.md exists and run
the installed scripts/build.py --help with Python 3.10+.
Stop after installation; don't generate a review or install speech dependencies yet.
```

Installation does not require running this repository's npm development setup,
downloading speech models, or generating a demo. New narration uses Python 3.12;
setup is described in the bundled
[authoring guide](skills/review-story/references/authoring.md#generate-and-build).

## Usage

Ask your agent:

```text
Use review-story to make a narrated walkthrough of the changes between
origin/main and HEAD in this repository.
```

You can also select the skill using your agent's skill picker or invocation syntax.
The skill contains a complete starter input and fictional source files. The agent
adapts those to your code, generates local narration, and builds a standalone HTML
file. The generated viewer works offline in a browser.

## Wow thats neat! Tell me more!
Think what you may of vibe coding it's very hard to justify rolling every line by hand when modern LLMs can produce pretty reasonable code at scale. 

Coding is however just one small aspect of bringing software into being. 
We generally start with an intuition. That intuition comes from context.

That context, hard won as it is, for software engineers at least, was mostly a side effect. 

You had to buffer a significant portion of the system in your mind to be able to manipulate it. LLMs remove that constraint. Now you can just prompt from the upstream intuition and its passable a good portion of the time. 

Notice the catch? If you don't [get to the beat of the system](https://donellameadows.org/archives/dancing-with-systems/) your interaction with it will be jarring, for yourself, for the person using the software and for the agent building it. 

This is my attempt to retain some level of visibility on the complexity that streams past my nose. 


## Customization
This is not a piece of software, its a recipe 
Don't like the voice? Pick another
Its using [Kokoro TTS](https://huggingface.co/hexgrad/Kokoro-82M) under the hood
https://huggingface.co/spaces/hexgrad/Kokoro-TTS has a preview of the other voices 


## Demo source and recordings

The [interactive demo](https://theronburger.github.io/review-story/) and [editable video preview](https://theronburger.github.io/review-story/video.html) are both kept in this repo, including narration and timing data. [Editing and recording instructions](examples/checkout/README.md#recording-and-editing-the-video).

The [September 30 recording](https://github.com/theronburger/review-story/releases/tag/demo-2026-09-30) preserves the 98-second, 1920×1080 video and its matching source revision, so later demo changes won't replace it.
