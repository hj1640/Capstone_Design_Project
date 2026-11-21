"""Runs the real API and app's pure modules; no synthetic review endpoint or catalogue injection."""
from http.server import ThreadingHTTPServer
from pathlib import Path
import subprocess
import tempfile
import threading
from dev_api import API, handler

ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as folder:
    api=API(Path(folder)/'integration.sqlite3',{'a':'alice','b':'bob'})
    server=ThreadingHTTPServer(('127.0.0.1',0),handler(api))
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:
        subprocess.run(['node','scripts/personal-flow-check.mjs',f'http://127.0.0.1:{server.server_port}',folder],cwd=ROOT,check=True)
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
