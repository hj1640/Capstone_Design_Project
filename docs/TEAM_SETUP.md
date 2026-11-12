> **D-051 현재 적용 안내:** 이 파일은 이전 검토/개발 실행 기록입니다. 최신 앱 연결·코드 등록·재시도·배포는 [APP_DEPLOYMENT.md](APP_DEPLOYMENT.md), 상세 결과는 [APP_INTEGRATION_REPORT.md](APP_INTEGRATION_REPORT.md)를 따릅니다. 과거 토큰 직접 입력 및 재시작 시 재입력 안내는 현재 화면과 다릅니다.

# 팀 실행·연결 안내 — D-050

이 문서는 현재 개인 평균 검토본용이다. 과거 0~8단계 안내보다 우선한다. 소스만 받은 경우 아래 준비가 필요하다. GitHub에 올라간 커밋은 설치된 APK를 자동 갱신하지 않는다.

## 1. 소스와 도구 준비

팀 저장소의 검토 브랜치 또는 제공된 전체 소스 ZIP을 사용한다. ZIP의 프로젝트 루트는 `package.json`이 있는 폴더다. `node_modules`, 개인 SQLite DB, 토큰, 실제 영수증은 옮기지 않는다.

필요 도구: Git, Node.js 24 계열(검사 버전은 결과표 참조), pnpm, Python 3.12. Python API 자체는 표준 라이브러리만 쓴다. 모델 실험은 별도 Python 패키지가 필요하다.

```powershell
pnpm install --frozen-lockfile
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-stage5.txt
pnpm model:prepare
pnpm model:prepare:fp32
.\.venv\Scripts\python.exe scripts/stage5_quantize.py
pnpm typecheck
pnpm lint
.\.venv\Scripts\python.exe scripts/verify_review.py
```

모델 준비는 고정 모델 파일의 해시를 확인하고 로컬 INT8를 생성한다. 큰 파일과 인터넷 다운로드가 필요하며 실패 시 임의 빈 파일로 대신하지 않는다. 패키지 잠금 파일을 지우거나 무작정 업그레이드하지 않는다. 위 검토 스크립트는 결과를 `benchmarks/REVIEW_RESULTS.md`와 JSON에 기록한다. 정확한 현재 PC 실행 결과는 저장된 보고서를 읽는다. 팀 PC에서 위 설치 전체를 새로 수행한 결과까지 검증됐다는 뜻은 아니다.

모델을 준비하기 전에도 서버/개인 평균의 PC 통합 검사만 먼저 할 수 있다:

```powershell
python -m unittest discover -s server -p "test_*.py" -v
python server/check_personal_flow.py
```

## 2. 개인 시험 서버 시작

두 사람을 시험하려면 서로 다른 개인 ID와 별도 무작위 토큰을 사용한다. 같은 토큰을 공유하면 서버는 같은 사람으로 본다. 토큰은 팀 채팅/커밋/PR에 넣지 않는다. 아래 문자열은 실제 토큰이 아닌 교체 위치다.

```powershell
$env:FRIDGE_DEV_TOKENS_JSON='{"여기에_충분히_긴_개인시험토큰":"team-member-a"}'
python server/dev_api.py --db .stage0-personal.sqlite3 --host 127.0.0.1 --port 8766
```

서버 창을 유지한다. 종료 후 같은 DB 파일과 같은 토큰→owner 매핑으로 다시 실행하면 통계가 남는다. `--policy-file`을 붙이지 않는다. 개인 평균은 기본 API에서 동작하며 구형 공용 정책 활성화가 필요 없다. `.sqlite3`, WAL/SHM 파일과 토큰 환경 파일은 공유하지 않는다.

USB 연결 Android 개발 단말에서 로컬 서버를 이용할 경우 Android 플랫폼 도구 설치 후 별도 창에서:

```powershell
adb reverse tcp:8766 tcp:8766
pnpm exec expo start --dev-client
```

앱 주소 입력은 `http://127.0.0.1:8766`. 이는 개발용 연결이며 APK의 HTTP 허용 설정/ADB 연결은 실제 단말에서 확인해야 한다. 연결 실패를 동기화 성공으로 간주하지 않는다. 이 검토에서는 단말 HTTP 허용 설정을 변경하거나 실제 연결하지 않았다. 공용 네트워크에 이 개발 서버를 노출해 운영 서버처럼 쓰지 않는다.

## 3. 앱 정상 사용 경로

