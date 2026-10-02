"""Configure the packaged phonemizer before native library initialization."""
import os
from pathlib import Path
import shutil
import tempfile

_DATA_DIRECTORY = None


def configure_espeak():
    global _DATA_DIRECTORY
    import espeakng_loader
    data = Path(espeakng_loader.get_data_path()).resolve()
    library = Path(espeakng_loader.get_library_path()).resolve()
    if not (data / 'phontab').is_file() or not library.is_file():
        raise RuntimeError('Bundled eSpeak files are incomplete. Rerun setup.py --repair.')
    # Native wheels can reject long install paths and fall back to a build-machine path.
    if _DATA_DIRECTORY is None:
        _DATA_DIRECTORY = tempfile.TemporaryDirectory(prefix='rs-')
        shutil.copytree(data, Path(_DATA_DIRECTORY.name) / 'espeak-ng-data')
    data = Path(_DATA_DIRECTORY.name) / 'espeak-ng-data'
    os.environ['ESPEAK_DATA_PATH'] = str(data)
    from phonemizer.backend.espeak.wrapper import EspeakWrapper
    EspeakWrapper.set_library(str(library))
    EspeakWrapper.set_data_path(str(data))
    return data
