from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import json
from pathlib import Path
import tempfile
import unittest
from dev_api import API
from synthetic_trust_fixture import Sandbox, experimental_policy
from trust_stats import load_policy


class TrustTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'sandbox.sqlite3'
        self.s=Sandbox(self.path,experimental_policy(publish=True))

    def tearDown(self): self.temp.cleanup()

    def normal(self):
        return [self.s.add(i,days) for i,days in enumerate((9,10,11))]

    def test_default_config_is_disabled(self):
        self.assertIsNone(load_policy(Path(__file__).resolve().parents[1]/'config/feedback-policy.json'))
        self.assertEqual(API(self.path,{'fixture-token-0':'fixture-owner-0'}).handle('GET',
            '/v1/foods/synthetic-food/storage-rules',{},'fixture-token-0')[1]['rules'],[])

    def test_minimum_qualifying_accounts_gate_publication(self):
        a=self.s.add(0,9); self.s.add(1,10)
        self.assertEqual(self.s.rules(),[])
        self.s.add(2,11)
        self.assertAlmostEqual(self.s.rules()[0]['days'],10)
        self.assertEqual(self.s.stats(a['group'])['qualifying_contributors'],3)

    def test_low_weight_outliers_do_not_satisfy_minimum(self):
        a=self.s.add(0,9); self.s.add(1,10); self.s.add(2,999)
        stats=self.s.stats(a['group'])
        self.assertEqual((stats['contributors'],stats['qualifying_contributors']),(3,2))
        self.assertEqual(self.s.rules(),[])

    def test_extreme_outlier_has_bounded_influence(self):
        a=self.normal()[0]
        outlier=self.s.add(3,1000000)
        self.assertLess(self.s.stats(a['group'])['mean'],10.2)
        self.assertEqual(self.s.feedback(outlier)['reasonCode'],'OUTLIER_DOWNWEIGHTED')

    def test_arithmetic_candidate_rejects_outliers(self):
        self.s=Sandbox(Path(self.temp.name)/'arithmetic.sqlite3',experimental_policy('arithmetic_mean'))
        a=self.normal()[0]; outlier=self.s.add(3,999)
        self.assertEqual(self.s.feedback(outlier)['state'],'rejected')
        self.assertEqual(self.s.stats(a['group'])['contributors'],3)
        self.assertAlmostEqual(self.s.stats(a['group'])['mean'],10)

    def test_repeat_owner_counts_once(self):
        for _ in range(20): a=self.s.add(0,10)
        self.assertEqual(self.s.stats(a['group'])['contributors'],1)
        self.assertEqual(self.s.rules(),[])

    def test_conditions_products_and_source_are_separate_groups(self):
        entries=[self.s.add(0,10),self.s.add(1,10,source='user_estimate'),
            self.s.add(2,10,storage='frozen'),self.s.add(3,10,form='cooked'),
            self.s.add(4,10,product_id='synthetic-product')]
        self.assertEqual(len({e['group'] for e in entries}),5)
        self.assertTrue(all(self.s.stats(e['group'])['contributors']==1 for e in entries))
        self.assertEqual(self.s.rules(),[])

    def test_withdraw_removes_contribution_and_publication(self):
        entries=self.normal(); a=entries[0]
        self.s.call(0,'DELETE',f"/v1/me/expiry-feedback/{a['feedback_id']}")
        self.assertEqual(self.s.rules(),[])
        stats=self.s.stats(a['group'])
        self.assertEqual(stats['contributors'],2)
        self.assertAlmostEqual(stats['mean'],10.5)
        self.assertEqual(self.s.call(0,'GET',f"/v1/me/items/{a['item_id']}")['overrideExpiryDate'],'2026-11-10')

    def test_item_edit_invalidates_old_contribution(self):
        a=self.normal()[0]
        self.s.call(0,'PATCH',f"/v1/me/items/{a['item_id']}/expiry",dict(expectedRevision=1,expiryDate='2026-11-30',source='user_estimate'))
        self.assertEqual(self.s.feedback(a)['state'],'superseded')
        self.assertEqual(self.s.stats(a['group'])['contributors'],2)
        self.assertEqual(self.s.rules(),[])

    def test_repeat_evaluate_does_not_double_count(self):
        a=self.s.add(0,10)
        with self.s.api.connect() as db:
            self.s.api.trust.evaluate(db,a['feedback_id']); self.s.api.trust.evaluate(db,a['feedback_id'])
        self.assertEqual(self.s.stats(a['group'])['contributors'],1)

    def test_unreviewed_or_unanchored_submission_is_held(self):
        a=self.s.add(0,10,reviewed=False)
        self.assertEqual(self.s.feedback(a)['state'],'held')
        b=self.s.add(1,10,reference=False)
        self.assertEqual(self.s.feedback(b)['reasonCode'],'REFERENCE_REQUIRED')
        self.assertIsNone(self.s.stats(a['group']))

    def test_package_label_cannot_become_opened_duration(self):
        a=self.s.add(0,10,basis='after_opening')
        self.assertEqual(self.s.feedback(a)['reasonCode'],'SOURCE_BASIS_MISMATCH')
        b=self.s.add(1,10,basis='after_opening',source='user_estimate')
        self.assertEqual(self.s.feedback(b)['state'],'accepted')

    def test_rollback_is_atomic(self):
        a=self.s.add(0,10,reviewed=False)
        with self.assertRaises(RuntimeError):
            with self.s.api.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                self.s.api.trust.review_mapping(db,a['feedback_id'],a['mapping'],'synthetic rollback')
                self.s.api.trust.set_reference(db,a['group'],10,'synthetic rollback anchor')
                self.s.api.trust.evaluate(db,a['feedback_id'])
                raise RuntimeError('simulated transaction failure')
        self.assertIsNone(self.s.stats(a['group']))
        self.assertEqual(self.s.feedback(a)['state'],'held')

    def test_changed_parameters_need_new_policy_version(self):
        policy=replace(self.s.api.trust.policy,minimum_contributors=5)
        with self.assertRaises(ValueError): API(self.path,{},policy)

    def test_policy_rebuild_withdraws_previous_publication(self):
        a=self.normal()[0]
        new_policy=replace(self.s.api.trust.policy,version='synthetic-v2',minimum_contributors=4)
        api=API(self.path,{'fixture-token-0':'fixture-owner-0'},new_policy)
        with api.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            api.trust.set_reference(db,a['group'],10,'new synthetic anchor')
            api.trust.rebuild(db)
            self.assertEqual(api.trust.public_rules(db,'synthetic-food'),[])
            self.assertEqual(api.trust.aggregate(db,a['group'])['contributors'],3)
            self.assertGreater(db.execute('SELECT count(*) FROM trust_events').fetchone()[0],3)

    def test_concurrent_reviews_preserve_unique_accounts(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            entries=list(pool.map(lambda owner:self.s.add(owner,10),range(4)))
        self.assertEqual(self.s.stats(entries[0]['group'])['contributors'],4)
        self.assertEqual(len(self.s.rules()),1)

    def test_public_rule_omits_owner_statistics(self):
        self.normal()
        rule=self.s.rules()[0]
        self.assertFalse({'owner','contributors','snapshot','sum_weight'} & set(rule))

    def test_all_withdrawals_reset_totals(self):
        entries=self.normal(); entries.append(self.s.add(3,999))
        for entry in entries:
            self.s.call(entry['owner'],'DELETE',f"/v1/me/expiry-feedback/{entry['feedback_id']}")
        stats=self.s.stats(entries[0]['group'])
        self.assertEqual((stats['contributors'],stats['sum_weight'],stats['sum_weighted_days']),(0,0,0))
        self.assertIsNone(stats['mean'])

    def test_condition_filters_and_food_only_product_safety(self):
        self.normal()
        for owner in (3,4,5): self.s.add(owner,10,product_id='specific-product')
        self.assertEqual(len(self.s.rules()),1) # No product ID: food-level rules only.
        path='/v1/foods/synthetic-food/storage-rules'
        self.assertEqual(len(self.s.call(0,'GET',path+'?productId=specific-product')['rules']),2)
        self.assertEqual(self.s.call(0,'GET',path+'?storage=frozen')['rules'],[])
        self.assertEqual(self.s.call(0,'GET',path+'?overrideSource=user_estimate')['rules'],[])
        status,_=self.s.api.handle('GET',path+'?opened=maybe',{},'fixture-token-0')
        self.assertEqual(status,422)


if __name__=='__main__': unittest.main()
