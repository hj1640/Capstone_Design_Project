"""D-050 counterexamples; all values are synthetic, not food-safety references."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import tempfile
import unittest
from dev_api import API


def data(**changes):
    value=dict(foodName='두부',purchaseDate='2026-11-01',expiryDate='2026-11-11',
               storage='냉장',opened=False,active=True,source='package_label')
    value.update(changes)
    return value


class PersonalTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'personal.sqlite3'
        self.api=API(self.path,{'a':'alice','b':'bob'})
        self.n=0

    def tearDown(self): self.temp.cleanup()

    def put(self,item='one',revision=0,token='a',key=None,**changes):
        self.n+=1
        return self.api.handle('PUT','/v1/me/personal-items/'+item,
            dict(data=data(**changes),expectedRevision=revision),token,key or str(self.n))

    def stats(self,token='a'):
        return self.api.handle('GET','/v1/me/personal-statistics',{},token)[1]['statistics']

    def test_mean_replacement_withdrawal_and_restart(self):
        self.assertEqual(self.put()[0],200)
        self.put('two',expiryDate='2026-11-21')
        self.assertEqual((self.stats()[0]['meanDays'],self.stats()[0]['count']),(15,2))
        self.put(revision=1,expiryDate='2026-11-13')
        self.assertEqual((self.stats()[0]['meanDays'],self.stats()[0]['count']),(16,2))
        self.put('two',revision=1,active=False)
        self.assertEqual(self.stats()[0]['meanDays'],12)
        self.api=API(self.path,{'a':'alice','b':'bob'})
        self.assertEqual(self.stats()[0]['meanDays'],12)
        self.put(revision=2,active=False)
        self.assertEqual(self.stats(),[])

    def test_owner_isolation_and_same_item_ids(self):
        self.put()
        self.assertEqual(self.stats('b'),[])
        self.assertEqual(self.api.handle('GET','/v1/me/personal-items/one',{},'b')[0],404)
        self.put(token='b',expiryDate='2026-11-21')
        self.assertEqual(self.stats('a')[0]['meanDays'],10)
        self.assertEqual(self.stats('b')[0]['meanDays'],20)
        self.assertEqual(self.api.handle('GET','/v1/me/personal-statistics',{},'bad')[0],401)

    def test_exact_replay_and_concurrent_revision_conflict(self):
        a=self.put(key='stable')
        self.assertEqual(self.put(key='stable'),a)
        self.assertEqual(self.put(key='stable',active=False)[0],409)
        self.assertEqual(self.stats()[0]['count'],1)
        with ThreadPoolExecutor(max_workers=8) as pool:
            result=list(pool.map(lambda i:self.put(revision=1,key='parallel-'+str(i)),range(8)))
        self.assertEqual(sum(status==200 for status,_ in result),1)
        self.assertEqual(sum(status==409 for status,_ in result),7)
        self.assertEqual(self.stats()[0]['count'],1)

    def test_calendar_source_conditions_and_zero(self):
        for changes in [dict(purchaseDate=''),dict(expiryDate='2026-02-30'),dict(source='user_estimate'),
                        dict(source=None),dict(opened=1),dict(active='true'),dict(storage='else')]:
            self.assertEqual(self.put(**changes)[0],422)
        cases=[(dict(opened=True),'UNOPENED_LABEL_ONLY'),(dict(storage='미정'),'STORAGE_REQUIRED'),
               (dict(expiryDate='2026-10-31'),'EXPIRY_BEFORE_PURCHASE'),
               (dict(expiryDate=None,source=None),'LABEL_REQUIRED')]
        for i,(changes,reason) in enumerate(cases):
            self.assertEqual(self.put(str(i),**changes)[1]['reason'],reason)
        self.assertEqual(self.stats(),[])
        self.put(expiryDate='2026-11-01')
        self.assertEqual(self.stats()[0]['meanDays'],0)

    def test_group_move_and_name_normalization(self):
        self.put(foodName=' 두부  ')
        self.put('two',foodName='두부',expiryDate='2026-11-21')
        self.assertEqual(self.stats()[0]['count'],2)
        self.put(revision=1,foodName='두부',storage='냉동')
        self.assertEqual(len(self.stats()),2)
        self.assertEqual(sorted(r['meanDays'] for r in self.stats()),[10,20])

    def test_order_independence_and_no_arbitrary_outlier_cutoff(self):
        for owner,values in [('a',[9,10,11,15,16]),('b',[16,15,11,10,9])]:
            for i,days in enumerate(values): self.put(str(i),token=owner,expiryDate=f'2026-11-{days+1:02d}')
        self.assertEqual(self.stats('a'),self.stats('b'))
        self.assertEqual(self.stats()[0]['meanDays'],12.2)
        self.put('large',expiryDate='2027-11-01')
        self.assertEqual(self.stats()[0]['count'],6) # Legitimate long label is retained; no claim it is safe.

    def test_parallel_distinct_purchases_and_legacy_tables(self):
        with ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda i:self.put(str(i),key='distinct-'+str(i)),range(20)))
        self.assertEqual({x[0] for x in results},{200})
        self.assertEqual((self.stats()[0]['count'],self.stats()[0]['totalDays']),(20,200))
        with self.api.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM items').fetchone()[0],0)
            self.assertEqual(db.execute('SELECT count(*) FROM feedback').fetchone()[0],0)

if __name__=='__main__': unittest.main()
