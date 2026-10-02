#!/usr/bin/env python3
"""Check published release metadata without changing an installed skill."""
from pathlib import Path
import re
import urllib.error
import urllib.request

URL = 'https://raw.githubusercontent.com/theronburger/review-story/main/skills/review-story/VERSION'


def parse_version(text):
    if not re.fullmatch(r'\d+\.\d+\.\d+', text.strip()):
        raise ValueError('Invalid release version')
    return tuple(int(part) for part in text.strip().split('.'))


def check():
    local = (Path(__file__).resolve().parents[1] / 'VERSION').read_text(encoding="utf-8").strip()
    try:
        request = urllib.request.Request(URL, headers={'User-Agent': 'review-story-update-check'})
        with urllib.request.urlopen(request, timeout=5) as response:
            remote = response.read(128).decode().strip()
        comparison = parse_version(remote), parse_version(local)
    except (OSError, ValueError, UnicodeError) as error:
        print(f'Update status unavailable ({type(error).__name__}). Installed version: {local}.')
        return
    if comparison[0] > comparison[1]:
        print(f'Review Story {remote} is available (installed: {local}).')
        print('Managed global install: npx skills update review-story --global')
        print('For project or manual installs, follow INSTALL.md before replacing files.')
    elif comparison[0] == comparison[1]:
        print(f'Review Story {local} matches the published release version.')
    else:
        print(f'Local version {local} is ahead of published version {remote}.')


if __name__ == '__main__':
    check()
