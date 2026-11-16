"""D-051 deployable personal API. HTTPS terminates at the configured reverse proxy.

No open signup or hard-coded user tokens: operators issue one-time enrollment codes.
Session tokens are 256-bit random secrets; only their hashes are kept in SQLite.
"""
import hashlib
from contextlib import closing
from http import HTTPStatus
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
import uuid
from dev_api import API, ApiError, canonical, fields


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class ServiceAPI(API):
    def __init__(self, database, session_days=30):
        super().__init__(database, {})
        if not 1 <= session_days <= 365:
            raise ValueError('session_days must be in 1..365')
        self.session_days = session_days  # Credential lifetime, not a food-statistics threshold.
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS service_users(owner TEXT PRIMARY KEY, label TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS enrollment_codes(
                    hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL,
                    device_hash TEXT, redeemed INTEGER);
                CREATE TABLE IF NOT EXISTS service_sessions(
                    hash TEXT PRIMARY KEY, owner TEXT NOT NULL, expires INTEGER NOT NULL);
            ''')

    def invite(self, label, owner=None, lifetime_hours=24):
        if not isinstance(label, str) or not 1 <= len(label.strip()) <= 100 or not 1 <= lifetime_hours <= 168:
            raise ValueError('Invalid label or invitation lifetime')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if owner is not None:
                if not db.execute('SELECT 1 FROM service_users WHERE owner=?', (owner,)).fetchone():
                    raise ValueError('Unknown owner; do not silently move old data to another account')
            else:
                owner = str(uuid.uuid4())
                db.execute('INSERT INTO service_users VALUES(?,?)', (owner, label.strip()))
            code = secrets.token_urlsafe(32)
            db.execute('INSERT INTO enrollment_codes VALUES(?,?,?,NULL,NULL)',
                       (digest(code), owner, int(time.time()) + lifetime_hours * 3600))
        return dict(ownerId=owner, enrollmentCode=code)

    def enroll(self, body):
        # The client creates and durably stores its device secret BEFORE enrollment.
        # Repeating the same code+secret recovers a lost response without redeeming twice.
        fields(body, ('code', 'deviceSecret'))
        if any(not isinstance(body[k], str) or not re.fullmatch(r'[A-Za-z0-9_-]{43,128}', body[k])
               for k in ('code', 'deviceSecret')):
            raise ApiError(422, 'INVALID_ENROLLMENT')
        now = int(time.time())
        secret_hash = digest(body['deviceSecret'])
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM enrollment_codes WHERE hash=?', (digest(body['code']),)).fetchone()
            if not row:
                raise ApiError(401, 'INVALID_ENROLLMENT')
            if row['device_hash']:
                session = db.execute('SELECT * FROM service_sessions WHERE hash=?', (secret_hash,)).fetchone()
                if not secrets.compare_digest(row['device_hash'], secret_hash) or not session or session['expires'] <= now:
                    raise ApiError(401, 'ENROLLMENT_ALREADY_USED')
                return dict(ownerId=row['owner'], expiresAt=session['expires'])
            if row['expires'] <= now:
                raise ApiError(401, 'ENROLLMENT_EXPIRED')
            if db.execute('SELECT 1 FROM service_sessions WHERE hash=?', (secret_hash,)).fetchone():
                raise ApiError(409, 'DEVICE_SECRET_ALREADY_USED')
            expires = now + self.session_days * 86400
            db.execute('INSERT INTO service_sessions VALUES(?,?,?)', (secret_hash, row['owner'], expires))
            db.execute('UPDATE enrollment_codes SET device_hash=?,redeemed=? WHERE hash=?',
                       (secret_hash, now, row['hash']))
            return dict(ownerId=row['owner'], expiresAt=expires)

    def owner(self, token):
        if not isinstance(token, str) or len(token) > 128:
            raise ApiError(401, 'UNAUTHORIZED')
        with self.connect() as db:
            row = db.execute('SELECT owner,expires FROM service_sessions WHERE hash=?', (digest(token),)).fetchone()
        if not row or row['expires'] <= int(time.time()):
            raise ApiError(401, 'UNAUTHORIZED')
        return row['owner']

    def handle(self, method, path, body, token='', key=None):
        try:
            if '?' in path or '#' in path:
                raise ApiError(400, 'QUERY_NOT_SUPPORTED')
            if method == 'GET' and path == '/healthz':
                with self.connect() as db:
                    db.execute('SELECT 1 FROM personal_records LIMIT 1')
                return 200, dict(status='ok', api='personal-v1', mode='service')
            if method == 'POST' and path == '/v1/auth/enroll':
                return 200, self.enroll(body)
            if method == 'POST' and path == '/v1/auth/logout':
                fields(body, ())
                self.owner(token)
                with self.connect() as db:
                    db.execute('DELETE FROM service_sessions WHERE hash=?', (digest(token),))
                return 200, dict(signedOut=True)
            if method == 'GET' and path == '/v1/me':
                return 200, dict(ownerId=self.owner(token), mode='service')
            allowed = (path == '/v1/me/personal-statistics' and method == 'GET') or (
                re.fullmatch(r'/v1/me/personal-items/[A-Za-z0-9_-]{1,200}', path) and method in ('GET', 'PUT'))
            if not allowed:
                raise ApiError(404, 'NOT_FOUND')
            return super().handle(method, path, body, token, key)
        except ApiError as error:
            return error.status, dict(error=dict(code=error.code))

    def backup(self, target):
        target = Path(target)
        if target.exists() or target.resolve() == Path(self.database).resolve():
            raise ValueError('Backup target must be a new file')
        target.parent.mkdir(parents=True, exist_ok=True)
        # Reserve atomically: two operator requests must not overwrite one backup.
        with target.open('xb'):
            pass
        with self.connect() as source, closing(sqlite3.connect(target)) as destination:
            source.backup(destination)
            if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Backup integrity check failed')


def application(api):
    def wsgi(environ, start_response):
        try:
            # Native clients use explicit bearer authentication, never cookie credentials.
            if environ.get('HTTP_ORIGIN'):
                raise ApiError(403, 'BROWSER_ORIGIN_NOT_ALLOWED')
            length = int(environ.get('CONTENT_LENGTH') or '0')
            if length < 0 or length > 65536:
                raise ApiError(413, 'BODY_TOO_LARGE')
            method = environ['REQUEST_METHOD']
            if method in ('POST', 'PUT') and environ.get('CONTENT_TYPE', '').split(';')[0].strip() != 'application/json':
                raise ApiError(415, 'JSON_REQUIRED')
            body = json.loads(environ['wsgi.input'].read(length)) if length else {}
            auth = environ.get('HTTP_AUTHORIZATION', '')
            path = environ.get('PATH_INFO', '')
            if environ.get('QUERY_STRING'):
                raise ApiError(400, 'QUERY_NOT_SUPPORTED')
            status, result = api.handle(method, path, body, auth[7:] if auth.startswith('Bearer ') else '',
                                        environ.get('HTTP_IDEMPOTENCY_KEY'))
        except ApiError as error:
            status, result = error.status, dict(error=dict(code=error.code))
        except (ValueError, UnicodeError):
            status, result = 400, dict(error=dict(code='INVALID_JSON'))
        except sqlite3.OperationalError:
            status, result = 503, dict(error=dict(code='DATABASE_UNAVAILABLE'))
        except Exception:
            status, result = 500, dict(error=dict(code='INTERNAL_ERROR'))
        encoded = canonical(result).encode()
        headers = [('Content-Type', 'application/json; charset=utf-8'), ('Content-Length', str(len(encoded))),
                   ('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff')]
        if status == 503:
            headers.append(('Retry-After', '5'))
        start_response(f'{status} {HTTPStatus(status).phrase}', headers)
        return [encoded]
    return wsgi


if __name__ == '__main__':
    from waitress import serve
    path = Path(os.environ.get('FRIDGE_DB_PATH', '.stage0-service.sqlite3'))
    path.parent.mkdir(parents=True, exist_ok=True)
    api = ServiceAPI(path, int(os.environ.get('FRIDGE_SESSION_DAYS', '30')))
    serve(application(api), host=os.environ.get('FRIDGE_BIND', '127.0.0.1'),
          port=int(os.environ.get('PORT', '8766')), max_request_body_size=65536,
          max_request_header_size=16384, channel_timeout=30, threads=4)
