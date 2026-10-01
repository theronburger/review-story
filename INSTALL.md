# Install Review Story

## Recommended: managed installation

Requires Node.js/npm and Python 3.10+ to run the setup launcher and HTML builder.

```sh
npx skills add theronburger/review-story --skill review-story --global
```

Choose your agent when prompted. For an unattended Claude Code installation,
append `--agent claude-code --yes`; use `--agent codex` for Codex. Omit `--global`
for a project installation. This records the source for later updates.

Verify the installed `SKILL.md` exists and run its `scripts/build.py --help`.
That means **skill installed**. Speech is prepared on the first walkthrough;
installation alone does not download models or generate a demo.

## First walkthrough

The agent follows the installed skill and runs:

```sh
python3 "$SKILL_DIR/scripts/setup.py"
```

Set `SKILL_DIR` to the absolute folder containing the installed `SKILL.md`.
The setup script finds or privately installs `uv`, obtains Python 3.12, installs
locked speech dependencies, and tests actual audio and word timings. It prints
the interpreter to use for narration. Repeat runs reuse the verified environment.
It does not change system Python, install Homebrew packages, or require sudo.

[Runtime locations, downloads, offline use, and recovery](skills/review-story/references/setup.md).

## Updates

For a managed global installation:

```sh
npx skills update review-story --global
```

For a project installation, run `npx skills update review-story --project` from
that project. Inspect local customizations before updating. Start a new agent
session if it has already loaded the old skill instructions.

To check release metadata without changing files:

```sh
python3 "$SKILL_DIR/scripts/check_updates.py"
```

Checks are explicit, need no authentication, and do not run in the background.
An unavailable network means unknown update status, not “up to date.” After an
update, run setup again. Changed dependencies get a separate runtime; previous
environments and generated reviews are retained.

## Manual fallback (no npm)

Clone the repository and copy the **entire** `skills/review-story/` folder into
your agent's supported skills directory. Keep scripts, assets, references, and
`VERSION` together. Inspect an existing installation before replacing it; do not
merge old and new versions or overwrite personal changes blindly.

A manual copy is not registered with the skills CLI. Update it by obtaining a
fresh repository copy and replacing the skill folder after preserving changes,
or migrate to the managed installation above. Never point an installed symlink
at a temporary clone that will disappear when the chat ends.

## Maintaining this repository

The npm dependencies are for development and tests, not skill installation.
See [development and release checks](CONTRIBUTING.md).
