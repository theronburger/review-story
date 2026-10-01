# Install Review Story

Review Story uses the portable [Agent Skills format](https://agentskills.io/specification).
The installable folder is `skills/review-story/`, not the repository root.

With Node.js/npm, use the [multi-agent skills CLI](https://github.com/vercel-labs/skills):

```sh
npx skills add theronburger/review-story --skill review-story
```

Select your agent(s) when prompted. Add `--global` for use across projects.

Without npm, clone the repository and copy the entire `skills/review-story/`
folder into your agent's supported skills directory. Keep `SKILL.md`, scripts,
references, and assets together. Inspect an existing installation before replacing it.

Verify the installed `SKILL.md` exists and run the installed `scripts/build.py --help`
with Python 3.10+. That completes installation. The repository's npm development
setup, speech models, and demo generation are not installation steps.

When asked to create a walkthrough, follow the installed skill's
[authoring guide](skills/review-story/references/authoring.md). New narration needs
Python 3.12 and the speech dependencies described there.
