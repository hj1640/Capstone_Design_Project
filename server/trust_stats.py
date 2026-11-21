"""D-048: configurable review/aggregation engine. No production policy defaults."""
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
import json
import math
import uuid


def encoded(value):
    return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False)


@dataclass(frozen=True)
class Policy:
    version: str
    method: str
    minimum_contributors: int
    relative_deviation: float
    outlier_weight: float
    contributor_rule: str
    publication_enabled: bool
    approval_reference: str | None

    def __post_init__(self):
        if not isinstance(self.version,str) or not self.version.strip() or self.method not in ('arithmetic_mean','weighted_mean'):
            raise ValueError('Explicit version/method required')
        if type(self.minimum_contributors) is not int or self.minimum_contributors<1:
            raise ValueError('Explicit positive minimum required')
        if type(self.relative_deviation) not in (int,float) or not math.isfinite(self.relative_deviation) or self.relative_deviation<=0:
            raise ValueError('Explicit positive deviation required')
        if type(self.outlier_weight) not in (int,float) or not math.isfinite(self.outlier_weight) or not 0<=self.outlier_weight<=1:
            raise ValueError('Invalid outlier weight')
        if self.method=='arithmetic_mean' and self.outlier_weight!=0:
            raise ValueError('Arithmetic candidate rejects outliers; weighted method required for fractional weights')
        if self.contributor_rule!='latest_eligible_per_owner_group':
            raise ValueError('Contributor selection must be explicit')
        if type(self.publication_enabled) is not bool or (self.publication_enabled and
            (not isinstance(self.approval_reference,str) or not self.approval_reference.strip())):
            raise ValueError('Publishing requires explicit approval provenance')


def load_policy(path):
    with open(path,encoding='utf-8-sig') as stream:
        config=json.load(stream)
    if config.get('enabled') is not True:
        return None
    return Policy(**config['policy'])


