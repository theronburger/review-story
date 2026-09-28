import copy
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills/review-story/scripts'))
from build import build, load_track, source_text, resolve_code_target
from speech_renderer import align_tokens
from story import read_review, tracks, utf16_length

EXAMPLE = ROOT / 'examples/catalog'


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.folder = Path(self.temporary.name)
        self.review = json.loads((EXAMPLE / 'review.json').read_text())
        self.review['source']['root'] = str(EXAMPLE / 'after')
        self.input = self.folder / 'review.json'

    def save(self):
        self.input.write_text(json.dumps(self.review))
        return self.input

    def test_build_extracts_real_lines_and_preserves_updated_cue_targets(self):
        row = self.review['sequences'][0]['rows'][0]
        row['phases'][0]['ranges'] = [[5, 6]]
        row['phases'][0]['point'] = 'code'
        self.review['sequences'][0]['title'] = 'Updated title'
        payload = build(self.save(), EXAMPLE / 'audio', self.folder / 'review.html')
        card = payload['codeCards']['render']
        self.assertEqual(card['lines'], (EXAMPLE / 'after/render.mjs').read_text().splitlines())
        beat = payload['sequenceTourData']['beats'][0]
        self.assertTrue(beat['title'].startswith('Updated title'))
        self.assertEqual(beat['phases'][0]['ranges'], [[5, 6]])
        self.assertEqual(beat['phases'][0]['point'], 'code')
        self.assertNotIn('__REVIEW_DATA__', (self.folder / 'review.html').read_text())

    def test_pinned_git_source_ignores_working_tree_edits(self):
        repository = self.folder / 'source'
        repository.mkdir()
        def git(*args):
            return subprocess.check_output(['git', '-C', str(repository), *args], text=True).strip()
        git('init', '-q')
        (repository / 'main.js').write_text('committed source\n')
        git('add', '.')
        git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'Fixture')
        revision = git('rev-parse', 'HEAD')
        (repository / 'main.js').write_text('uncommitted replacement\n')
        config = dict(kind='git', root=str(repository), revision=revision)
        self.assertEqual(source_text(self.input, config, 'main.js'), 'committed source\n')
        with self.assertRaises(ValueError):
            source_text(self.input, dict(config, revision='HEAD'), 'main.js')
        with self.assertRaises(ValueError):
            source_text(self.input, config, '../main.js')

    def test_builder_rejects_highlights_outside_source_slice(self):
        self.review['sequences'][0]['rows'][0]['phases'][0]['ranges'] = [[1, 500]]
        with self.assertRaisesRegex(ValueError, 'outside'):
            build(self.save(), EXAMPLE / 'audio', self.folder / 'review.html')

    def test_exact_target_resolves_unicode_and_repeated_names(self):
        line = '😀 return new Set([inputs, inputs]);'
        card = dict(file='demo.js', start=7, end=7, lines=[line])
        target = resolve_code_target(dict(line=7, text='inputs', occurrence=2), card, [[7, 7]])
        start = line.rindex('inputs')
        self.assertEqual(target['start'], utf16_length(line[:start]))
        self.assertEqual(target['end'] - target['start'], 6)
        expression = resolve_code_target(dict(line=7, text='return new Set'), card, [[7, 7]])
        self.assertEqual(expression['start'], 3)
        for target, message in (
            (dict(line=7, text='inputs'), 'Ambiguous'),
            (dict(line=7, text='inputs', occurrence=3), 'occurrence'),
            (dict(line=7, text='missing'), 'not found'),
            (dict(line=8, text='inputs'), 'highlighted'),
        ):
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, message):
                resolve_code_target(target, card, [[7, 7]])
        with self.assertRaisesRegex(ValueError, 'highlighted'):
            resolve_code_target(dict(line=7, text='new'), card, [[8, 8]])

    def test_changing_exact_target_does_not_require_new_narration(self):
        phase = self.review['sequences'][0]['rows'][0]['phases'][1]
        phase.update(point='code', codeTarget=dict(line=6, text='selectLayout'))
        payload = build(self.save(), EXAMPLE / 'audio', self.folder / 'review.html')
        resolved = payload['sequenceTourData']['beats'][0]['phases'][1]['codeTarget']
        self.assertEqual(resolved['text'], 'selectLayout')
        self.assertGreater(resolved['end'], resolved['start'])
        self.assertEqual(payload['sequenceSpecs'][0]['rows'][0]['phases'][1]['codeTarget'], resolved)

    def test_target_shape_and_map_annotations_are_validated(self):
        phase = self.review['sequences'][0]['rows'][0]['phases'][0]
        phase['point'] = 'code'
        for target in [dict(line=0, text='x'), dict(line=True, text='x'),
                       dict(line=5, text=''), dict(line=5, text='x\ny'),
                       dict(line=5, text='x', occurrence=0)]:
            phase['codeTarget'] = target
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, 'codeTarget'):
                read_review(self.save())
        phase['codeTarget'] = dict(line=5, text='renderSummary')
        phase['point'] = 'diagram'
        with self.assertRaisesRegex(ValueError, 'code pointer'):
            read_review(self.save())
        del phase['codeTarget']
        self.review['map']['sections'] = [dict(label='Example', x=1, y=2, width=200)]
        read_review(self.save())
        self.review['map']['sections'][0]['x'] = '1" onload="bad'
        with self.assertRaisesRegex(ValueError, 'finite coordinates'):
            read_review(self.save())

    def test_cue_phrases_must_exist_in_order(self):
        self.review['sequences'][0]['rows'][0]['phases'][0]['phrase'] = 'Unspoken phrase'
        with self.assertRaisesRegex(ValueError, 'exactly once'):
            read_review(self.save())

    def test_narration_change_requires_new_audio(self):
        self.review['sequences'][0]['rows'][0]['text'] += ' Extra words.'
        with self.assertRaisesRegex(ValueError, 'stale'):
            load_track(EXAMPLE / 'audio', 'sequences', tracks(self.review)['sequences'])

    def test_invalid_cue_and_word_times_fail(self):
        shutil.copy(EXAMPLE / 'audio/sequences.wav', self.folder / 'sequences.wav')
        original = json.loads((EXAMPLE / 'audio/sequences.json').read_text())
        changed = copy.deepcopy(original)
        changed['beats'][0]['phases'][1]['start'] = original['beats'][1]['start'] + 1
        path = self.folder / 'sequences.json'
        path.write_text(json.dumps(changed))
        with self.assertRaisesRegex(ValueError, 'outside'):
            load_track(self.folder, 'sequences', tracks(self.review)['sequences'])
        changed = copy.deepcopy(original)
        changed['beats'][0]['phases'][1]['start'] += .1
        path.write_text(json.dumps(changed))
        with self.assertRaisesRegex(ValueError, 'spoken phrase'):
            load_track(self.folder, 'sequences', tracks(self.review)['sequences'])
        changed = copy.deepcopy(original)
        changed['clip']['words'][0]['endMs'] = original['clip']['durationMs'] + 1
        path.write_text(json.dumps(changed))
        with self.assertRaisesRegex(ValueError, 'word timing'):
            load_track(self.folder, 'sequences', tracks(self.review)['sequences'])

    def test_embedded_source_cannot_close_the_script(self):
        source = self.folder / 'after'
        shutil.copytree(EXAMPLE / 'after', source)
        file = source / 'render.mjs'
        file.write_text(file.read_text().replace("import { selectLayout } from './layouts.mjs'", '// </script><script> __RUNTIME__'))
        self.review['source']['root'] = str(source)
        build(self.save(), EXAMPLE / 'audio', self.folder / 'review.html')
        output = (self.folder / 'review.html').read_text()
        self.assertEqual(output.count('<script>'), 1)
        self.assertIn('\\u003c/script>\\u003cscript> __RUNTIME__', output)

    def test_word_alignment_uses_utf16_offsets_and_rejects_drift(self):
        text = 'Hi 😀 there.'
        tokens = [SimpleNamespace(text=word, start_ts=index, end_ts=index + .5) for index, word in enumerate(['Hi', '😀', 'there.'])]
        words, consumed = align_tokens(text, tokens, 0, 100, 3000)
        self.assertEqual(consumed, len(text))
        self.assertEqual([word['charIndex'] for word in words], [0, 3, 6])
        self.assertEqual(words[1]['charLength'], 2)
        self.assertEqual(words[0]['startMs'], 100)
        self.assertEqual(utf16_length(text), len(text) + 1)
        with self.assertRaisesRegex(ValueError, 'Cannot align'):
            align_tokens(text, [tokens[-1]], 0, 0, 3000)

    @unittest.skipUnless(shutil.which('ffmpeg'), 'MP3 export requires ffmpeg')
    def test_mp3_export_embeds_smaller_audio_with_the_same_cues(self):
        output = self.folder / 'compressed.html'
        payload = build(self.save(), EXAMPLE / 'audio', output, audio_format='mp3')
        self.assertEqual(output.read_text().count('data:audio/mpeg;base64,'), 2)
        pcm_size = sum((EXAMPLE / 'audio' / f'{name}.wav').stat().st_size
                       for name in ('map', 'sequences'))
        self.assertLess(output.stat().st_size, pcm_size)
        original = json.loads((EXAMPLE / 'audio/sequences.json').read_text())
        self.assertEqual(payload['sequenceTourData']['clip'], original['clip'])


if __name__ == '__main__':
    unittest.main()
