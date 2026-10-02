#!/usr/bin/env python3
"""Prepare an isolated Python 3.12 speech runtime and verify real synthesis."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys

SCRIPTS = Path(__file__).resolve().parent
UV_VERSION = '0.12.5'


def python_in(folder):
    return folder / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')


def run(command, **kwargs):
    command = [str(part) for part in command]
    print('+ ' + shlex.join(command), flush=True)
    return subprocess.run(command, check=True, **kwargs)


def cache_root():
    if os.environ.get('REVIEW_STORY_HOME'):
        return Path(os.environ['REVIEW_STORY_HOME']).expanduser().resolve()
    if os.name == 'nt':
        return Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData/Local')) / 'review-story'
    return Path(os.environ.get('XDG_CACHE_HOME', Path.home() / '.cache')) / 'review-story'


def find_uv(root):
    installed = shutil.which('uv')
    if installed:
        return [installed]
    bootstrap = root / 'bootstrap'
    python = python_in(bootstrap)
    if not python.exists():
        run([sys.executable, '-m', 'venv', bootstrap])
    probe = subprocess.run([str(python), '-m', 'uv', '--version'], capture_output=True)
    if probe.returncode:
        run([python, '-m', 'pip', 'install', '--disable-pip-version-check', f'uv=={UV_VERSION}'])
    return [str(python), '-m', 'uv']


def runtime_key():
    digest = hashlib.sha256()
    for name in ('requirements-speech.lock', 'speech_runtime.py', 'speech_renderer.py', 'check_speech.py'):
        digest.update((SCRIPTS / name).read_bytes())
    return digest.hexdigest()[:16]


def setup(root, repair=False, offline=False):
    root = root.expanduser().resolve()
    if root.is_relative_to(SCRIPTS.parent):
        raise ValueError('Use a runtime directory outside the installed skill.')
    root.mkdir(parents=True, exist_ok=True)
    lock = root / 'setup.lock'
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise ValueError(f'Another setup may be running. If it stopped, remove {lock} and retry.')
    try:
        with os.fdopen(descriptor, 'w') as stream:
            stream.write(str(os.getpid()))
        environment = root / ('speech-' + runtime_key())
        python = python_in(environment)
        marker = environment / 'ready.json'
        if marker.exists() and python.exists() and not repair:
            print(f'Speech runtime already verified: {python}')
            return python
        if offline:
            raise ValueError('No verified runtime for this version. Run setup once with network access.')
        uv = find_uv(root)
        if not python.exists():
            run([*uv, 'venv', '--python', '3.12', environment])
        result = run([python, '-c', 'import sys; print("%s.%s" % sys.version_info[:2])'], capture_output=True, text=True)
        if result.stdout.strip() != '3.12':
            raise ValueError(f'Expected Python 3.12 in {environment}; choose a new --runtime-dir.')
        marker.unlink(missing_ok=True)
        command = [*uv, 'pip', 'sync', '--python', python, '--require-hashes', SCRIPTS / 'requirements-speech.lock']
        if repair:
            command.append('--reinstall')
        run(command)
        run([*uv, 'pip', 'check', '--python', python])
        run([python, SCRIPTS / 'check_speech.py'])
        marker.write_text(json.dumps({'python': str(python), 'fingerprint': runtime_key()}) + '\n', encoding="utf-8")
        return python
    finally:
        lock.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-dir', type=Path, default=cache_root())
    parser.add_argument('--repair', action='store_true', help='Reinstall locked dependencies and rerun synthesis')
    parser.add_argument('--check-updates', action='store_true', help='Check published version without applying updates')
    parser.add_argument('--offline', action='store_true', help='Require an already verified runtime; do not download')
    args = parser.parse_args()
    try:
        python = setup(args.runtime_dir, args.repair, args.offline)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'Speech setup failed: {error}\nFix the reported prerequisite and rerun this command. See references/setup.md.\n')
    if args.check_updates and not args.offline:
        from check_updates import check
        check()
    command = [str(python), str(SCRIPTS / 'narrate.py'), 'review.json', '--out', 'audio']
    formatted = ('& ' + ' '.join("'" + part.replace("'", "''") + "'" for part in command)
                 if os.name == 'nt' else shlex.join(command))
    print('Narrate with: ' + formatted)


if __name__ == '__main__':
    main()
