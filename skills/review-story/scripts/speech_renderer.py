from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import uuid

VOICES = {"af_heart": "Heart", "af_bella": "Bella", "af_nicole": "Nicole", "bf_emma": "Emma", "bf_isabella": "Isabella"}
VERSION = "kokoro-0.9.4-timings-1"
RATE = 24_000


def utf16_length(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def align_tokens(text, tokens, cursor, offset_ms, duration_ms):
    words = []
    for token in tokens:
        if not token.text:
            continue
        start = text.find(token.text, cursor)
        if start < 0 or text[cursor:start].strip():
            raise ValueError(f"Cannot align narration at {token.text!r}; use plain spoken text.")
        end = start + len(token.text)
        cursor = end
        if token.start_ts is None or token.end_ts is None:
            continue
        left = max(0, float(token.start_ts) * 1000)
        right = min(duration_ms, float(token.end_ts) * 1000)
        if not 0 <= left <= right <= duration_ms:
            raise ValueError("Kokoro returned invalid token timestamps.")
        words.append({"charIndex": utf16_length(text[:start]), "charLength": utf16_length(token.text), "startMs": offset_ms + left, "endMs": offset_ms + right})
    return words, cursor


class Renderer:
    def __init__(self, directory: Path):
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True)
        self.pipelines = {}

    def render(self, text: str, voice: str):
        if voice not in VOICES:
            raise ValueError("Unknown Kokoro voice.")
        if not isinstance(text, str) or not text.strip() or len(text) > 6000:
            raise ValueError("Narration must contain 1–6000 characters.")
        key = hashlib.sha256(json.dumps([VERSION, voice, text], ensure_ascii=False).encode()).hexdigest()
        manifest_path = self.directory / f"{key}.json"
        audio_path = self.directory / f"{key}.wav"
        if manifest_path.exists() and audio_path.exists():
            return {**json.loads(manifest_path.read_text()), "cached": True}
        import numpy as np
        import soundfile as sf
        from kokoro import KPipeline

        language = voice[0]
        if language not in self.pipelines:
            model = next(iter(self.pipelines.values())).model if self.pipelines else True
            self.pipelines[language] = KPipeline(lang_code=language, repo_id="hexgrad/Kokoro-82M", model=model, device="cpu")
        pipeline = self.pipelines[language]
        _, tokens = pipeline.g2p(text, preprocess=False)
        pieces, words = [], []
        cursor, samples = 0, 0
        for result in pipeline.generate_from_tokens(tokens, voice=voice, speed=1):
            audio = result.audio.detach().cpu().numpy()
            if not np.isfinite(audio).all():
                raise ValueError("Kokoro returned invalid audio samples.")
            aligned, cursor = align_tokens(text, result.tokens or [], cursor, samples * 1000 / RATE, len(audio) * 1000 / RATE)
            words.extend(aligned)
            pieces.append(audio)
            samples += len(audio)
        if not pieces or not words or text[cursor:].strip():
            raise ValueError("Kokoro did not align the complete narration.")
        result = {"key": key, "voice": voice, "durationMs": samples * 1000 / RATE, "words": words}
        temporary = self.directory / f"{key}.{uuid.uuid4().hex}"
        try:
            sf.write(str(temporary) + ".wav", np.concatenate(pieces), RATE, subtype="PCM_16")
            Path(str(temporary) + ".json").write_text(json.dumps(result))
            os.replace(str(temporary) + ".wav", audio_path)
            os.replace(str(temporary) + ".json", manifest_path)
        finally:
            Path(str(temporary) + ".wav").unlink(missing_ok=True)
            Path(str(temporary) + ".json").unlink(missing_ok=True)
        return {**result, "cached": False}
