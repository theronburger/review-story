#!/usr/bin/env python3
"""Encode captured JPEG frames with the original narration as a high-quality MP4."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave

ROOT = Path(__file__).resolve().parents[1]
TRACKS = {
    'demo-video-audio': 'examples/checkout/intro/video-narration.wav',
    'demo-tutorial-audio': 'examples/checkout/intro/tutorial-narration.wav',
    'tour-audio': 'examples/checkout/audio/map.wav',
    'sequence-audio': 'examples/checkout/audio/sequences.wav',
}


def encode():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('frames', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--fps', type=int, default=30)
    parser.add_argument('--target-mb', type=float, default=50)
    args = parser.parse_args()
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:
        parser.error('ffmpeg must be on PATH')
    if args.fps <= 0 or args.target_mb <= 0:
        parser.error('fps and target-mb must be positive')
    if args.out.exists():
        parser.error('output already exists; choose a new filename')
    frames = sorted(args.frames.glob('*.jpg'))
    if not frames or [p.name for p in frames] != [f'{i:06d}.jpg' for i in range(len(frames))]:
        parser.error('frames must be consecutive JPEGs starting at 000000.jpg')
    duration = len(frames) / args.fps
    bitrate = int(args.target_mb * 8_000_000 / duration - 192_000)
    if bitrate <= 0:
        parser.error('target size is too small for the audio')
    timeline = json.loads((args.frames / 'audio-timeline.json').read_text())
    rate = 24000
    pcm = bytearray(round(duration * rate) * 2)
    for event in timeline:
        with wave.open(str(ROOT / TRACKS[event['id']]), 'rb') as track:
            if (track.getnchannels(), track.getsampwidth(), track.getframerate()) != (1, 2, rate):
                raise ValueError('Narration must be mono, 16-bit PCM at 24000 Hz')
            track.setpos(round(event['offset'] * rate))
            data = track.readframes(track.getnframes())
        offset = round(event['at'] * rate) * 2
        if offset < 0 or offset + len(data) > len(pcm):
            raise ValueError('Capture ends before narration; capture the complete walkthrough')
        pcm[offset:offset + len(data)] = data
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='review-story-video-') as temporary:
        audio_path = Path(temporary) / 'narration.wav'
        with wave.open(str(audio_path), 'wb') as track:
            track.setnchannels(1)
            track.setsampwidth(2)
            track.setframerate(rate)
            track.writeframes(pcm)
        common = [ffmpeg, '-hide_banner', '-nostdin', '-y', '-framerate', str(args.fps),
                  '-i', str(args.frames / '%06d.jpg'), '-i', str(audio_path), '-map', '0:v',
                  '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
                  '-c:v', 'libx264', '-preset', 'slow', '-b:v', str(bitrate), '-threads', '6',
                  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
                  '-passlogfile', str(Path(temporary) / 'encode')]
        subprocess.run(common + ['-pass', '1', '-an', '-f', 'null', '-'], check=True)
        subprocess.run(common + ['-pass', '2', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k',
                                 '-ar', '48000', '-movflags', '+faststart', str(args.out)], check=True)
    print(f'{args.out}: {duration:.2f}s, {args.out.stat().st_size / 1_000_000:.1f} MB')


if __name__ == '__main__':
    encode()
