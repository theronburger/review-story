#!/usr/bin/env python3
"""Render the demo video's two replies with local Kokoro word timings."""
import json
import hashlib
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
    pronunciations = {'controversial': 'kˌɑntɹəvˈɜɹʃəl'}
    pronunciation_key = hashlib.sha256(json.dumps(pronunciations).encode()).hexdigest()[:12]
    cache = output / '.cache' / f'pronunciation-{pronunciation_key}'
    renderer = Renderer(cache)
    pipeline = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M', device='cpu')
    pipeline.g2p.lexicon.golds.update(pronunciations)
    renderer.pipelines['a'] = pipeline
    spoken_prefix = 'A hundred and three kay'
    texts = [
        "103k lines? Doable. I'll walk you through the context you need and the bits that feel controversial.",
        'OK ready, let me walk you through it',
    ]
    spoken = [texts[0].replace('103k', spoken_prefix), texts[1]]
    clips = [renderer.render(text, 'af_heart') for text in spoken]
    reply_start = 12800
    loader_start = reply_start + clips[0]['durationMs']
    ready_start = loader_start + 1000
    duration = ready_start + clips[1]['durationMs'] + 350
    messages = []
    for index, (text, clip, start) in enumerate(zip(texts, clips, [reply_start, ready_start])):
        words = []
        for word in clip['words']:
            word = dict(word, startMs=word['startMs'] + start, endMs=word['endMs'] + start)
            if index == 0:
                if word['charIndex'] < len(spoken_prefix):
                    word.update(charIndex=0, charLength=4)
                else:
                    word['charIndex'] -= len(spoken_prefix) - 4
            words.append(word)
        messages.append({'text': text, 'startMs': start, 'words': words})
    with wave.open(str(output / 'video-narration.wav'), 'wb') as track:
        track.setnchannels(1)
        track.setsampwidth(2)
        track.setframerate(RATE)
        track.writeframes(bytes(round(reply_start / 1000 * RATE) * 2))
        for index, clip in enumerate(clips):
            with wave.open(str(cache / (clip['key'] + '.wav'))) as audio:
                track.writeframes(audio.readframes(audio.getnframes()))
            track.writeframes(bytes(round((1000 if index == 0 else 350) / 1000 * RATE) * 2))
    manifest = {'voice': 'af_heart', 'spokenPrefix': spoken_prefix, 'pronunciations': pronunciations,
                'durationMs': duration, 'loaderStartMs': loader_start,
                'readyStartMs': ready_start, 'messages': messages}
    (output / 'video-narration.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'Video intro: {duration / 1000:.2f}s; loader at {loader_start / 1000:.2f}s; ready at {ready_start / 1000:.2f}s')


if __name__ == '__main__':
    render()
