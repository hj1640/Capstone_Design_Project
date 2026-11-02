"""Synthetic engineering experiment only. Never selects a live policy or writes the app DB."""
from dataclasses import asdict
from datetime import datetime, timezone
import json
import hashlib
from pathlib import Path
import platform
import tempfile
import time
from synthetic_trust_fixture import Sandbox, experimental_policy

ROOT=Path(__file__).resolve().parents[1]
results=[]
start=time.perf_counter()
with tempfile.TemporaryDirectory() as folder:
    for method in ('arithmetic_mean','weighted_mean'):
        for minimum in (3,5):
            policy=experimental_policy(method,minimum,False,f'synthetic-{method}-N{minimum}')
            sandbox=Sandbox(Path(folder)/f'{policy.version}.sqlite3',policy)
            normal=[sandbox.add(i,value) for i,value in enumerate((9,10,11))]
            group=normal[0]['group']
            snapshots=dict(normal=sandbox.stats(group))
            sandbox.add(3,999)
            snapshots['one_outlier']=sandbox.stats(group)
            for _ in range(19): sandbox.add(3,999)
            snapshots['repeat_owner_20']=sandbox.stats(group)
            sandbox.call(0,'DELETE',f"/v1/me/expiry-feedback/{normal[0]['feedback_id']}")
            snapshots['after_withdraw']=sandbox.stats(group)
            with sandbox.api.connect() as db:
                audit_events=db.execute('SELECT count(*) FROM trust_events').fetchone()[0]
                raw_submissions=db.execute('SELECT count(*) FROM feedback').fetchone()[0]
            results.append(dict(policy=asdict(policy),snapshots=snapshots,raw_submission_count=raw_submissions,
                raw_mean_before_withdraw=(9+10+11+999*20)/23,public_rules=sandbox.rules(),audit_event_count=audit_events))
report=dict(timestamp=datetime.now(timezone.utc).isoformat(),python=platform.python_version(),platform=platform.platform(),
    elapsed_seconds=time.perf_counter()-start,synthetic=True,
    engine_sha256=hashlib.sha256((ROOT/'server/trust_stats.py').read_bytes()).hexdigest(),
    dataset='3 normal owners (9,10,11) + 1 outlier owner submitting 999 twenty times; reference anchor 10. All values synthetic.',
    caveats=['Not real expiry durations or approved policy constants.',
        'N counts qualifying accounts, not verified distinct people.',
        'Publication disabled in every experiment; eligible is an internal readiness preview.',
        'Each policy runs separately; no live combination of averaging methods.'],results=results)
(ROOT/'benchmarks/stage7-policy-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
lines=['# 7단계 합성 정책 비교','','모든 숫자는 검증용 합성값이며 실제 식품 소비기한이 아니다.',
    '정상 계정 3개(9,10,11), 다른 계정 하나가 999를 20번 제출. 최초 기준값 10.',
    '원자료 전체를 단순 평균하면 870.0이지만, 같은 계정의 중복·이상값 처리가 필요하다.','',
    '| 실험 방법 | 최소 정상 계정 | 반복 제출 후 평균 | 집계 계정 / 정상 계정 | 내부 배포 조건 충족 | 정상 1명 철회 후 |',
    '|---|---:|---:|---:|---|---|']
for row in results:
    stats=row['snapshots']['repeat_owner_20']; after=row['snapshots']['after_withdraw']; p=row['policy']
    lines.append(f"| {p['method']} | {p['minimum_contributors']} | {stats['mean']:.4f} | {stats['contributors']} / {stats['qualifying_contributors']} | {stats['eligible']} | eligible={after['eligible']} |")
lines+=['','모든 실험의 실제 공개 기능은 꺼져 있다. N/편차/가중치/평균 방식의 운영값은 미정이다.',
    '계정 수는 서로 다른 실제 사람 수를 보장하지 않는다. 실제 데이터와 악용 시나리오 검증이 더 필요하다.','']
(ROOT/'benchmarks/STAGE7_RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
print('\n'.join(lines))
