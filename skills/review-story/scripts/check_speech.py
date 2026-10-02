#!/usr/bin/env python3
"""Exercise native phonemization, synthesis, audio samples and word alignment."""
import argparse
from pathlib import Path
import tempfile
import wave


def check(output):
    import truststore
    truststore.inject_into_ssl()
    from speech_runtime import configure_espeak
    configure_espeak()
    from phonemizer.backend import EspeakBackend
    if not EspeakBackend('en-us').phonemize(['Review story is ready.'])[0].strip():
        raise RuntimeError('Bundled eSpeak produced no phonemes')
    from speech_renderer import Renderer
    import numpy as np
    import soundfile as sf
    for voice in ('af_heart', 'bf_emma'):
        clip = Renderer(output).render('Review story is ready.', voice)
        path = output / (clip['key'] + '.wav')
        samples, rate = sf.read(path)
        if rate != 24000 or not np.isfinite(samples).all() or not np.any(samples):
            raise RuntimeError('Speech produced invalid or silent audio')
        if clip['durationMs'] <= 0 or not clip['words']:
            raise RuntimeError('Speech produced no word timings')
        with wave.open(str(path)) as audio:
            if audio.getnframes() <= 0:
                raise RuntimeError('Speech produced an empty WAV')
    print('Speech ready: bundled eSpeak, American/British voices, audio and timings verified.')


if __name__ == '__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    with tempfile.TemporaryDirectory(prefix='review-story-speech-') as directory:
        check(Path(directory))
