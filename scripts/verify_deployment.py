"""D-051 measured PC checks. Never equate JS export / loopback HTTP with an installed APK / HTTPS deployment."""
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
 ('server_regressions',[sys.executable,'-m','unittest','discover','-s','server','-p','test_*.py','-v']),
 ('personal_http_flow',[sys.executable,'server/check_personal_flow.py']),
 ('service_http_restart',[sys.executable,'server/check_service_flow.py']),
 ('foreground_retry_controller',['node','scripts/sync-controller-check.mjs']),
 ('secure_storage_failures',['node','scripts/session-state-check.mjs']),
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
 ('native_peer_versions',['pnpm.cmd' if os.name=='nt' else 'pnpm','peers','check']),
 ('expo_sdk_versions',['node','node_modules/expo/bin/cli','install','--check']),
 ('expo_native_config',['node','node_modules/expo/bin/cli','config','--type','prebuild','--json']),
 ('android_js_bundle',['node','node_modules/expo/bin/cli','export','--platform','android','--max-workers','2','--output-dir','.stage0-deployment-export']),
]
results=[]
env={**os.environ,'PYTHONUTF8':'1','EXPO_NO_TELEMETRY':'1','CI':'1'}
selected=set(sys.argv[1:])
previous={}
if selected:
    unknown=selected-{name for name,_ in checks}
    if unknown: raise SystemExit('Unknown checks: '+','.join(sorted(unknown)))
    prior=json.loads((ROOT/'benchmarks/deployment-verification.json').read_text(encoding='utf-8'))
    previous={entry['name']:{**entry,'verified_at':entry.get('verified_at',prior['timestamp'])} for entry in prior['checks']}
for name,command in checks:
    if selected and name not in selected and name in previous:
        results.append(previous[name])
        continue
    started=time.perf_counter()
    try:
        result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=300)
        passed=result.returncode==0
        detail=(result.stdout+'\n'+result.stderr)[-12000:]
    except (OSError,subprocess.TimeoutExpired) as error:
        passed=False;detail=str(error)
    results.append(dict(name=name,passed=passed,elapsed_seconds=round(time.perf_counter()-started,3),detail=detail,
                        verified_at=datetime.now(timezone.utc).isoformat()))
    print(f"{'PASS' if passed else 'FAIL'}: {name}",flush=True)
    if not passed: print(detail[-3000:],flush=True)
sources=[]
for directory in ['src','server','scripts','config','models','deploy','.github']:
    sources.extend(p for p in (ROOT/directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
sources.extend(ROOT/p for p in ['package.json','pnpm-lock.yaml','app.json','app.config.js','eas.json','requirements-service.txt','docs/project-contract.json'])
report=dict(timestamp=datetime.now(timezone.utc).isoformat(),platform=platform.platform(),machine=platform.machine(),
 python=platform.python_version(),node=subprocess.check_output(['node','--version'],text=True).strip(),
 source_sha256={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(set(sources))},
 passed=all(r['passed'] for r in results),checks=results,synthetic_fixtures=True,
 verification_mode='selected_checks_rerun_others_retained' if selected else 'full',
 not_verified=['Real paper/Coupang image OCR accuracy','Physical Android UI/SecureStore/SQLite and process death',
 'Docker image/Compose and public DNS/TLS hosting','Existing Expo project identity, signing credentials, APK build/install',
 'Real 1200/600 catalogue, FoodKeeper duration labels, physical-device model benchmarks',
 'Public-service load/security audit and final retention policy'])
(ROOT/'benchmarks/deployment-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# D-051 앱·서버 연결 검사 실행 결과','',f"UTC: {report['timestamp']}",
 f"환경: {report['platform']} / {report['machine']} / Python {report['python']} / Node {report['node']}",'',
 '데이터는 합성 예제. 실제 Waitress 프로세스·HTTP·SQLite와 앱 순수 로직을 실행했다. 네이티브 SecureStore는 파일 어댑터로 대체했다.','',
 '| 검사 | 결과 | 초 |','|---|---|---|']
lines.extend(f"| {r['name']} | {'PASS' if r['passed'] else 'FAIL'} | {r['elapsed_seconds']} |" for r in results)
lines+=['','전체 로그·검사별 실행 시각·소스 SHA-256: `deployment-verification.json`. JS bundle 성공은 APK 성공이 아니다.',
 '선택 실행 시 이전 검사를 보존하고 변경 관련 검사만 다시 실행한다. 각 검사의 verified_at을 확인한다.','',
 '## 미검증',*['- '+entry for entry in report['not_verified']],'']
(ROOT/'benchmarks/DEPLOYMENT_RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
raise SystemExit(0 if report['passed'] else 1)
