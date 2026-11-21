"""D-051 synthetic service security, concurrency, persistence and HTTP boundaries."""
from concurrent.futures import ThreadPoolExecutor
import io
import json
from pathlib import Path
import secrets
import tempfile
import unittest
from unittest.mock import patch
from service import ServiceAPI, application, digest
from test_personal_stats import data


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.db = Path(self.temp.name) / 'service.sqlite3'
        self.api = ServiceAPI(self.db)
        self.invite = self.api.invite('synthetic A')
        self.token = secrets.token_urlsafe(32)

    def tearDown(self): self.temp.cleanup()

    def enroll(self, token=None):
        return self.api.handle('POST', '/v1/auth/enroll',
            dict(code=self.invite['enrollmentCode'], deviceSecret=token or self.token))

    def test_enrollment_replay_hashes_and_other_device_rejected(self):
        first = self.enroll()
        self.assertEqual(first[0], 200)
        self.assertEqual(self.enroll(), first)
        self.assertEqual(self.enroll(secrets.token_urlsafe(32))[0], 401)
        self.assertEqual(self.api.owner(self.token), self.invite['ownerId'])
        with self.api.connect() as db:
            serialized = '\n'.join(db.iterdump())
        self.assertNotIn(self.token, serialized)
        self.assertNotIn(self.invite['enrollmentCode'], serialized)

    def test_concurrent_enrollment_only_one_device(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.enroll(secrets.token_urlsafe(32)), range(8)))
        self.assertEqual(sorted(status for status, _ in results), [200] + [401] * 7)

    def test_expiration_and_invalid_fields(self):
        with patch('service.time.time', return_value=20000000000):
            self.assertEqual(self.enroll()[1]['error']['code'], 'ENROLLMENT_EXPIRED')
        for payload in [[], {}, dict(code='bad', deviceSecret='bad'),
                        dict(code=self.invite['enrollmentCode'], deviceSecret=self.token, owner='other')]:
            self.assertEqual(self.api.handle('POST', '/v1/auth/enroll', payload)[0], 422)
        self.enroll()
        with patch('service.time.time', return_value=20000000000):
            self.assertEqual(self.api.handle('GET', '/v1/me', {}, self.token)[0], 401)

    def test_isolation_restart_logout_and_same_owner_reenrollment(self):
        self.enroll()
        request = dict(data=data(), expectedRevision=0)
        self.assertEqual(self.api.handle('PUT', '/v1/me/personal-items/one', request, self.token, 'once')[0], 200)
        self.api = ServiceAPI(self.db)
        self.assertEqual(self.api.handle('GET', '/v1/me/personal-statistics', {}, self.token)[1]['statistics'][0]['meanDays'], 10)
        other = self.api.invite('synthetic B')
        other_token = secrets.token_urlsafe(32)
        self.api.enroll(dict(code=other['enrollmentCode'], deviceSecret=other_token))
        self.assertEqual(self.api.handle('GET', '/v1/me/personal-statistics', {}, other_token)[1]['statistics'], [])
        self.assertEqual(self.api.handle('GET', '/v1/me/personal-items/one', {}, other_token)[0], 404)
        self.assertEqual(self.api.handle('POST', '/v1/auth/logout', {}, self.token)[0], 200)
        self.assertEqual(self.enroll()[0], 401)  # Old code cannot resurrect a revoked session.
        renewed = self.api.invite('synthetic A', self.invite['ownerId'])
        new_token = secrets.token_urlsafe(32)
        self.api.enroll(dict(code=renewed['enrollmentCode'], deviceSecret=new_token))
        self.assertEqual(self.api.owner(new_token), self.invite['ownerId'])
        self.assertEqual(self.api.handle('GET', '/v1/me/personal-statistics', {}, new_token)[1]['statistics'][0]['count'], 1)
        with self.assertRaises(ValueError): self.api.invite('invalid', 'nonexistent')

    def test_legacy_routes_and_unauthenticated_access_blocked(self):
        for route in ['/v1/items', '/v1/feedback', '/v1/me/personal-items/../one']:
            self.assertEqual(self.api.handle('GET', route, {})[0], 404)
        self.assertEqual(self.api.handle('GET', '/v1/me/personal-statistics', {})[0], 401)
        self.assertEqual(self.api.handle('GET', '/healthz', {})[1]['mode'], 'service')

    def test_online_backup_restore_and_no_overwrite(self):
        self.enroll()
        self.api.handle('PUT', '/v1/me/personal-items/one', dict(data=data(), expectedRevision=0), self.token, 'one')
        backup = Path(self.temp.name) / 'backup.sqlite3'
        self.api.backup(backup)
        restored = ServiceAPI(backup)
        self.assertEqual(restored.handle('GET', '/v1/me/personal-statistics', {}, self.token)[1]['statistics'][0]['meanDays'], 10)
        with self.assertRaises(ValueError): self.api.backup(backup)

    def test_wsgi_validation_and_no_cache(self):
        app = application(self.api)
        def request(**changes):
            env = dict(REQUEST_METHOD='GET', PATH_INFO='/healthz', CONTENT_LENGTH='0')
            env['wsgi.input'] = io.BytesIO(b'{bad')
            env.update(changes)
            response = []
            body = b''.join(app(env, lambda status, headers: response.append((status, dict(headers)))))
            return int(response[0][0][:3]), response[0][1], json.loads(body)
        self.assertEqual(request()[1]['Cache-Control'], 'no-store')
        self.assertEqual(request(HTTP_ORIGIN='https://untrusted.test')[0], 403)
        self.assertEqual(request(CONTENT_LENGTH='65537')[0], 413)
        self.assertEqual(request(REQUEST_METHOD='POST')[0], 415)
        self.assertEqual(request(CONTENT_LENGTH='4', CONTENT_TYPE='application/json')[0], 400)
        self.assertEqual(request(QUERY_STRING='token=never-accept')[0], 400)

if __name__ == '__main__': unittest.main()
