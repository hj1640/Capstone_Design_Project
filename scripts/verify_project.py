"""D-052 checks changed app identity/local APK path; does not create/build an Expo project."""
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
commands=[
 ('new_project_configuration',['node','scripts/project-config-check.mjs']),
 ('decision_contract',[sys.executable,'-m','unittest','discover','-s','server','-p','test_project_contract.py','-v']),
 ('service_http_regression',[sys.executable,'server/check_service_flow.py']),
 ('typecheck',['node','node_modules/typescript/bin/tsc','--noEmit']),
 ('lint',['node','node_modules/eslint/bin/eslint.js','.']),
 ('expo_native_configuration',['node','node_modules/expo/bin/cli','config','--type','prebuild','--json']),
 ('android_js_bundle',['node','node_modules/expo/bin/cli','export','--platform','android','--max-workers','2','--output-dir','.stage0-new-expo-export']),
]
results=[]
for name,command in commands:
    start=time.perf_counter()
    try:
        result=subprocess.run(command,cwd=ROOT,env={**os.environ,'CI':'1','EXPO_NO_TELEMETRY':'1','PYTHONUTF8':'1'},
          capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=300)
        passed=result.returncode==0;detail=(result.stdout+'\n'+result.stderr)[-12000:]
    except (OSError,subprocess.TimeoutExpired) as error:
        passed=False;detail=str(error)
    results.append(dict(name=name,passed=passed,elapsed_seconds=round(time.perf_counter()-start,3),detail=detail))
    print(f"{'PASS' if passed else 'FAIL'}: {name}",flush=True)
    if not passed:print(detail[-2000:],flush=True)
files=['app.config.js','app.json','eas.json','config/expo-project.json','config/deployment.cjs','package.json','pnpm-lock.yaml',
 'scripts/project-config-check.mjs','scripts/build-preview.mjs','scripts/check-deployment.mjs','scripts/verify_project.py',
 'server/test_project_contract.py','src/app/feedback-sync.tsx','docs/project-contract.json']
report=dict(decision='D-052',timestamp=datetime.now(timezone.utc).isoformat(),platform=platform.platform(),
 python=platform.python_version(),node=subprocess.check_output(['node','--version'],text=True).strip(),
 passed=all(r['passed'] for r in results),checks=results,synthetic_fixtures=True,
 source_sha256={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in files},
 not_verified=['Expo project creation without user login','Android cloud APK build and signing','Physical device installation and native behavior','Public statistics server hosting'])
(ROOT/'benchmarks/new-expo-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
lines=['# D-052 새 Expo 프로젝트 설정 검사','',f"UTC: {report['timestamp']}",
 f"환경: {report['platform']} / Python {report['python']} / Node {report['node']}",'',
 '| 검사 | 결과 | 초 |','|---|---|---|']
lines += [f"| {r['name']} | {'PASS' if r['passed'] else 'FAIL'} | {r['elapsed_seconds']} |" for r in results]
lines += ['','실제 Expo 생성/클라우드 APK 성공을 뜻하지 않는다. 합성 식별자·실제 HTTP 회귀·JS 번들 검사이다.',
 '실제 클라우드 상태는 config/expo-project.json과 docs/project-contract.json을 확인한다.','',
 '전체 로그·소스 해시: new-expo-verification.json.','']
(ROOT/'benchmarks/NEW_EXPO_RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
raise SystemExit(0 if report['passed'] else 1)
