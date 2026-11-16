"""Full synthetic software flow. Review callback exists only in this test harness."""
from dataclasses import replace
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import tempfile
import threading
from dev_api import API, handler
from synthetic_trust_fixture import experimental_policy

ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as folder:
    policy=replace(experimental_policy(publish=True),version='synthetic-stage8-only',minimum_contributors=1)
    api=API(Path(folder)/'stage8-test.sqlite3',{'stage8-test-token':'synthetic-stage8-user'},policy)
    Base=handler(api)
    class TestHandler(Base):
        def do_POST(self):
            if self.path!='/__synthetic_review__': return super().do_POST()
            if self.headers.get('Authorization')!='Bearer stage8-test-token':
                self.send_error(401);return
            body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            with api.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                row=db.execute('SELECT * FROM feedback WHERE id=?',(body['feedbackId'],)).fetchone()
                item=json.loads(row['snapshot'])['item']
                mapping=dict(foodId='food-tofu',productId=None,storage='refrigerated',opened=False,productForm='fresh')
                group=api.trust.group(item,mapping,row['basis'])
                api.trust.review_mapping(db,row['id'],mapping,'SYNTHETIC TEST ONLY')
                api.trust.set_reference(db,group,10,'SYNTHETIC TEST ONLY; not a real food duration')
                api.trust.evaluate(db,row['id'])
            data=b'{"synthetic":true}'
            self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    server=ThreadingHTTPServer(('127.0.0.1',0),TestHandler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try:
        subprocess.run(['node','scripts/stage8-flow-check.mjs',f'http://127.0.0.1:{server.server_port}'],cwd=ROOT,check=True)
    finally:
        server.shutdown();server.server_close();thread.join()
