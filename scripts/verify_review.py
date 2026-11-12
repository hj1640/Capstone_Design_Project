"""Reproducible D-050 review checks. PC integration is not Android/native acceptance."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
checks=[
 ('server_tests',[sys.executable,'-m','unittest','discover','-s','server','-p','test_*.py','-v']),
 ('personal_http_flow',[sys.executable,'server/check_personal_flow.py']),
 ('legacy_order_counterexample',[sys.executable,'server/check_legacy_counterexample.py']),
 ('stage2_token_parity',['node','scripts/stage2-parity.mjs']),
 ('stage3_catalog',['node','scripts/stage3-catalog-check.mjs']),
 ('stage4_metrics',[sys.executable,'-m','unittest','discover','-s','scripts','-p','test_stage4_metrics.py','-v']),
 ('stage5_semantic_parity',['node','scripts/stage5-semantic-check.mjs']),
 ('legacy_client_http',[sys.executable,'server/run_client_check.py']),
 ('legacy_trust_http',[sys.executable,'server/check_trust_http.py']),
 ('legacy_full_flow',[sys.executable,'server/check_full_flow.py']),
 ('date_boundaries',['node','scripts/stage8-date-check.mjs']),
 ('typecheck',['node','node_modules/typescript/bin/tsc','--noEmit']),
 ('lint',['node','node_modules/eslint/bin/eslint.js','.']),
 ('android_js_bundle',['node','node_modules/expo/bin/cli','export','--platform','android','--max-workers','2','--output-dir','.stage0-review-export']),
]
results=[]
env={**os.environ,'PYTHONUTF8':'1','EXPO_NO_TELEMETRY':'1','CI':'1'}
for name,command in checks:
    start=time.perf_counter()
    try:
        result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=300)
        passed=result.returncode==0
        detail=(result.stdout+'\n'+result.stderr)[-12000:]
    except (OSError,subprocess.TimeoutExpired) as error:
        passed=False;detail=str(error)
    results.append(dict(name=name,passed=passed,elapsed_seconds=round(time.perf_counter()-start,3),detail=detail))
    print(f"{'PASS' if passed else 'FAIL'}: {name}",flush=True)
sources=[]
for directory in ['src','server','scripts','config','models']:
    sources.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and p.suffix in ('.ts','.tsx','.mjs','.py','.json'))
sources.extend(ROOT/p for p in ['package.json','pnpm-lock.yaml','app.json','docs/project-contract.json'])
report=dict(timestamp=datetime.now(timezone.utc).isoformat(),platform=platform.platform(),machine=platform.machine(),
 python=platform.python_version(),node=subprocess.check_output(['node','--version'],text=True).strip(),
 source_sha256={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(sources)},
 passed=all(r['passed'] for r in results),checks=results,synthetic_fixtures=True,
 not_verified=['Actual paper/Coupang image OCR accuracy','Native Android UI/SQLite/restart and cleartext networking',
 'Real 1200/600 catalogue and food-duration ground truth','Production identity/HTTPS hosting/retention/backup',
 'Physical-device MiniLM latency and FP32/INT8 accuracy','Existing Expo APK source-commit compatibility'])
(ROOT/'benchmarks/review-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
summary=['# D-050 최종 검토 실행 결과','',f"UTC: {report['timestamp']}",
 f"환경: {report['platform']} / {report['machine']} / Python {report['python']} / Node {report['node']}",'',
 '데이터: 명시적 합성 예제. 모델 검사는 고정 MiniLM의 기존 PC 비교 파일을 사용하며 실제 기기 벤치마크가 아니다.','',
 '| 검사 | 결과 | 초 |','|---|---|---|']
summary.extend(f"| {r['name']} | {'PASS' if r['passed'] else 'FAIL'} | {r['elapsed_seconds']} |" for r in results)
summary+=['','전체 로그와 소스 SHA-256은 `review-verification.json` 참조. Android JS bundle 성공은 APK 빌드/설치 성공이 아니다.',
 '', '## 미검증', *['- '+entry for entry in report['not_verified']], '']
(ROOT/'benchmarks/REVIEW_RESULTS.md').write_text('\n'.join(summary),encoding='utf-8')
raise SystemExit(0 if report['passed'] else 1)
