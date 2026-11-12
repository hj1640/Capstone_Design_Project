"""D-050: owner-scoped descriptive means of package-label days after purchase."""
from datetime import date
import json
import re
import unicodedata


def schema(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS personal_records(
            owner TEXT, item_id TEXT, revision INTEGER NOT NULL, data TEXT NOT NULL,
            group_key TEXT, days INTEGER, PRIMARY KEY(owner,item_id));
        CREATE TABLE IF NOT EXISTS personal_totals(
            owner TEXT, group_key TEXT, count INTEGER NOT NULL, total_days INTEGER NOT NULL,
            PRIMARY KEY(owner,group_key));
    ''')


def normalize_name(name):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', name).strip()).lower()


def validate(data, calendar, error):
    required = {'foodName', 'purchaseDate', 'expiryDate', 'storage', 'opened', 'active', 'source'}
    if not isinstance(data, dict) or set(data) != required:
        raise error(422, 'INVALID_PERSONAL_FIELDS')
    if not isinstance(data['foodName'], str) or not 1 <= len(normalize_name(data['foodName'])) <= 200:
        raise error(422, 'INVALID_FOOD_NAME')
    calendar(data['purchaseDate'], nullable=False)
    calendar(data['expiryDate'])
    if data['storage'] not in ('냉장', '냉동', '실온', '미정'):
        raise error(422, 'INVALID_STORAGE')
    if type(data['opened']) is not bool or type(data['active']) is not bool:
        raise error(422, 'INVALID_PERSONAL_FLAGS')
    if data['source'] not in ('package_label', None):
        raise error(422, 'PACKAGE_LABEL_REQUIRED')
    if (data['expiryDate'] is None) != (data['source'] is None):
        raise error(422, 'INVALID_SOURCE')


def contribution(data):
    # Eligibility uses observable fields, never an unvalidated statistical cutoff.
    if not data['active']:
        return None, None, 'WITHDRAWN'
    if data['expiryDate'] is None:
        return None, None, 'LABEL_REQUIRED'
    if data['opened']:
        return None, None, 'UNOPENED_LABEL_ONLY'
    if data['storage'] == '미정':
        return None, None, 'STORAGE_REQUIRED'
    days = (date.fromisoformat(data['expiryDate']) - date.fromisoformat(data['purchaseDate'])).days
    if days < 0:
        return None, None, 'EXPIRY_BEFORE_PURCHASE'
    group = json.dumps([normalize_name(data['foodName']), data['storage']], ensure_ascii=False)
    return group, days, 'INCLUDED'


def update(db, owner, item_id, expected, data, error):
    old = db.execute('SELECT * FROM personal_records WHERE owner=? AND item_id=?', (owner, item_id)).fetchone()
    revision = old['revision'] if old else 0
    if expected != revision:
        raise error(409, 'REVISION_CONFLICT')
    group, days, reason = contribution(data)
    # The surrounding API transaction covers replacement, aggregates and idempotency.
    if old and old['group_key'] is not None:
        db.execute('UPDATE personal_totals SET count=count-1,total_days=total_days-? WHERE owner=? AND group_key=?',
                   (old['days'], owner, old['group_key']))
    if group is not None:
        db.execute('''INSERT INTO personal_totals VALUES(?,?,1,?)
            ON CONFLICT(owner,group_key) DO UPDATE SET count=count+1,total_days=total_days+excluded.total_days''',
                   (owner, group, days))
    db.execute('DELETE FROM personal_totals WHERE owner=? AND count=0', (owner,))
    db.execute('''INSERT INTO personal_records VALUES(?,?,?,?,?,?)
        ON CONFLICT(owner,item_id) DO UPDATE SET revision=excluded.revision,data=excluded.data,
        group_key=excluded.group_key,days=excluded.days''',
               (owner, item_id, revision + 1, json.dumps(data, ensure_ascii=False), group, days))
    return dict(revision=revision + 1, reason=reason)


def summaries(db, owner):
    result = []
    for row in db.execute('SELECT * FROM personal_totals WHERE owner=? ORDER BY group_key', (owner,)):
        name, storage = json.loads(row['group_key'])
        result.append(dict(foodName=name, storage=storage, count=row['count'],
                           totalDays=row['total_days'], meanDays=row['total_days'] / row['count']))
    return result