class TrustStats:
    def __init__(self,policy=None):
        self.policy=policy

    def schema(self,db):
        db.executescript('''
        CREATE TABLE IF NOT EXISTS trust_policies(version TEXT PRIMARY KEY, config TEXT);
        CREATE TABLE IF NOT EXISTS mapping_reviews(feedback_id TEXT PRIMARY KEY, data TEXT, provenance TEXT);
        CREATE TABLE IF NOT EXISTS group_references(group_key TEXT, policy_version TEXT, days REAL, provenance TEXT,
          PRIMARY KEY(group_key,policy_version));
        CREATE TABLE IF NOT EXISTS contributions(feedback_id TEXT PRIMARY KEY, owner TEXT, group_key TEXT,
          value REAL, weight REAL, qualifying INTEGER, active INTEGER, policy_version TEXT);
        CREATE UNIQUE INDEX IF NOT EXISTS one_owner_group ON contributions(owner,group_key) WHERE active=1;
        CREATE INDEX IF NOT EXISTS contributions_group ON contributions(group_key,active);
        CREATE TABLE IF NOT EXISTS aggregates(group_key TEXT PRIMARY KEY, sum_weight REAL, sum_weighted_days REAL,
          contributors INTEGER, qualifying_contributors INTEGER, revision INTEGER, policy_version TEXT);
        CREATE TABLE IF NOT EXISTS publications(id TEXT PRIMARY KEY, group_key TEXT, revision INTEGER,
          days REAL, status TEXT, policy_version TEXT, snapshot TEXT, created TEXT, reason TEXT);
        CREATE INDEX IF NOT EXISTS published_groups ON publications(group_key,status);
        CREATE TABLE IF NOT EXISTS trust_events(id INTEGER PRIMARY KEY AUTOINCREMENT, feedback_id TEXT,
          group_key TEXT, event TEXT, policy_version TEXT, detail TEXT, created TEXT);
        ''')
        if self.policy:
            config=encoded(asdict(self.policy))
            old=db.execute('SELECT config FROM trust_policies WHERE version=?',(self.policy.version,)).fetchone()
            if old and old['config']!=config:
                raise ValueError('Changed parameters require a NEW policy version')
            db.execute('INSERT OR IGNORE INTO trust_policies VALUES(?,?)',(self.policy.version,config))
        if not self.policy or not self.policy.publication_enabled:
            db.execute("UPDATE publications SET status='withdrawn',reason='POLICY_DISABLED' WHERE status='published'")
        else:
            db.execute("UPDATE publications SET status='withdrawn',reason='POLICY_CHANGED' WHERE status='published' AND policy_version<>?",(self.policy.version,))

    def event(self,db,feedback_id,group,event,detail):
        db.execute('INSERT INTO trust_events(feedback_id,group_key,event,policy_version,detail,created) VALUES(?,?,?,?,?,?)',
            (feedback_id,group,event,self.policy.version if self.policy else None,encoded(detail),datetime.now(timezone.utc).isoformat()))

    @staticmethod
    def group(item,mapping,basis):
        return encoded(dict(foodId=mapping['foodId'],productId=mapping['productId'],
            storage=mapping['storage'],opened=mapping['opened'],productForm=mapping['productForm'],
            basis=basis,source=item['overrideSource']))

    def review_mapping(self,db,feedback_id,mapping,provenance):
        required={'foodId','productId','storage','opened','productForm'}
        if set(mapping)!=required or not isinstance(mapping['foodId'],str) or not mapping['foodId']:
            raise ValueError('Invalid reviewed food mapping')
        if not (mapping['productId'] is None or isinstance(mapping['productId'],str)):
            raise ValueError('Invalid product ID')
        if mapping['storage'] not in ('room','refrigerated','frozen') or type(mapping['opened']) is not bool:
            raise ValueError('Invalid reviewed conditions')
        if not isinstance(mapping['productForm'],str) or not mapping['productForm'] or not provenance:
            raise ValueError('Review provenance/form required')
        if not db.execute('SELECT 1 FROM feedback WHERE id=?',(feedback_id,)).fetchone():
            raise ValueError('Unknown feedback')
        old=db.execute('SELECT data,provenance FROM mapping_reviews WHERE feedback_id=?',(feedback_id,)).fetchone()
        data=encoded(mapping)
        if old:
            if old['data']!=data or old['provenance']!=provenance:
                raise ValueError('Existing mapping review is immutable; use a new reviewed submission')
            return
        db.execute('INSERT INTO mapping_reviews VALUES(?,?,?)',(feedback_id,data,provenance))
        self.event(db,feedback_id,None,'mapping_reviewed',dict(provenance=provenance))

    def set_reference(self,db,group,days,provenance):
        if not self.policy: raise ValueError('Explicit policy version required')
        if type(days) not in (int,float) or not math.isfinite(days) or days<=0 or not provenance:
            raise ValueError('Reviewed positive reference and provenance required')
        old=db.execute('SELECT * FROM group_references WHERE group_key=? AND policy_version=?',(group,self.policy.version)).fetchone()
        if old and (old['days']!=days or old['provenance']!=provenance):
            raise ValueError('Reference is immutable; new group/review version required')
        db.execute('INSERT OR IGNORE INTO group_references VALUES(?,?,?,?)',(group,self.policy.version,days,provenance))

    def aggregate(self,db,group):
        row=db.execute('SELECT * FROM aggregates WHERE group_key=?',(group,)).fetchone()
        if not row:
            return None
        value=dict(row)
        value['mean']=row['sum_weighted_days']/row['sum_weight'] if row['contributors'] and row['sum_weight']>0 else None
        value['eligible']=bool(self.policy and row['policy_version']==self.policy.version and
            row['qualifying_contributors']>=self.policy.minimum_contributors and value['mean'] is not None)
        return value

    def publish(self,db,group):
        stats=self.aggregate(db,group)
        previous=db.execute("SELECT * FROM publications WHERE group_key=? AND status='published'",(group,)).fetchall()
        for row in previous:
            db.execute("UPDATE publications SET status='withdrawn',reason='REPLACED_OR_INELIGIBLE' WHERE id=?",(row['id'],))
        if not stats or not stats['eligible'] or not self.policy.publication_enabled:
            if previous: self.event(db,None,group,'publication_withdrawn',stats or {})
            return
        publication_id=str(uuid.uuid4())
        db.execute('INSERT INTO publications VALUES(?,?,?,?,?,?,?,?,?)',(publication_id,group,stats['revision'],stats['mean'],
            'published',self.policy.version,encoded(stats),datetime.now(timezone.utc).isoformat(),'ELIGIBLE_APPROVED_POLICY'))
        self.event(db,None,group,'published',dict(publicationId=publication_id,revision=stats['revision']))

    def deactivate(self,db,feedback_id,reason):
        row=db.execute('SELECT * FROM contributions WHERE feedback_id=? AND active=1',(feedback_id,)).fetchone()
        if not row: return
        db.execute('UPDATE contributions SET active=0 WHERE feedback_id=?',(feedback_id,))
        db.execute('''UPDATE aggregates SET sum_weight=sum_weight-?,sum_weighted_days=sum_weighted_days-?,
          contributors=contributors-1,qualifying_contributors=qualifying_contributors-?,revision=revision+1 WHERE group_key=?''',
          (row['weight'],row['weight']*row['value'],row['qualifying'],row['group_key']))
        db.execute('''UPDATE aggregates SET sum_weight=0,sum_weighted_days=0,qualifying_contributors=0
          WHERE group_key=? AND contributors=0''',(row['group_key'],))
        self.event(db,feedback_id,row['group_key'],'contribution_removed',dict(reason=reason))
        self.publish(db,row['group_key'])

    def invalidate_item(self,db,owner,item_id):
        rows=db.execute("SELECT id FROM feedback WHERE owner=? AND item=? AND state NOT IN ('withdrawn','superseded')",(owner,item_id)).fetchall()
        for row in rows: self.deactivate(db,row['id'],'ITEM_EDITED')

    def hold(self,db,feedback_id,reason,state='held'):
        db.execute('UPDATE feedback SET state=?,reason=? WHERE id=?',(state,reason,feedback_id))
        self.event(db,feedback_id,None,state,dict(reason=reason))

    def evaluate(self,db,feedback_id):
        row=db.execute('SELECT * FROM feedback WHERE id=?',(feedback_id,)).fetchone()
        if not row or row['state'] in ('withdrawn','superseded'): return
        if not self.policy:
            self.hold(db,feedback_id,'POLICY_NOT_CONFIGURED'); return
        existing=db.execute('SELECT * FROM contributions WHERE feedback_id=?',(feedback_id,)).fetchone()
        if existing and existing['active'] and existing['policy_version']==self.policy.version: return
        mapping=db.execute('SELECT * FROM mapping_reviews WHERE feedback_id=?',(feedback_id,)).fetchone()
        if not mapping:
            self.hold(db,feedback_id,'MAPPING_REVIEW_REQUIRED'); return
        mapping=json.loads(mapping['data'])
        snapshot=json.loads(row['snapshot']); item=snapshot['item']
        base=item['purchaseDate'] if row['basis']=='purchase_remaining' else item['openedDate']
        if not base:
            self.hold(db,feedback_id,'MISSING_BASE_DATE'); return
        if row['basis']=='after_opening' and (not mapping['opened'] or item['overrideSource']=='package_label'):
            self.hold(db,feedback_id,'SOURCE_BASIS_MISMATCH'); return
        value=(date.fromisoformat(item['overrideExpiryDate'])-date.fromisoformat(base)).days
        if value<0:
            self.hold(db,feedback_id,'INVALID_DATE_ORDER'); return
        group=self.group(item,mapping,row['basis'])
        reference=db.execute('SELECT * FROM group_references WHERE group_key=? AND policy_version=?',(group,self.policy.version)).fetchone()
        if not reference:
            self.hold(db,feedback_id,'REFERENCE_REQUIRED'); return
        stats=self.aggregate(db,group)
        if stats and stats['policy_version']!=self.policy.version:
            self.hold(db,feedback_id,'POLICY_REBUILD_REQUIRED'); return
        previous=db.execute('SELECT * FROM contributions WHERE owner=? AND group_key=? AND active=1',(row['owner'],group)).fetchone()
        # Exclude this owner's old value from its own trust baseline.
        sum_w=stats['sum_weight'] if stats else 0
        sum_x=stats['sum_weighted_days'] if stats else 0
        if previous:
            sum_w-=previous['weight']; sum_x-=previous['weight']*previous['value']
        center=sum_x/sum_w if sum_w>0 else reference['days']
        limit=reference['days']*self.policy.relative_deviation
        deviation=abs(value-center)
        inlier=deviation<=limit
        weight=1.0 if inlier else (self.policy.outlier_weight*limit/deviation)
        if weight<=0:
            self.hold(db,feedback_id,'OUTLIER_REJECTED','rejected'); return
        if previous:
            self.deactivate(db,previous['feedback_id'],'OWNER_REPLACED')
            db.execute("UPDATE feedback SET state='superseded',reason='OWNER_REPLACED' WHERE id=?",(previous['feedback_id'],))
        db.execute('INSERT OR REPLACE INTO contributions VALUES(?,?,?,?,?,?,1,?)',
            (feedback_id,row['owner'],group,value,weight,int(inlier),self.policy.version))
        db.execute('INSERT OR IGNORE INTO aggregates VALUES(?,0,0,0,0,0,?)',(group,self.policy.version))
        db.execute('''UPDATE aggregates SET sum_weight=sum_weight+?,sum_weighted_days=sum_weighted_days+?,
          contributors=contributors+1,qualifying_contributors=qualifying_contributors+?,revision=revision+1 WHERE group_key=?''',
          (weight,weight*value,int(inlier),group))
        reason='INLIER' if inlier else 'OUTLIER_DOWNWEIGHTED'
        db.execute("UPDATE feedback SET state='accepted',reason=? WHERE id=?",(reason,feedback_id))
        self.event(db,feedback_id,group,'accepted',dict(value=value,center=center,weight=weight,qualifying=inlier))
        self.publish(db,group)

    def rebuild(self,db):
        if not self.policy: raise ValueError('Explicit policy required')
        db.execute("UPDATE publications SET status='withdrawn',reason='POLICY_REBUILD' WHERE status='published'")
        db.execute('UPDATE contributions SET active=0')
        db.execute('DELETE FROM aggregates')
        self.event(db,None,None,'policy_rebuild',{})
        rows=db.execute("SELECT id FROM feedback WHERE state NOT IN ('withdrawn','superseded') ORDER BY created,id").fetchall()
        for row in rows: self.evaluate(db,row['id'])

    def public_rules(self,db,food_id):
        if not self.policy or not self.policy.publication_enabled: return []
        rows=db.execute("SELECT * FROM publications WHERE status='published' AND policy_version=?",(self.policy.version,)).fetchall()
        rules=[]
        for row in rows:
            group=json.loads(row['group_key'])
            if group['foodId']!=food_id: continue
            rules.append(dict(ruleId=row['id'],revision=row['revision'],foodId=food_id,productId=group['productId'],
                conditions=dict(storage=group['storage'],opened=group['opened'],productForm=group['productForm']),
                basis=group['basis'],overrideSource=group['source'],days=row['days'],origin='community',
                status='published',policyVersion=row['policy_version'],source='community user-reported dates; mapping reviewed'))
        return rules
