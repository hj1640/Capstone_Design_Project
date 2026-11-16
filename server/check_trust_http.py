"""Temporary SYNTHETIC policy approval to exercise HTTP publication; no real DB is used."""
from http.server import ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
import threading
from dev_api import handler
from synthetic_trust_fixture import Sandbox, experimental_policy

ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as folder:
    sandbox=Sandbox(Path(folder)/'synthetic-http.sqlite3',experimental_policy(publish=True))
    entries=[sandbox.add(i,x) for i,x in enumerate((9,10,11))]
    server=ThreadingHTTPServer(('127.0.0.1',0),handler(sandbox.api))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        subprocess.run(['node','scripts/stage7-http-check.mjs',f'http://127.0.0.1:{server.server_port}',
            entries[0]['feedback_id']],cwd=ROOT,check=True)
    finally:
        server.shutdown();server.server_close();thread.join()
