#!/usr/bin/env python3
"""Add the repository demo's presentation without changing the skill player."""
import argparse
import base64
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTRO = ROOT / 'examples/checkout/intro'


def embedded_audio(name):
    with tempfile.TemporaryDirectory() as folder:
        compressed = Path(folder) / (name + '.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(INTRO / (name + '.wav')),
                        '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k', str(compressed)], check=True)
        return 'data:audio/mpeg;base64,' + base64.b64encode(compressed.read_bytes()).decode()


def add_intro(output, home=None):
    page = Path(output).read_text()
    if 'id="demo-intro"' in page:
        raise ValueError('Build the base review before adding the intro.')
    markup = (INTRO / 'intro.html').read_text()
    icons = subprocess.check_output(['node', '-e', "const icons=require('@primer/octicons'); console.log(JSON.stringify(Object.fromEntries(['mark-github','git-pull-request','comment-discussion','git-commit','checklist','diff','file','code','search','chevron-down'].map(name=>[name,icons[name].toSVG({height:16})]))));"], cwd=ROOT, text=True).strip().replace('<', '\\u003c')
    markup = markup.replace('__INTRO_GITHUB__', json.loads(icons)['mark-github'])
    narration = (INTRO / 'video-narration.json').read_text().replace('<', '\\u003c')
    tutorial = (INTRO / 'tutorial-narration.json').read_text().replace('<', '\\u003c')
    script = '\n'.join((INTRO / file).read_text() for file in ('stream.js', 'rfc-cards.js', 'pr-cards.js', 'video.js', 'tutorial-pointer.js', 'tutorial.js', 'intro.js'))
    script = script.replace('__INTRO_ICONS__', icons).replace('__VIDEO_NARRATION__', narration).replace('__VIDEO_AUDIO__', embedded_audio('video-narration'))
    script = script.replace('__TUTORIAL_NARRATION__', tutorial).replace('__TUTORIAL_AUDIO__', embedded_audio('tutorial-narration'))
    styles = '\n'.join((INTRO / file).read_text() for file in ('intro.css', 'pr-cards.css', 'rfc-cards.css', 'video.css', 'tutorial.css'))
    page = page.replace('</head>', '<style>\n' + styles + '\n</style>\n</head>')
    page = page.replace('<body>', '<body class="demo-intro-visible">\n' + markup)
    page = page.replace('</body>', '<script>\n' + script + '\n</script>\n</body>')
    Path(output).write_text(page)
    if home:
        Path(home).write_text(page.replace('<div class="demo-transport"', '<div hidden class="demo-transport"', 1))
    print('Added silent RFC and PR intro with click-to-start narration')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output')
    parser.add_argument('--home', help='Write the public homepage without intro editing controls')
    args = parser.parse_args()
    add_intro(args.output, args.home)
