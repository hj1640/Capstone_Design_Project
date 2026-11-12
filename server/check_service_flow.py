"""D-051 runs actual Waitress subprocess twice; uses synthetic data and file adapters, not native UI."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
from service import ServiceAPI

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as folder:
    folder = Path(folder)
    database = folder / 'service.sqlite3'
    api = ServiceAPI(database)
    invite = api.invite('synthetic integration owner')
    other = api.invite('synthetic other owner')
    (folder / 'private-fixture.json').write_text(json.dumps(dict(invite=invite, other=other)), encoding='utf-8')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    env = {**os.environ, 'FRIDGE_DB_PATH': str(database), 'PORT': str(port), 'FRIDGE_BIND': '127.0.0.1'}
    for phase in ['first', 'restart']:
        with (folder / 'server.log').open('a', encoding='utf-8') as log:
            process = subprocess.Popen([sys.executable, 'server/service.py'], cwd=ROOT, env=env, stdout=log, stderr=log)
            try:
                for attempt in range(100):
                    if process.poll() is not None: raise RuntimeError('Waitress exited: inspect local test dependency installation')
                    try:
                        with urlopen(base + '/healthz', timeout=1) as response:
                            if response.status == 200: break
                    except OSError: time.sleep(0.1)
                else: raise RuntimeError('Service startup timed out')
                subprocess.run(['node', 'scripts/service-flow-check.mjs', base, str(folder), phase], cwd=ROOT, check=True)
            finally:
                process.terminate()
                process.wait(timeout=10)
    backup = folder / 'backup.sqlite3'
    api.backup(backup)
    with ServiceAPI(backup).connect() as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    print('PASS: actual Waitress process restart and SQLite backup integrity (synthetic fixture)')
