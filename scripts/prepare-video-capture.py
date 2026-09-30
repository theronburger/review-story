#!/usr/bin/env python3
"""Prepare a frame-stepped copy of the video demo without changing the live page."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SHOWCASE = ROOT / 'examples/checkout'


def prepare():
    clips = {
        'demo-video-audio': ('intro/video-narration.json', False),
        'demo-tutorial-audio': ('intro/tutorial-narration.json', False),
        'tour-audio': ('audio/map.json', True),
        'sequence-audio': ('audio/sequences.json', True),
    }
    durations = {}
    for name, (path, nested) in clips.items():
        data = json.loads((SHOWCASE / path).read_text())
        durations[name] = (data['clip'] if nested else data)['durationMs'] / 1000
    config = {'fps': 30, 'durations': durations}
    clock = (ROOT / 'scripts/video-capture-clock.js').read_text().replace('__CAPTURE_CONFIG__', json.dumps(config))
    html = (ROOT / 'docs/review.html').read_text().replace('<head>',
        '<head><base href="/docs/"><style>*:focus,*:focus-visible{outline:none!important}</style><script>' + clock + '</script>', 1)
    output = ROOT / '.cache/capture/index.html'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html)
    print('Serve the repo, then open /.cache/capture/index.html?video=1&clean=1 at 1920×1080.')
    print('Enter starts playback; Right advances one frame; Page Down advances one second.')


if __name__ == '__main__':
    prepare()
