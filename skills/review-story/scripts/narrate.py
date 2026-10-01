#!/usr/bin/env python3
"""Generate local speech and word-aligned cues. No browser or cloud service."""
import argparse
import json
import wave
from pathlib import Path

from story import tracks, utf16_length
from build import validate_review
from speech_renderer import Renderer


def narrate(review_path, output, voice='af_heart'):
    review, _, _ = validate_review(review_path)
    import truststore
    truststore.inject_into_ssl()
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    renderer = Renderer(output / '.cache')
    for name, beats in tracks(review).items():
        narration, words, timed_beats, audio_paths = [], [], [], []
        offset_ms = offset_chars = 0
        for beat in beats:
            text = beat['text']
            clip = renderer.render(text, voice)
            timed = dict(beat, start=offset_ms / 1000, charStart=offset_chars)
            if 'phases' in beat:
                timed['phases'] = []
                for phase in beat['phases']:
                    position = utf16_length(text[:text.index(phase['phrase'])])
                    word = next(word for word in clip['words'] if word['charIndex'] >= position)
                    timed['phases'].append(dict(phase, start=(offset_ms + word['startMs']) / 1000))
                timed['phases'][0]['start'] = timed['start']
            timed_beats.append(timed)
            words.extend(dict(word, charIndex=word['charIndex'] + offset_chars,
                              startMs=word['startMs'] + offset_ms, endMs=word['endMs'] + offset_ms)
                         for word in clip['words'])
            narration.append(text)
            audio_paths.append(output / '.cache' / (clip['key'] + '.wav'))
            offset_ms += clip['durationMs']
            offset_chars += utf16_length(text) + 1
        with wave.open(str(output / f'{name}.wav'), 'wb') as combined:
            combined.setnchannels(1)
            combined.setsampwidth(2)
            combined.setframerate(24000)
            for audio_path in audio_paths:
                with wave.open(str(audio_path)) as audio:
                    combined.writeframes(audio.readframes(audio.getnframes()))
        manifest = {'text': ' '.join(narration), 'beats': timed_beats,
                    'clip': {'durationMs': offset_ms, 'voice': voice, 'words': words}}
        (output / f'{name}.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding="utf-8")
        print(f'{name}: {offset_ms / 1000:.1f}s, {len(beats)} beats', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('review', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--voice', default='af_heart')
    args = parser.parse_args()
    narrate(args.review, args.out, args.voice)
