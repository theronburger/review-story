#!/usr/bin/env python3
"""Render the demo's orientation, separate from the review and skill assets."""
import hashlib
import json
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/review-story/scripts'))
from speech_renderer import Renderer, RATE


def render():
    import truststore
    from kokoro import KPipeline
    truststore.inject_into_ssl()
    output = ROOT / 'examples/checkout/intro'
    pronunciations = {'up': 'ʌp'}
    pronunciation_key = hashlib.sha256(json.dumps(pronunciations).encode()).hexdigest()[:12]
    cache = output / '.cache' / f'tutorial-{pronunciation_key}'
    renderer = Renderer(cache)
    pipeline = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M', device='cpu')
    pipeline.g2p.lexicon.golds.update(pronunciations)
    renderer.pipelines['a'] = pipeline
    steps = [
        ('Playback controls', '.tour-controls', 'The review story controls are up here.'),
        ('Spoken words', '#tour-caption', "The spoken words are here. Notice it highlights the word I'm speaking. If you pause, its easy to jump to the surrounding context because the cursor is visible"),
        ('Scenes', '.page-tabs', 'These tabs switch between scenes.'),
        ('The overview', '#page-map .diagram', "Let's start with an overview."),
    ]
    position = 350
    messages = []
    with wave.open(str(output / 'tutorial-narration.wav'), 'wb') as track:
        track.setnchannels(1)
        track.setsampwidth(2)
        track.setframerate(RATE)
        track.writeframes(bytes(round(position / 1000 * RATE) * 2))
        for index, (title, target, text) in enumerate(steps):
            clip = renderer.render(text, 'af_heart')
            messages.append({'title': title, 'target': target, 'text': text, 'startMs': position,
                             'words': [dict(word, startMs=word['startMs'] + position,
                                            endMs=word['endMs'] + position) for word in clip['words']]})
            with wave.open(str(cache / (clip['key'] + '.wav'))) as audio:
                track.writeframes(audio.readframes(audio.getnframes()))
            gap = 500 if index == len(steps) - 1 else 200
            track.writeframes(bytes(round(gap / 1000 * RATE) * 2))
            position += clip['durationMs'] + gap
    (output / 'tutorial-narration.json').write_text(json.dumps({
        'voice': 'af_heart', 'pronunciations': pronunciations,
        'durationMs': position, 'fadeStartMs': position - 500, 'messages': messages,
    }, indent=2) + '\n')
    print(f'Tutorial: {position / 1000:.2f}s across four zones')


if __name__ == '__main__':
    render()
