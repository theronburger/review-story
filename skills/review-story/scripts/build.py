#!/usr/bin/env python3
"""Build a standalone review from source, narration and cue data."""
import argparse
import base64
import html
import json
import re
import subprocess
import tempfile
import wave
from pathlib import Path
from urllib.parse import quote, urlsplit

from story import read_review, tracks, utf16_length

ASSETS = Path(__file__).resolve().parents[1] / 'assets'


def source_text(review_path, config, file):
    root = (Path(review_path).parent / config['root']).resolve()
    if Path(file).is_absolute() or '..' in Path(file).parts:
        raise ValueError(f'Source file must be relative: {file}')
    path = (root / file).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f'Source path escapes its root: {file}')
    if config['kind'] == 'git':
        revision = config['revision']
        if len(revision) != 40 or any(char not in '0123456789abcdef' for char in revision):
            raise ValueError('Pin a full 40-character commit SHA')
        return subprocess.check_output(['git', '-C', str(root), 'show', f'{revision}:{file}'], text=True, encoding='utf-8')
    if config['kind'] != 'snapshot':
        raise ValueError('Source kind must be git or snapshot')
    return path.read_text(encoding="utf-8")


def source_url(config, file, line='{line}'):
    url = config['url'].replace('{file}', quote(file, safe='/')).replace('{revision}', quote(config['revision'], safe=''))
    if any(char in url for char in '\"\'<>\n\r') or urlsplit(url).scheme not in ('', 'http', 'https') or url.startswith('//'):
        raise ValueError('Source URL must be HTTP(S) or relative')
    return url.replace('{line}', str(line))


def load_track(directory, name, expected):
    data = json.loads((directory / f'{name}.json').read_text(encoding="utf-8"))
    if len(data['beats']) != len(expected):
        raise ValueError(f'{name}: narration does not match current beats')
    expected_text = ' '.join(beat['text'] for beat in expected)
    if data['text'] != expected_text:
        raise ValueError(f'{name}: stale transcript')
    duration = data['clip']['durationMs']
    starts = [beat['start'] for beat in data['beats']]
    if not starts or starts[0] != 0 or any(not 0 <= start < duration / 1000 for start in starts):
        raise ValueError('Invalid beat timing')
    if any(before >= after for before, after in zip(starts, starts[1:])):
        raise ValueError('Beat times must increase')
    character_offset = 0
    for index, (timed, beat) in enumerate(zip(data['beats'], expected)):
        if timed['text'] != beat['text'] or timed['target'] != beat['target'] or timed['charStart'] != character_offset:
            raise ValueError(f'{name}: stale narration; regenerate audio')
        character_offset += utf16_length(beat['text']) + 1
        if 'phases' in beat:
            if [phase['phrase'] for phase in timed['phases']] != [phase['phrase'] for phase in beat['phases']]:
                raise ValueError(f'{name}: stale phrase cues')
            end = starts[index + 1] if index + 1 < len(starts) else duration / 1000
            phase_times = [phase['start'] for phase in timed['phases']]
            if phase_times[0] != timed['start'] or any(not timed['start'] <= time < end for time in phase_times):
                raise ValueError('Cue falls outside its beat')
            if any(before >= after for before, after in zip(phase_times, phase_times[1:])):
                raise ValueError('Cue times must increase')
            for phase in timed['phases'][1:]:
                position = timed['charStart'] + utf16_length(beat['text'][:beat['text'].index(phase['phrase'])])
                word = next((word for word in data['clip']['words'] if word['charIndex'] >= position), None)
                if word is None or abs(phase['start'] - word['startMs'] / 1000) > .00001:
                    raise ValueError('Cue does not match its spoken phrase')
            phases = [dict(current, start=old['start']) for current, old in zip(beat['phases'], timed['phases'])]
        else:
            phases = None
        timed.update(beat)
        if phases is not None:
            timed['phases'] = phases
    with wave.open(str(directory / f'{name}.wav')) as audio:
        if abs(audio.getnframes() / audio.getframerate() - duration / 1000) > .005:
            raise ValueError(f'{name}: audio and timing duration differ')
    words = data['clip']['words']
    if not words or not all(0 <= word['startMs'] <= word['endMs'] <= duration and
                            0 <= word['charIndex'] < word['charIndex'] + word['charLength'] <= utf16_length(expected_text)
                            for word in words):
        raise ValueError('Invalid word timing or character range')
    if any(before['startMs'] > after['startMs'] or before['charIndex'] >= after['charIndex']
           for before, after in zip(words, words[1:])):
        raise ValueError('Words must follow transcript order')
    return data