1. ‘영수증·주문내역 등록’에서 지류/쿠팡을 선택하고 사진을 인식한다. 확인 화면에서 구매일(배송일 아님), 식품명, 구매 수량을 확인한다. 잘못된 품목은 제외하고 누락품은 직접 추가한다. 알 수 없는 수량 0은 수정해야 등록된다.
2. 냉장고 등록 후 품목 상세에서 포장지 소비기한과 보관 조건을 입력한다. 같은 식품끼리는 같은 이름으로 확인한다. ‘이 구매 건을 내 평균에 반영’을 켜고 저장한다.
3. 홈의 ‘내 구매 기록 평균·전송 상태’에서 서버 주소와 자신의 토큰을 입력하고 연결한다. 계정별·식품명별·보관 조건별 평균과 구매 건수를 확인한다.
4. 연결된 동안 날짜를 바꾸고 저장하면 전송을 시도한다. 전송 대기·오류·제외 사유는 평균 화면에서 확인한다. 오류/오프라인이면 다시 연결하거나 재시도한다.
5. 완전 종료 후 재실행하면 구매 기록/날짜/요청은 남고 토큰은 다시 입력한다. 같은 서버·계정만 연결할 수 있다. 단말별 로그인 전환/전체 서버 기록 내려받기는 아직 없다.
6. 평균 반영 끄고 저장 또는 평균 화면 철회 버튼으로 제외한다. 숨긴/소비 완료한 품목도 평균 화면에서 철회할 수 있다. 서버 전송 전에는 이전 평균이 남을 수 있다.

합성 수동 확인 예: 같은 식품·냉장, 구매일2026-11-01. 두 구매 건의 라벨 날짜를2026-11-11과2026-11-21로 입력하면15일/2건. 첫 날짜를2026-11-13으로 변경하면16일/2건. 둘째를 철회하면12일/1건. 이 숫자는 계산 확인용이고 해당 식품의 권장 소비기한이 아니다.

## 4. 기존 Expo 프로젝트와 새 APK

제공된 [팀 개발 APK 페이지](https://expo.dev/accounts/hj1640/projects/fridge-app/builds/ae1cdfc7-f4ef-4862-9024-4b00b5b70ac2)는 기준 연결 자료다. 이 APK가 이번 소스/Expo57/SQLite/ONNX 의존성을 포함한다는 근거는 확보하지 못했다.

정정: D-050 당시 `app.json`에는 기존 EAS `projectId`, owner, Android package가 없었다. `eas.json`은 존재했으며 없다는 이전 안내는 오류였다. D-051에서 실제 값 기반 동적 설정과 preview 프로필을 추가했다. 빌드 담당자가 기존 프로젝트의 실제 설정과 소스 커밋을 확인해야 한다. 임의의 새 앱 ID를 만들어 기존 앱이라고 배포하지 않는다.

설정 확인 후 팀의 기존 계정으로 개발 APK를 빌드하고 설치한 뒤 이 브랜치의 개발 서버에 연결한다. EAS 작업을 진행할 때 [공식 개발 빌드 안내](https://docs.expo.dev/develop/development-builds/create-a-build/)를 따른다. 이번 검토에서는 새 APK 생성/설치 또는 운영 서버 배포를 하지 않았다.

## 5. 실기기 인수 체크리스트 — 아직 미실행

검사한 Git SHA, APK URL, 기종/OS, 시험 시간, 서버 주소 종류와 결과를 기록한다. 토큰·영수증 원문은 결과 문서에 넣지 않는다.

- 지류 사진과 쿠팡 캡처 각각 실제 OCR→이름/구매일/수량 확인→등록.
- 포장지 날짜·보관 조건 저장, 홈에서 서버 연결, 평균/구매 건수 확인.
- 날짜 반복 수정, 두 사람이 각각 다른 토큰으로 같은 식품 입력, 서로의 통계에 영향 없음.
- 비행기 모드에서 수정→강제 종료→재실행→재연결→1회 반영.
- 서버가 처리한 직후 연결을 끊어 응답 유실→재시도→건수 불변.
- 반영 중/반영 후/품목 소비 완료 후 각각 철회, 서버 평균에서 기여 제거.
- 두 기기에서 같은 품목 revision 충돌 시 안내 확인. 전체 다중 기기 동기화가 있다는 뜻은 아님.
- 실제 포장지 날짜가 오늘/과거/미래인 표시 확인. 안전도 판단으로 오해하지 않는 문구인지 확인.
- 같은 영수증의 재등록·반품/취소 주문·여러 주문 혼합 화면은 자동 중복 제거/반품 처리가 없으므로 별도 결함/정책 항목으로 기록.

## 6. GitHub 공유와 적용

검토 브랜치를 올리고 `docs/PR_REVIEW.md`를 PR 본문으로 사용한다. source ZIP을 웹에 파일 하나로 올리는 방식은 코드 리뷰에 불편하므로, 가능하면 Git 브랜치/PR을 사용한다. 실제 push/PR 링크가 보고되지 않았다면 로컬 준비 상태다.

제공된 `.bundle`로부터 별도 폴더에 복원하는 예:

```powershell
git clone --branch codex/review-integration-2026-11-12 ./capstone-personal-review.bundle Capstone_Review
cd Capstone_Review
git remote rename origin review-bundle
git remote add origin https://github.com/hj1640/Capstone_Design_Project.git
git push -u origin codex/review-integration-2026-11-12
```

이 push는 저장소 쓰기 권한이 있는 팀원이 실행한다. 기존 팀 작업 폴더를 덮어쓰지 않고 별도 폴더에서 검토한다. 이 브랜치는 원격 main에 없는 기존 0~8단계도 포함한다. 최종 GitHub 비교는 main 대비 전체 변경으로 리뷰한다. 받은 뒤 원격 main이 바뀌었다면 먼저 병합/충돌을 검토해야 한다.
