"""Local operator tool; never called from the untrusted mobile API."""
import argparse
import json
from dev_api import API
from trust_stats import load_policy

parser=argparse.ArgumentParser()
parser.add_argument('--db',required=True)
parser.add_argument('--policy-file',required=True)
parser.add_argument('--review-file',help='feedbackId, mapping, provenance, referenceDays, referenceProvenance')
parser.add_argument('--rebuild',action='store_true')
args=parser.parse_args()
api=API(args.db,{},load_policy(args.policy_file))
with api.connect() as db:
    db.execute('BEGIN IMMEDIATE')
    if args.review_file:
        with open(args.review_file,encoding='utf-8-sig') as stream: review=json.load(stream)
        row=db.execute('SELECT * FROM feedback WHERE id=?',(review['feedbackId'],)).fetchone()
        if not row: raise ValueError('Unknown feedback')
        api.trust.review_mapping(db,row['id'],review['mapping'],review['provenance'])
        item=json.loads(row['snapshot'])['item']
        group=api.trust.group(item,review['mapping'],row['basis'])
        api.trust.set_reference(db,group,review['referenceDays'],review['referenceProvenance'])
        api.trust.evaluate(db,row['id'])
    if args.rebuild: api.trust.rebuild(db)
print('Local review completed. No personal snapshots printed.')