def write_source_page(path, file, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = ''.join(f'<span class="line" id="L{number}"><a href="#L{number}">{number}</a> {html.escape(line)}</span>'
                    for number, line in enumerate(text.splitlines(), 1))
    path.write_text('<!doctype html><meta charset="utf-8"><title>' + html.escape(file) + '</title>'
                    '<style>body{font:14px/1.7 ui-monospace,monospace;margin:28px;color:#26364d}'
                    '.line{display:block;white-space:pre-wrap}.line:target{background:#eee4fa}a{color:#8794a6;text-decoration:none;display:inline-block;width:32px}</style>'
                    '<h2>' + html.escape(file) + '</h2><pre>' + lines + '</pre>', encoding="utf-8")


def resolve_code_target(target, card, ranges):
    line = target['line']
    if not card['start'] <= line <= card['end'] or not any(a <= line <= b for a, b in ranges):
        raise ValueError('codeTarget line must be inside the highlighted source ranges')
    source = card['lines'][line - card['start']]
    matches = [match.start() for match in re.finditer('(?=' + re.escape(target['text']) + ')', source)]
    if not matches:
        raise ValueError(f'codeTarget text not found at {card["file"]}:{line}: {target["text"]!r}')
    if len(matches) > 1 and 'occurrence' not in target:
        raise ValueError(f'Ambiguous codeTarget at {card["file"]}:{line}; specify occurrence')
    occurrence = target.get('occurrence', 1)
    if occurrence > len(matches):
        raise ValueError('codeTarget occurrence is outside the source matches')
    start = matches[occurrence - 1]
    return dict(target, start=utf16_length(source[:start]),
                end=utf16_length(source[:start + len(target['text'])]))


def validate_review(review_path):
    review_path = Path(review_path)
    review = read_review(review_path)
    files = {card['file'] for card in review['cards'].values()}
    files.update(node['file'] for node in review['map']['nodes'])
    files.update(sequence['file'] for sequence in review['sequences'])
    sources = {file: source_text(review_path, review['source'], file) for file in sorted(files)}
    cards = {}
    for name, card in review['cards'].items():
        lines = sources[card['file']].splitlines()
        if not 1 <= card['start'] <= card['end'] <= len(lines):
            raise ValueError(f'Invalid source slice: {name}')
        cards[name] = dict(card, lines=lines[card['start'] - 1:card['end']])
        for first, last in card['context']:
            if not card['start'] <= first <= last <= card['end']:
                raise ValueError(f'Invalid context range: {name}')
    for sequence in review['sequences']:
        for row in sequence['rows']:
            for phase in row['phases']:
                card = cards[phase['card']]
                for first, last in phase['ranges']:
                    if not card['start'] <= first <= last <= card['end']:
                        raise ValueError('Cue highlights lines outside its source card')
                if 'codeTarget' in phase:
                    phase['codeTarget'] = resolve_code_target(phase['codeTarget'], card, phase['ranges'])
    for file in sources:
        source_url(review["source"], file)
    return review, sources, cards


def build(review_path, audio_dir, output, source_pages=None, audio_format='wav'):
    if audio_format not in ('wav', 'mp3'):
        raise ValueError('Audio format must be wav or mp3')
    review_path, audio_dir, output = Path(review_path), Path(audio_dir), Path(output)
    review, sources, cards = validate_review(review_path)
    expected = tracks(review)
    map_track = load_track(audio_dir, 'map', expected['map'])
    sequence_track = load_track(audio_dir, 'sequences', expected['sequences'])
    payload = dict(map=review['map'], legend=review['legend'], initialPage=review.get('initialPage', 'sequences'), playThrough=review.get('playThrough', False),
                   sources={file: source_url(review['source'], file) for file in sorted(sources)},
                   mapTourData=map_track, sequenceTourData=sequence_track, sequenceSpecs=review['sequences'], codeCards=cards)
    replacements = {
        '__TITLE__': html.escape(review['title']), '__SUBTITLE__': html.escape(review['subtitle']),
        '__PURPLE__': html.escape(review['legend']['changed']), '__BLUE__': html.escape(review['legend']['context']),
        '__REVISION__': html.escape(review['source']['revision']), '__MAP_WIDTH__': str(review['map']['width']),
        '__MAP_HEIGHT__': str(review['map']['height']), '__CSS__': '\n'.join((ASSETS / (name + '.css')).read_text(encoding="utf-8") for name in ('map', 'controls', 'sequences', 'code', 'workspace', 'viewport')),
        '__REVIEW_DATA__': json.dumps(payload, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029'),
        '__GEOMETRY__': (ASSETS / 'geometry.js').read_text(encoding="utf-8"), '__RUNTIME__': '\n'.join((ASSETS / (name + '.js')).read_text(encoding="utf-8") for name in ('map', 'state', 'manual', 'visibility', 'code', 'sequences', 'proximity', 'pointer', 'player')),
    }
    for track in ('map', 'sequences'):
        key = '__MAP_AUDIO__' if track == 'map' else '__SEQUENCE_AUDIO__'
        audio_path = audio_dir / f'{track}.wav'
        if audio_format == 'mp3':
            # A seekable output retains encoder delay/padding for gapless timing.
            with tempfile.TemporaryDirectory() as directory:
                compressed = Path(directory) / 'track.mp3'
                subprocess.run([
                    'ffmpeg', '-v', 'error', '-i', str(audio_path), '-map_metadata', '-1',
                    '-codec:a', 'libmp3lame', '-b:a', '64k', str(compressed)], check=True)
                audio_bytes = compressed.read_bytes()
            mime = 'audio/mpeg'
        else:
            audio_bytes = audio_path.read_bytes()
            mime = 'audio/wav'
        replacements[key] = f'data:{mime};base64,' + base64.b64encode(audio_bytes).decode()
    result = (ASSETS / 'shell.html').read_text(encoding="utf-8")
    result = re.sub('|'.join(map(re.escape, replacements)), lambda match: replacements[match.group()], result)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(result, encoding="utf-8")
    if source_pages:
        for file, text in sources.items():
            write_source_page(Path(source_pages) / (file + '.html'), file, text)
    print(f'Built {output.name}: {len(sequence_track["beats"])} sequence beats; {len(cards)} source cards')
    return payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('review', type=Path)
    parser.add_argument('--audio', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--source-pages', type=Path)
    parser.add_argument('--audio-format', choices=('wav', 'mp3'), default='wav',
                        help='MP3 embeds smaller audio; requires ffmpeg. WAV needs no extra dependencies.')
    args = parser.parse_args()
    build(args.review, args.audio, args.out, args.source_pages, args.audio_format)
