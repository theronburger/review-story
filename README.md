# Review Story

A skill for turning piles of incomprencible AI babble into nice narrated easy to consume stories with pointing and stuff

It outputs simple HTML pages with narrated stories. The paradigm is well thought through but the review is up to you. This is just for the viewer. BYO review ideology. 

### [👉 Here is a live demo of what it outputs](https://theronburger.github.io/review-story/)


https://github.com/user-attachments/assets/03d19cbf-868c-4b62-809f-c2aa50806035

[Download the 1080p video](https://github.com/theronburger/review-story/releases/download/demo-2026-09-30/review-story-1080p.mp4) · [Try it yourself](https://theronburger.github.io/review-story/)



## Install

This is a portable [Agent Skill](https://agentskills.io/specification).
Install it for your coding agent with the [skills CLI](https://github.com/vercel-labs/skills)
(requires Node.js/npm):

```sh
npx skills add theronburger/review-story --skill review-story
```

Select your agent(s) when prompted; add `--global` for use across projects.
Without npm, copy the entire [`skills/review-story/`](skills/review-story/) folder
into your agent's supported skills directory. Keep its scripts, references, and
assets together. The repository root is not the skill.

Installation ends after checking the installed `scripts/build.py --help` with
Python 3.10+. Do not run the repo's npm setup or download speech models just to
install the skill. Generating new narration needs Python 3.12; follow the bundled
[authoring guide](skills/review-story/references/authoring.md#generate-and-build)
when making a walkthrough.

## Usage

```text
Use review-story to make a narrated walkthrough of the changes between
origin/main and HEAD in this repository.
```

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
