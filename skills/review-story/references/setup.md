# Speech setup and recovery

Run `python3 scripts/setup.py` using the absolute installed script path. The
launcher needs Python 3.10+; it selects Python 3.12 for speech automatically.
On Windows, use `py -3` if `python3` is unavailable. The printed executable path
is authoritative; no environment activation is needed. Quote paths with spaces. On Windows, the printed command uses PowerShell syntax.

## What setup does

1. Finds `uv` on PATH, or installs a pinned `uv` in a private bootstrap venv.
2. Uses `uv` to find/download Python 3.12 and create an isolated environment.
3. Syncs the bundled dependency lock with verified package hashes.
4. Checks dependency consistency, bundled eSpeak phonemization, real American
   and British speech, non-silent WAV samples, and measured word timings.
5. Records readiness only after every check passes, and prints the next command.

Python packages come from the configured package index, the English language
model wheel from GitHub, Python distributions through uv, and Kokoro weights
from Hugging Face. Expect a substantial first download and several minutes for
setup; Linux Torch dependencies can take several GB. No service credentials are
required. Network errors stop setup with the failed command; rerunning reuses
completed downloads. TLS verification remains enabled.

The default runtime location is `$XDG_CACHE_HOME/review-story` or
`~/.cache/review-story` on Unix, and `%LOCALAPPDATA%/review-story` on Windows.
Set `REVIEW_STORY_HOME` or pass `--runtime-dir PATH` to choose another writable
location. Keep it outside the installed skill. Hugging Face uses its own cache;
set `HF_HOME` before setup if you need to relocate that too.

## Common recovery

| Situation | Action |
| --- | --- |
| Python launcher is missing | Install Python 3.10+ through your normal platform tooling, then rerun. |
| Python is 3.14 | Use it for the launcher; setup obtains 3.12 for speech. Do not install Kokoro into 3.14. |
| `uv` is missing | Setup bootstraps it privately using Python's `venv` and pip. |
| Bootstrap says `venv`/`ensurepip` is missing | Install your distribution's Python venv package, or install uv using its official instructions, then rerun. |
| Network/proxy/certificate failure | Fix network/trust configuration and rerun the same command; do not disable TLS verification. |
| Missing or damaged speech packages/data | Run `setup.py --repair`; this reinstalls the locked packages and repeats the audio test. |
| eSpeak mentions `/Users/runner/work/…` | Use the current skill renderer. It copies the wheel's bundled data to a private temporary directory before native initialization, avoiding native path-length failures. No Homebrew eSpeak or hand-set data path is needed. |
| Setup says another process is running | Wait for it. If it terminated, remove the named `setup.lock` file and rerun. |
| Unsupported platform/wheel | Preserve the full failing command and output. Do not switch speech engines or build native dependencies speculatively. |

Use `setup.py --offline` to require an already verified runtime without downloads.
Model caches must also remain present for offline narration. Use `--repair` when
you want to recheck actual synthesis; normal repeat runs trust the readiness marker.
A failed setup never marks the environment ready. Retained old environments can
be removed manually once no active review uses them.

## Updates

`check_updates.py` compares the installed `VERSION` with the published GitHub
version and prints the managed-update command when newer. It does not modify
files, inspect other skills, authenticate, or block offline work. To combine it
with setup, pass `--check-updates`. Check failures are reported as unknown.

Managed installs update with `npx skills update review-story --global`, or
`--project` from the project. Manual copies need manual replacement. Setup uses
a fingerprint of the dependency lock and speech implementation, so speech
changes select a new environment without disturbing the previous one.
