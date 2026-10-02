import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parents[1] / 'skills/review-story/scripts'
sys.path.insert(0, str(SCRIPTS))
spec = importlib.util.spec_from_file_location('speech_setup', SCRIPTS / 'setup.py')
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
from check_updates import check, parse_version
from narrate import narrate
from build import validate_review


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='review story test ')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_offline_missing_runtime_does_not_install_or_leave_lock(self):
        with patch.object(setup, 'find_uv') as install:
            with self.assertRaisesRegex(ValueError, 'No verified runtime'):
                setup.setup(self.root, offline=True)
            install.assert_not_called()
        self.assertFalse((self.root / 'setup.lock').exists())

    def test_verified_runtime_reuses_without_network(self):
        folder = self.root / ('speech-' + setup.runtime_key())
        python = setup.python_in(folder)
        python.parent.mkdir(parents=True)
        python.touch()
        (folder / 'ready.json').write_text('{}', encoding="utf-8")
        with patch.object(setup, 'run') as run, patch.object(setup, 'find_uv') as install:
            self.assertEqual(setup.setup(self.root, offline=True), python.resolve())
            run.assert_not_called()
            install.assert_not_called()

    def test_failed_smoke_is_never_ready_and_releases_lock(self):
        def run(command, **kwargs):
            if str(command[-1]).endswith('check_speech.py'):
                raise subprocess.CalledProcessError(1, command)
            return subprocess.CompletedProcess(command, 0, stdout='3.12\n')
        with patch.object(setup, 'find_uv', return_value=['uv']), patch.object(setup, 'run', side_effect=run):
            with self.assertRaises(subprocess.CalledProcessError):
                setup.setup(self.root)
        self.assertFalse(list(self.root.glob('speech-*/ready.json')))
        self.assertFalse((self.root / 'setup.lock').exists())

    def test_concurrent_setup_preserves_existing_lock(self):
        lock = self.root / 'setup.lock'
        lock.write_text('another process', encoding="utf-8")
        with self.assertRaisesRegex(ValueError, 'Another setup'):
            setup.setup(self.root)
        self.assertEqual(lock.read_text(encoding="utf-8"), 'another process')

    def test_runtime_cannot_be_inside_installed_skill(self):
        with self.assertRaisesRegex(ValueError, 'outside'):
            setup.setup(SCRIPTS.parent / 'runtime')

    def test_missing_uv_bootstraps_privately_without_shell(self):
        calls = []
        with patch.object(setup.shutil, 'which', return_value=None), patch.object(setup, 'run', side_effect=lambda command: calls.append(command)), patch.object(setup.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)):
            command = setup.find_uv(self.root)
        self.assertIn(str(self.root), command[0])
        self.assertEqual(calls[0][:3], [sys.executable, '-m', 'venv'])
        self.assertIn(f'uv=={setup.UV_VERSION}', calls[1])

    def test_update_network_failure_is_unknown_not_current(self):
        output = io.StringIO()
        with patch('urllib.request.urlopen', side_effect=OSError('offline')), contextlib.redirect_stdout(output):
            check()
        self.assertIn('unavailable', output.getvalue())
        self.assertNotIn('matches', output.getvalue())

    def test_versions_are_numeric_and_metadata_is_not_executable(self):
        self.assertGreater(parse_version('0.10.0'), parse_version('0.2.0'))
        with self.assertRaises(ValueError):
            parse_version('0.2.0; do something')

    def test_invalid_source_is_rejected_before_speech_dependencies(self):
        example = SCRIPTS.parents[2] / 'examples/catalog'
        review = json.loads((example / 'review.json').read_text(encoding="utf-8"))
        review['source']['root'] = str(example / 'after')
        card = next(iter(review['cards'].values()))
        card['context'] = [[card['end'] + 1, card['end'] + 1]]
        input_path = self.root / 'review.json'
        input_path.write_text(json.dumps(review), encoding="utf-8")
        with patch('narrate.Renderer') as renderer:
            with self.assertRaisesRegex(ValueError, 'Invalid context range'):
                narrate(input_path, self.root / 'audio')
            renderer.assert_not_called()
        self.assertFalse((self.root / 'audio').exists())

    def test_valid_source_can_be_checked_without_audio(self):
        example = SCRIPTS.parents[2] / 'examples/catalog/review.json'
        review, sources, cards = validate_review(example)
        self.assertTrue(cards)
        self.assertTrue(sources)


if __name__ == '__main__':
    unittest.main()
