"""Repository-only verification suite; no deployment or private workspace dependency."""
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
    ('stage2_token_parity',['node','scripts/stage2-parity.mjs']),
    ('stage3_catalog',['node','scripts/stage3-catalog-check.mjs']),
    ('stage4_metrics',[sys.executable,'-m','unittest','discover','-s','scripts','-p','test_stage4_metrics.py','-v']),
    ('stage5_semantic_parity',['node','scripts/stage5-semantic-check.mjs']),
    ('stage6_client_http',[sys.executable,'server/run_client_check.py']),
    ('stage7_trust_http',[sys.executable,'server/check_trust_http.py']),
    ('stage8_full_flow',[sys.executable,'server/check_full_flow.py']),
    ('stage8_purchase_eval',['node','scripts/stage8-purchase-eval.mjs']),
    ('stage8_date_boundaries',['node','scripts/stage8-date-check.mjs']),
    ('typecheck',['node','node_modules/typescript/bin/tsc','--noEmit']),
    ('lint',['node','node_modules/eslint/bin/eslint.js','.']),
    ('android_bundle',['node','node_modules/expo/bin/cli','export','--platform','android','--max-workers','2','--output-dir','.stage0-stage8-export']),
]
results=[]
env={**os.environ,'PYTHONUTF8':'1','EXPO_NO_TELEMETRY':'1'}
for name,command in checks:
    start=time.perf_counter()
    try:
        result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=240)
        passed=result.returncode==0
        detail=(result.stdout+'\n'+result.stderr)[-8000:]
    except (OSError,subprocess.TimeoutExpired) as error:
        passed=False;detail=str(error)
    results.append(dict(name=name,passed=passed,elapsed_seconds=time.perf_counter()-start,detail=detail))
    print(f"{'PASS' if passed else 'FAIL'}: {name}",flush=True)
sources=['src/services/ocr/onlineOrder.ts','src/services/registration.ts','src/services/feedback/store.ts',
         'server/trust_stats.py','server/dev_api.py','scripts/stage8-flow-check.mjs','src/utils/date.ts','src/utils/status.ts',
         'src/utils/recommend.ts','config/purchase-forecast.json']
report=dict(timestamp=datetime.now(timezone.utc).isoformat(),platform=platform.platform(),python=platform.python_version(),
    source_sha256={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sources},
    passed=all(r['passed'] for r in results),checks=results,
    not_verified=['Actual OCR image accuracy','Android native SQLite restart and network/UI flow',
        'Real product/duration data','Production authentication/hosting','Approved live trust policy',
        'Native PyTorch-to-ONNX export parity'])
(ROOT/'benchmarks/stage8-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
summary=['# 8단계 검증 결과','',f"UTC: {report['timestamp']}",f"환경: {report['platform']} / Python {report['python']}",'',
         '| 검사 | 결과 |','|---|---|']
summary.extend(f"| {r['name']} | {'PASS' if r['passed'] else 'FAIL'} |" for r in results)
summary+=['','합성 데이터와 PC 코드 검증이다. 실기기·실제 주문 평가 또는 운영 배포 완료를 의미하지 않는다.','']
(ROOT/'benchmarks/STAGE8_RESULTS.md').write_text('\n'.join(summary),encoding='utf-8')
raise SystemExit(0 if report['passed'] else 1)
