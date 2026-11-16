"""D-047 local development API. Token fixtures are not production identity verification."""
import argparse
from contextlib import contextmanager
from datetime import date, datetime, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
from urllib.parse import unquote, urlsplit, parse_qs
import uuid
from trust_stats import TrustStats, load_policy
import personal_stats

CONSENT = 'development-consent-v1'


class ApiError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def calendar(value, nullable=True):
    if value is None and nullable:
        return value
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
        raise ApiError(422, 'INVALID_DATE')
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ApiError(422, 'INVALID_DATE')
    return value


def revision(value):
    if type(value) is not int or value < 0:
        raise ApiError(422, 'INVALID_REVISION')
    return value


def fields(body, allowed):
    if not isinstance(body, dict) or set(body) != set(allowed):
        raise ApiError(422, 'INVALID_FIELDS')


def override(expiry, source):
    calendar(expiry)
    if (expiry is None and source is not None) or (expiry is not None and source not in ('package_label','user_estimate')):
        raise ApiError(422, 'INVALID_SOURCE')


class API:
    def __init__(self, database, tokens, policy=None):
        self.database = str(database)
        self.tokens = {hashlib.sha256(token.encode()).hexdigest(): owner for token, owner in tokens.items()}
        self.trust=TrustStats(policy)
        with self.connect() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS items(owner TEXT, id TEXT, data TEXT NOT NULL, revision INTEGER NOT NULL,
              PRIMARY KEY(owner,id));
            CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY, owner TEXT, item TEXT, revision INTEGER,
              basis TEXT, state TEXT, reason TEXT, created TEXT, snapshot TEXT,
              UNIQUE(owner,item,revision,basis));
            CREATE TABLE IF NOT EXISTS requests(owner TEXT, route TEXT, key TEXT, hash TEXT, status INTEGER, response TEXT,
              PRIMARY KEY(owner,route,key));
            CREATE TABLE IF NOT EXISTS submission_keys(owner TEXT, key TEXT, feedback_id TEXT, PRIMARY KEY(owner,key));
            CREATE TABLE IF NOT EXISTS revoked_keys(owner TEXT, key TEXT, PRIMARY KEY(owner,key));
            ''')
            self.trust.schema(db)
            personal_stats.schema(db)

    @contextmanager
    def connect(self):
        db=sqlite3.connect(self.database,timeout=10)
        db.row_factory=sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def owner(self, token):
        digest=hashlib.sha256(token.encode()).hexdigest()
        for stored, owner in self.tokens.items():
            if secrets.compare_digest(stored,digest):
                return owner
        raise ApiError(401,'UNAUTHORIZED')

    @staticmethod
    def receipt(row,db=None):
        event=db.execute('SELECT policy_version FROM trust_events WHERE feedback_id=? ORDER BY id DESC LIMIT 1',(row['id'],)).fetchone() if db else None
        return dict(feedbackId=row['id'],state=row['state'],reasonCode=row['reason'],
                    policyVersion=event['policy_version'] if event else None,createdAt=row['created'])

    @staticmethod
    def item(db, owner, item_id):
        row=db.execute('SELECT * FROM items WHERE owner=? AND id=?',(owner,item_id)).fetchone()
        if not row:
            raise ApiError(404,'NOT_FOUND')
        return json.loads(row['data'])

    def handle(self, method, path, body, token, key=None):
        try:
            owner=self.owner(token)
            parsed=urlsplit(path)
            path=parsed.path
            query=parse_qs(parsed.query,keep_blank_values=True)
            if method == 'GET' and path == '/v1/me':
                return 200,dict(ownerId=owner,consentVersion=CONSENT,mode='local_development')
            with self.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                route=f'{method} {path}'
                if method != 'GET':
                    if not isinstance(key,str) or not key or len(key)>200:
                        raise ApiError(400,'IDEMPOTENCY_KEY_REQUIRED')
                    fingerprint=hashlib.sha256(canonical(body).encode()).hexdigest()
                    old=db.execute('SELECT * FROM requests WHERE owner=? AND route=? AND key=?',(owner,route,key)).fetchone()
                    if old:
                        if old['hash'] != fingerprint:
                            raise ApiError(409,'IDEMPOTENCY_CONFLICT')
                        return old['status'],json.loads(old['response'])
                status,response=self.dispatch(db,owner,method,path,body,key,query)
                if method != 'GET':
                    db.execute('INSERT INTO requests VALUES(?,?,?,?,?,?)',(owner,route,key,fingerprint,status,canonical(response)))
                return status,response
        except ApiError as error:
            return error.status,dict(error=dict(code=error.code,message=error.code,requestId=str(uuid.uuid4())))

    def dispatch(self, db, owner, method, path, body, key, query=None):
        if path == '/v1/me/personal-statistics' and method == 'GET':
            return 200, dict(statistics=personal_stats.summaries(db, owner), basis='purchase_remaining',
                             method='arithmetic_mean', scope='personal', source='package_label')
        personal_match = re.fullmatch(r'/v1/me/personal-items/([^/]+)', path)
        if personal_match:
            item_id = unquote(personal_match[1])
            if method == 'GET':
                row = db.execute('SELECT * FROM personal_records WHERE owner=? AND item_id=?', (owner, item_id)).fetchone()
                if not row:
                    raise ApiError(404, 'NOT_FOUND')
                return 200, dict(revision=row['revision'], data=json.loads(row['data']))
            if method == 'PUT':
                fields(body, ('data', 'expectedRevision'))
                expected = revision(body['expectedRevision'])
                personal_stats.validate(body['data'], calendar, ApiError)
                return 200, personal_stats.update(db, owner, item_id, expected, body['data'], ApiError)
        food_match=re.fullmatch(r'/v1/foods/([^/]+)/storage-rules',path)
        if food_match and method=='GET':
            query=query or {}
            allowed={'storage','opened','productForm','basis','overrideSource','productId'}
            if set(query)-allowed or any(len(v)!=1 or not v[0] for v in query.values()):
                raise ApiError(422,'INVALID_RULE_FILTER')
            values={k:v[0] for k,v in query.items()}
            choices={'storage':('room','refrigerated','frozen'),'opened':('true','false'),
                'basis':('purchase_remaining','after_opening'),'overrideSource':('package_label','user_estimate')}
            if any(k in choices and v not in choices[k] for k,v in values.items()):
                raise ApiError(422,'INVALID_RULE_FILTER')
            rules=[]
            for rule in self.trust.public_rules(db,unquote(food_match[1])):
                if rule['productId'] not in (None,values.get('productId')): continue
                if any(k in values and rule['conditions'][k]!=values[k] for k in ('storage','productForm')): continue
                if 'opened' in values and rule['conditions']['opened']!=(values['opened']=='true'): continue
                if any(k in values and rule[k]!=values[k] for k in ('basis','overrideSource')): continue
                rules.append(rule)
            return 200,dict(rules=rules)
        item_match=re.fullmatch(r'/v1/me/items/([^/]+)(/expiry)?',path)
        if item_match:
            item_id=unquote(item_match[1])
            if method == 'GET' and not item_match[2]:
                return 200,self.item(db,owner,item_id)
            if method == 'PUT' and not item_match[2]:
                fields(body,('item','expectedRevision'))
                if revision(body['expectedRevision']) != 0:
                    raise ApiError(409,'REVISION_CONFLICT')
                item=body['item']
                fields(item,('itemId','foodId','productId','purchaseDate','openedDate','conditions','suggestedExpiryDate',
                             'overrideExpiryDate','overrideSource','ruleSnapshot','revision'))
                if item['itemId'] != item_id or revision(item['revision']) != 1:
                    raise ApiError(422,'INVALID_ITEM')
                for name in ('purchaseDate','openedDate','suggestedExpiryDate'):
                    calendar(item[name])
                override(item['overrideExpiryDate'],item['overrideSource'])
                if item['foodId'] is not None or item['productId'] is not None or item['ruleSnapshot'] is not None:
                    raise ApiError(422,'DEV_MAPPING_UNVERIFIED')
                if item['conditions'] is not None:
                    c=item['conditions']
                    fields(c,('storage','opened','productForm'))
                    if c['storage'] not in ('room','refrigerated','frozen') or type(c['opened']) is not bool or not isinstance(c['productForm'],str):
                        raise ApiError(422,'INVALID_CONDITIONS')
                if db.execute('SELECT 1 FROM items WHERE owner=? AND id=?',(owner,item_id)).fetchone():
                    raise ApiError(409,'REVISION_CONFLICT')
                db.execute('INSERT INTO items VALUES(?,?,?,1)',(owner,item_id,canonical(item)))
                return 201,item
            if method == 'PATCH' and item_match[2]:
                fields(body,('expectedRevision','expiryDate','source'))
                item=self.item(db,owner,item_id)
                if revision(body['expectedRevision']) != item['revision']:
                    raise ApiError(409,'REVISION_CONFLICT')
                override(body['expiryDate'],body['source'])
                item.update(overrideExpiryDate=body['expiryDate'],overrideSource=body['source'],revision=item['revision']+1)
                db.execute('UPDATE items SET data=?,revision=? WHERE owner=? AND id=?',(canonical(item),item['revision'],owner,item_id))
                self.trust.invalidate_item(db,owner,item_id)
                db.execute("UPDATE feedback SET state='superseded',reason='ITEM_EDITED' WHERE owner=? AND item=? AND state NOT IN ('withdrawn','superseded')",(owner,item_id))
                return 200,item
        by_key=re.fullmatch(r'/v1/me/expiry-feedback/by-key/([^/]+)',path)
        if by_key and method == 'DELETE':
            fields(body,())
            submit_key=unquote(by_key[1])
            db.execute('INSERT OR IGNORE INTO revoked_keys VALUES(?,?)',(owner,submit_key))
            linked=db.execute('SELECT feedback_id FROM submission_keys WHERE owner=? AND key=?',(owner,submit_key)).fetchone()
            if linked:
                self.trust.deactivate(db,linked['feedback_id'],'CONSENT_WITHDRAWN')
                db.execute("UPDATE feedback SET state='withdrawn',reason='CONSENT_WITHDRAWN' WHERE owner=? AND id=?",(owner,linked['feedback_id']))
            return 200,dict(state='withdrawn',submissionKey=submit_key)
        feedback_match=re.fullmatch(r'/v1/me/expiry-feedback/([^/]+)',path)
        if feedback_match:
            row=db.execute('SELECT * FROM feedback WHERE owner=? AND id=?',(owner,unquote(feedback_match[1]))).fetchone()
            if not row:
                raise ApiError(404,'NOT_FOUND')
            if method == 'GET':
                return 200,dict(**self.receipt(row,db),snapshot=json.loads(row['snapshot']))
            if method == 'DELETE':
                fields(body,())
                self.trust.deactivate(db,row['id'],'CONSENT_WITHDRAWN')
                db.execute("UPDATE feedback SET state='withdrawn',reason='CONSENT_WITHDRAWN' WHERE owner=? AND id=?",(owner,row['id']))
                return 200,self.receipt(db.execute('SELECT * FROM feedback WHERE id=?',(row['id'],)).fetchone(),db)
        if method == 'POST' and path == '/v1/me/expiry-feedback':
            fields(body,('itemId','itemRevision','consentVersion','basis'))
            if not isinstance(body['itemId'],str) or not body['itemId']:
                raise ApiError(422,'INVALID_ITEM')
            if body['consentVersion'] != CONSENT:
                raise ApiError(422,'CONSENT_REQUIRED')
            if body['basis'] not in ('purchase_remaining','after_opening'):
                raise ApiError(422,'INVALID_BASIS')
            if db.execute('SELECT 1 FROM revoked_keys WHERE owner=? AND key=?',(owner,key)).fetchone():
                raise ApiError(422,'CONSENT_WITHDRAWN')
            item=self.item(db,owner,body['itemId'])
            if revision(body['itemRevision']) != item['revision']:
                raise ApiError(409,'REVISION_CONFLICT')
            if not item['overrideExpiryDate']:
                raise ApiError(422,'OVERRIDE_REQUIRED')
            row=db.execute('SELECT * FROM feedback WHERE owner=? AND item=? AND revision=? AND basis=?',
                           (owner,body['itemId'],item['revision'],body['basis'])).fetchone()
            if not row:
                base=item['purchaseDate'] if body['basis']=='purchase_remaining' else item['openedDate']
                reason='FOOD_UNMAPPED' if item['foodId'] is None else 'POLICY_NOT_CONFIGURED'
                if not base:
                    reason='MISSING_BASE_DATE'
                elif item['overrideExpiryDate'] < base:
                    reason='INVALID_DATE_ORDER'
                snapshot=dict(item=item,basis=body['basis'],consentVersion=CONSENT,
                    valueDays=(date.fromisoformat(item['overrideExpiryDate'])-date.fromisoformat(base)).days if base else None)
                feedback_id=str(uuid.uuid4())
                db.execute('INSERT INTO feedback VALUES(?,?,?,?,?,?,?,?,?)',(feedback_id,owner,body['itemId'],item['revision'],
                    body['basis'],'held',reason,datetime.now(timezone.utc).isoformat(),canonical(snapshot)))
                row=db.execute('SELECT * FROM feedback WHERE id=?',(feedback_id,)).fetchone()
            db.execute('INSERT OR IGNORE INTO submission_keys VALUES(?,?,?)',(owner,key,row['id']))
            if self.trust.policy:
                self.trust.evaluate(db,row['id'])
                row=db.execute('SELECT * FROM feedback WHERE id=?',(row['id'],)).fetchone()
            return 202,self.receipt(row,db)
        raise ApiError(404,'NOT_FOUND')


def handler(api):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):
            pass # Do not log authorization or purchase payloads.

        def do_GET(self): self.run_request()
        def do_PUT(self): self.run_request()
        def do_PATCH(self): self.run_request()
        def do_POST(self): self.run_request()
        def do_DELETE(self): self.run_request()

        def run_request(self):
            try:
                length=int(self.headers.get('Content-Length','0'))
                if length<0 or length>65536: raise ApiError(413,'BODY_TOO_LARGE')
                body=json.loads(self.rfile.read(length)) if length else {}
                auth=self.headers.get('Authorization','')
                token=auth[7:] if auth.startswith('Bearer ') else ''
                status,response=api.handle(self.command,self.path,body,token,self.headers.get('Idempotency-Key'))
            except (ValueError,UnicodeError):
                status,response=400,dict(error=dict(code='INVALID_JSON'))
            except ApiError as error:
                status,response=error.status,dict(error=dict(code=error.code))
            except Exception:
                status,response=500,dict(error=dict(code='INTERNAL_ERROR'))
            data=canonical(response).encode()
            self.send_response(status)
            self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(data)))
            self.end_headers()
            self.wfile.write(data)
    return Handler


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--db',default='.stage0-feedback.sqlite3')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8766)
    parser.add_argument('--policy-file',help='Explicit reviewed policy; omitted means disabled')
    args=parser.parse_args()
    tokens=json.loads(os.environ.get('FRIDGE_DEV_TOKENS_JSON','{}'))
    if not tokens or not all(isinstance(k,str) and k and isinstance(v,str) and v for k,v in tokens.items()):
        raise SystemExit('Set FRIDGE_DEV_TOKENS_JSON before starting the local development server')
    Path(args.db).resolve().parent.mkdir(parents=True,exist_ok=True)
    policy=load_policy(args.policy_file) if args.policy_file else None
    print(f'Local development API on {args.host}:{args.port}; publication={bool(policy and policy.publication_enabled)}')
    ThreadingHTTPServer((args.host,args.port),handler(API(args.db,tokens,policy))).serve_forever()
