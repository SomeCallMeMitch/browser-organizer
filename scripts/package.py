"""Package only public build assets and source tracked by Git; never include profiles/data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import subprocess
out = Path('artifacts')
out.mkdir(exist_ok=True)
with ZipFile(out / 'browser-organizer-unpacked-v0.1.0.zip', 'w', ZIP_DEFLATED) as archive:
    for path in sorted(Path('dist').iterdir()):
        if path.is_file():
            archive.write(path, 'browser-organizer/' + path.name)
# git ls-files includes staged additions; profiles, history and backups are ignored.
with ZipFile(out / 'browser-organizer-source-v0.1.0.zip', 'w', ZIP_DEFLATED) as archive:
    paths = subprocess.check_output(['git', 'ls-files', '-z']).decode().split('\0')
    for filename in sorted(filter(None, paths)):
        path = Path(filename)
        if path.is_file():
            archive.write(path, 'browser-organizer/' + filename)
for path in sorted(out.glob('browser-organizer-*.zip')):
    print(f'{path}  sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}')
