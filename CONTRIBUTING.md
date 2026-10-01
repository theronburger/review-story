# Development and releases

Install Node.js 22+, Python 3.10+, and run `npm ci`, then `npm test`.
Python tests use only the standard library; MP3 tests run when ffmpeg is available.
CI runs the player/build tests and fresh speech setup on macOS, Linux and Windows.
Speech CI starts with Python 3.14 and no assumed uv installation, exercises a path
with spaces, synthesizes American and British voices, then verifies offline reuse.
CI must pass before calling a platform supported. Local checks alone do not prove
cross-platform operation.

## Speech dependencies

Edit `skills/review-story/scripts/requirements-speech.txt`, then regenerate:

```sh
uv pip compile skills/review-story/scripts/requirements-speech.txt --python-version 3.12 --universal --generate-hashes -o skills/review-story/scripts/requirements-speech.lock
```

Commit the input and lock together. Review dependency changes; do not regenerate
the lock on users' machines. Test a fresh runtime with `setup.py --runtime-dir`
and a disposable directory. Model downloads use the upstream Kokoro repository;
the Python lock does not pin model files. Retain the actual synthesis check to
catch upstream incompatibilities.

For changes to setup, verify missing uv, unavailable network, failed synthesis,
concurrent setup, paths with spaces, and repeated setup. Keep source validation
before expensive speech. Do not mock the only speech test: native initialization
can terminate the process without a Python exception.

## Release

1. Run `npm test` and fresh speech setup. Let all CI platforms finish successfully.
2. Bump `skills/review-story/VERSION` (numeric `major.minor.patch`) and keep
   `package.json` and its lock metadata aligned. Update relevant install/recovery
   guidance without expanding the README into a manual.
3. Verify the standalone skill folder works after copying it outside the repo;
   scripts must not depend on npm, repository examples, or development files.
4. Publish the reviewed commit to main and tag the release. The version check
   reads main's `VERSION`; publishing that file advertises the release.
5. Verify managed installation and `npx skills update review-story --global` in
   an isolated agent home. Preserve existing local customizations when migrating
   a manual installation.

The skill manager owns skill replacement. Setup owns only its runtime directory.
No background updater or silent replacement of installed skills is shipped.
