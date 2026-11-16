from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import tempfile
import unittest
from dev_api import API, CONSENT


def item(item_id='item'):
    return dict(itemId=item_id,foodId=None,productId=None,purchaseDate='2026-11-01',openedDate=None,
        conditions=None,suggestedExpiryDate='2026-11-10',overrideExpiryDate='2026-11-12',
        overrideSource='package_label',ruleSnapshot=None,revision=1)


class APITests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.api=API(Path(self.temp.name)/'test.sqlite3',{'test-a':'alice','test-b':'bob'})
        self.n=0

    def tearDown(self): self.temp.cleanup()

    def call(self,method,path,body=None,token='test-a',key=None):
        self.n+=1
        return self.api.handle(method,path,body or {},token,key or f'key-{self.n}')

    def create(self):
        status,_=self.call('PUT','/v1/me/items/item',dict(item=item(),expectedRevision=0))
        self.assertEqual(status,201)

    def submit(self,**changes):
        body=dict(itemId='item',itemRevision=1,consentVersion=CONSENT,basis='purchase_remaining')
        body.update(changes)
        return self.call('POST','/v1/me/expiry-feedback',body)

    def test_auth_and_owner_boundaries(self):
        self.create()
        self.assertEqual(self.call('GET','/v1/me/items/item',token='bad')[0],401)
        self.assertEqual(self.call('GET','/v1/me/items/item',token='test-b')[0],404)

    def test_strict_calendar_and_source(self):
        self.create()
        for expiry,source in [('2026-02-30','package_label'),('2026-11-12',None),(None,'package_label')]:
            self.assertEqual(self.call('PATCH','/v1/me/items/item/expiry',
                dict(expectedRevision=1,expiryDate=expiry,source=source))[0],422)

    def test_idempotency_replay_and_payload_conflict(self):
        self.create()
        body=dict(expectedRevision=1,expiryDate='2026-11-13',source='user_estimate')
        first=self.call('PATCH','/v1/me/items/item/expiry',body,key='stable')
        self.assertEqual(self.call('PATCH','/v1/me/items/item/expiry',body,key='stable'),first)
        self.assertEqual(self.call('PATCH','/v1/me/items/item/expiry',{**body,'expiryDate':'2026-11-14'},key='stable')[0],409)

    def test_stale_revision_and_clear(self):
        self.create()
        self.assertEqual(self.call('PATCH','/v1/me/items/item/expiry',dict(expectedRevision=0,expiryDate=None,source=None))[0],409)
        status,data=self.call('PATCH','/v1/me/items/item/expiry',dict(expectedRevision=1,expiryDate=None,source=None))
        self.assertEqual((status,data['revision'],data['overrideExpiryDate']),(200,2,None))

    def test_distinct_keys_deduplicate_same_item_revision_basis(self):
        self.create()
        a=self.submit()[1]; b=self.submit()[1]
        self.assertEqual(a['feedbackId'],b['feedbackId'])
        self.assertEqual(a['state'],'held')
        with self.api.connect() as db: self.assertEqual(db.execute('SELECT count(*) FROM feedback').fetchone()[0],1)

    def test_concurrent_submissions_are_one_row(self):
        self.create()
        body=dict(itemId='item',itemRevision=1,consentVersion=CONSENT,basis='purchase_remaining')
        with ThreadPoolExecutor(max_workers=4) as pool:
            results=list(pool.map(lambda i:self.api.handle('POST','/v1/me/expiry-feedback',body,'test-a',f'parallel-{i}'),range(8)))
        self.assertEqual({x[0] for x in results},{202})
        self.assertEqual(len({x[1]['feedbackId'] for x in results}),1)

    def test_consent_and_client_weight_rejected(self):
        self.create()
        self.assertEqual(self.submit(consentVersion='wrong')[0],422)
        self.assertEqual(self.submit(weight=1)[0],422)

    def test_date_order_and_missing_open_date_held(self):
        self.create()
        self.assertEqual(self.submit(basis='after_opening')[1]['reasonCode'],'MISSING_BASE_DATE')
        self.call('PATCH','/v1/me/items/item/expiry',dict(expectedRevision=1,expiryDate='2026-10-01',source='user_estimate'))
        self.assertEqual(self.submit(itemRevision=2)[1]['reasonCode'],'INVALID_DATE_ORDER')

    def test_edit_supersedes_and_override_is_preserved(self):
        self.create()
        receipt=self.submit()[1]
        self.call('PATCH','/v1/me/items/item/expiry',dict(expectedRevision=1,expiryDate='2026-11-15',source='user_estimate'))
        self.assertEqual(self.call('GET',f"/v1/me/expiry-feedback/{receipt['feedbackId']}")[1]['state'],'superseded')
        self.assertEqual(self.call('GET','/v1/me/items/item')[1]['overrideExpiryDate'],'2026-11-15')

    def test_revoke_before_post_prevents_resurrection(self):
        self.create()
        self.call('DELETE','/v1/me/expiry-feedback/by-key/never-send',{})
        body=dict(itemId='item',itemRevision=1,consentVersion=CONSENT,basis='purchase_remaining')
        self.assertEqual(self.call('POST','/v1/me/expiry-feedback',body,key='never-send')[1]['error']['code'],'CONSENT_WITHDRAWN')

    def test_revoke_after_lost_response_and_alias_key(self):
        self.create()
        body=dict(itemId='item',itemRevision=1,consentVersion=CONSENT,basis='purchase_remaining')
        original=self.call('POST','/v1/me/expiry-feedback',body,key='first')[1]
        self.call('POST','/v1/me/expiry-feedback',body,key='alias')
        self.call('DELETE','/v1/me/expiry-feedback/by-key/alias',{})
        self.assertEqual(self.call('GET',f"/v1/me/expiry-feedback/{original['feedbackId']}")[1]['state'],'withdrawn')

    def test_other_owner_cannot_withdraw_feedback(self):
        self.create()
        receipt=self.submit()[1]
        self.assertEqual(self.call('DELETE',f"/v1/me/expiry-feedback/{receipt['feedbackId']}",{},token='test-b')[0],404)

    def test_database_survives_restart(self):
        self.create()
        restarted=API(Path(self.temp.name)/'test.sqlite3',{'test-a':'alice'})
        self.assertEqual(restarted.handle('GET','/v1/me/items/item',{},'test-a')[1]['overrideExpiryDate'],'2026-11-12')


if __name__=='__main__': unittest.main()
