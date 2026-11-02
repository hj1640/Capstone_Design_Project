"""Synthetic test/simulation helper. Values are not food storage references."""
from datetime import date, timedelta
import json
import uuid
from dev_api import API, CONSENT
from trust_stats import Policy


def experimental_policy(method='weighted_mean',minimum=3,publish=False,version='synthetic-v1'):
    return Policy(version=version,method=method,minimum_contributors=minimum,relative_deviation=0.5,
        outlier_weight=0.1 if method=='weighted_mean' else 0,contributor_rule='latest_eligible_per_owner_group',
        publication_enabled=publish,approval_reference='SYNTHETIC TEST ONLY' if publish else None)


class Sandbox:
    def __init__(self,path,policy):
        self.api=API(path,{f'fixture-token-{i}':f'fixture-owner-{i}' for i in range(30)},policy)

    def call(self,owner,method,path,body=None):
        status,response=self.api.handle(method,path,body or {},f'fixture-token-{owner}',str(uuid.uuid4()))
        if status>=400: raise AssertionError((status,response))
        return response

    def add(self,owner,days,source='package_label',storage='refrigerated',form='fresh',product_id=None,
            basis='purchase_remaining',reviewed=True,reference=True):
        item_id=str(uuid.uuid4())
        item=dict(itemId=item_id,foodId=None,productId=None,purchaseDate='2026-11-01',
            openedDate='2026-11-01' if basis=='after_opening' else None,conditions=None,
            suggestedExpiryDate=None,overrideExpiryDate=(date(2026,11,1)+timedelta(days=days)).isoformat(),
            overrideSource=source,ruleSnapshot=None,revision=1)
        self.call(owner,'PUT',f'/v1/me/items/{item_id}',dict(item=item,expectedRevision=0))
        receipt=self.call(owner,'POST','/v1/me/expiry-feedback',dict(itemId=item_id,itemRevision=1,
            consentVersion=CONSENT,basis=basis))
        mapping=dict(foodId='synthetic-food',productId=product_id,storage=storage,
            opened=basis=='after_opening',productForm=form)
        group=self.api.trust.group(item,mapping,basis)
        if reviewed and self.api.trust.policy:
            with self.api.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                self.api.trust.review_mapping(db,receipt['feedbackId'],mapping,'synthetic mapping fixture')
                if reference:
                    self.api.trust.set_reference(db,group,10,'SYNTHETIC numeric anchor; not food guidance')
                self.api.trust.evaluate(db,receipt['feedbackId'])
        return dict(feedback_id=receipt['feedbackId'],item_id=item_id,group=group,owner=owner,mapping=mapping)

    def stats(self,group):
        with self.api.connect() as db: return self.api.trust.aggregate(db,group)

    def feedback(self,entry):
        return self.call(entry['owner'],'GET',f"/v1/me/expiry-feedback/{entry['feedback_id']}")

    def rules(self):
        return self.call(0,'GET','/v1/foods/synthetic-food/storage-rules')['rules']
