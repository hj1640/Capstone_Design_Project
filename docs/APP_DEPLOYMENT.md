# 기존 Expo 앱에 적용하는 실행 안내 — D-051

이 문서의 프로젝트 루트는 `package.json`이 있는 폴더다. 사용자 최종 확인: 기존 Expo에 로그인할 계정 없이 URL만 있고, 별도 서버도 없다. **GitHub는 소스 공유, Expo는 APK 생성·배포, 별도 서버는 개인 평균 저장**을 담당한다. 세 서비스가 자동 연결되는 것은 아니다.

새 Expo 프로젝트에도 같은 소스를 빌드하면 팀원이 만든 기능은 이어진다. 다만 새 식별자/서명으로 만든 별도 앱은 기존 설치 앱 업데이트와 로컬 데이터 자동 이전을 보장하지 않는다. 아래는 기존 프로젝트 접근 권한을 확보하는 경로이며, 새 프로젝트를 선택하면 owner/projectId/package를 그 실제 프로젝트에 맞추는 별도 변경이 필요하다. 현재 값을 임의로 만들어 둔 상태가 아니다.

## 1. 팀이 정해야 할 실제 배포 정보

| 항목 | 필요한 실제 값 | 확인 위치 |
|---|---|---|
| Expo 계정 | `hj1640/fridge-app`에 접근 가능한 계정 | 기존 빌드 페이지 / Expo 로그인 |
| EAS projectId | 기존 프로젝트 UUID | Expo 프로젝트 설정 또는 로그인 후 기존 빌드 정보 |
| Android package | 기존 APK의 application identifier | 기존 빌드 정보·원래 앱 설정·빌드 담당자 |
| 서명키 | 기존 앱 업데이트에 사용한 동일 키 | EAS 기존 자격 증명. 공개 저장소로 복사하지 않음 |
| 서버 | 영구 저장소와 Docker Compose를 쓸 수 있는 호스트 | 팀이 새로 마련. 비용/계정/관리 담당 결정 필요 |
| API 도메인 | 해당 서버를 가리키는 실제 DNS 이름 | 팀 도메인 설정. `example.com` 같은 예시는 빌드 거부 |

원래 빌드 링크의 `ae1cdfc7-...`는 **build ID**이지 projectId가 아니다. 그 값을 projectId 자리에 넣지 않는다. 주소에 있는 `hj1640/fridge-app`만으로 Android package를 추정하지 않는다.

## 2. 소스 설치와 PC 검사

GitHub 검토 브랜치 또는 전달된 소스 ZIP을 새 폴더에 받는다. 기존 팀원 작업을 덮어쓰지 않는다. 검증 환경은 Node 24, pnpm 11.25.0, Python 3.12이며 세부 버전은 실행 보고서 참조.

```powershell
pnpm install --frozen-lockfile
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-service.txt
.\.venv\Scripts\python.exe -m unittest discover -s server -p "test_*.py" -v
.\.venv\Scripts\python.exe server/check_personal_flow.py
.\.venv\Scripts\python.exe server/check_service_flow.py
pnpm test:sync
pnpm typecheck
pnpm lint
```

전체 모델 비교와 Android JS 번들까지 확인하려면 다음 준비가 추가로 필요하다. 모델 다운로드는 크며 인터넷 연결이 필요하다. 실제 전체 식품 DB를 받는 명령은 아니다.

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-stage5.txt
pnpm model:prepare
pnpm model:prepare:fp32
.\.venv\Scripts\python.exe scripts/stage5_quantize.py
.\.venv\Scripts\python.exe scripts/verify_deployment.py
```

## 3. 개인 평균 서버 배포 — 서버 담당자

아래는 **Docker가 설치된 별도 Linux 서버**에서 실행한다. 이 PC에서 실제 실행한 컨테이너 배포가 아니므로 서버 담당자가 로그·HTTPS·재시작을 검증해야 한다. VPS 계정/도메인 구매·비용 지출은 자동 수행하지 않았다. 호스팅 업체는 아직 선택하지 않았다.

1. 서버에 검토한 커밋의 저장소를 받는다.
2. 도메인의 DNS를 서버로 연결하고 80/443 접근을 설정한다. API 내부 포트 8766은 외부 공개하지 않는다.
3. 실제 도메인을 환경 변수로 넣고 실행한다. 아래 `<실제 도메인>`은 그대로 실행할 값이 아니다.

```bash
export FRIDGE_DOMAIN='<실제 도메인>'
docker compose -f deploy/compose.yaml config
docker compose -f deploy/compose.yaml up -d --build
docker compose -f deploy/compose.yaml ps
curl --fail "https://$FRIDGE_DOMAIN/healthz"
```

기대 응답: `status=ok`, `api=personal-v1`, `mode=service`. HTTPS 인증서 발급에는 실제 DNS와 접근 가능한 포트가 필요하다. 앱은 배포용에서 평문 HTTP 주소를 받지 않는다. 공개 URL이 없는데 임의의 URL을 소스에 적어도 연결되지 않는다.

SQLite는 `fridge-data` 볼륨에 저장된다. `docker compose down -v`를 실행하면 DB 볼륨까지 삭제할 수 있으므로 운영 중 사용하지 않는다. 서버 재시작 후 동일 통계 조회를 확인한다. 단일 서버/단일 SQLite 구성이고 다중 API 복제를 지원한다고 주장하지 않는다.

### 개인별 연결 코드 발급

```bash
docker compose -f deploy/compose.yaml exec api python server/manage_service.py invite --label member-a --output /private/member-a.json
```

서버 내부 `/private/member-a.json`에는 ownerId와 enrollmentCode가 있다. 서버 관리자가 안전한 개인 전달 경로로 해당 사용자에게 **enrollmentCode만** 전달한다. 공개 PR/팀 단체 채팅/스크린샷에 넣지 않는다. 파일 내용은 명령 로그에 자동 출력하지 않는다. 팀원마다 따로 발급한다.

만료·기기 변경 때는 처음 받은 ownerId를 사용해 같은 계정 코드를 재발급한다. owner를 빼고 발급하면 새 계정이 되어 이전 통계와 분리된다.

```bash
docker compose -f deploy/compose.yaml exec api python server/manage_service.py invite --label member-a --owner '<기존 ownerId>' --output /private/member-a-renewal.json
```

기본 연결 코드 유효기간은 24시간, 세션은 30일이다. 세션 기간은 API 환경 변수 `FRIDGE_SESSION_DAYS`로 조정 가능하며 식품 통계 기준과 무관하다. 첫 버전은 운영자 발급 계정 방식이며 일반 공개 회원가입 화면은 없다.

### 백업·복원

```bash
docker compose -f deploy/compose.yaml exec api python server/manage_service.py backup --output /private/backup-YYYYMMDD.sqlite3
```

이 명령은 실행 중 SQLite의 일관된 백업과 무결성 검사를 한다. 대상 이름이 존재하면 덮어쓰지 않는다. 서버의 `/private` 볼륨만으로 장애 대비가 끝나는 것은 아니므로 접근 통제된 별도 저장소로 복사한다. 백업에는 개인 기록과 인증 해시가 있어 공개 저장소에 올리지 않는다.

복원은 API를 중지한 뒤 기존 DB를 별도 보존하고, 검증한 백업을 `/data/fridge.sqlite3`에 배치해 소유권을 uid 10001로 맞춘 후 실행한다. 실제 운영 파일을 대상으로 한 자동 덮어쓰기 명령은 제공하지 않는다. 별도 시험 볼륨에서 복구한 통계·계정·철회를 먼저 확인한다. 코드 업데이트 시에도 먼저 백업한다.

## 4. 기존 Expo 설정 확인 — 앱 담당자

프로젝트 폴더의 PowerShell에서 본인이 직접 로그인한다. 비밀번호나 Expo 토큰을 채팅·소스·문서에 넣지 않는다.

```powershell
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest whoami
pnpm dlx eas-cli@latest build:view ae1cdfc7-f4ef-4862-9024-4b00b5b70ac2 --json
```

빌드 응답과 프로젝트 설정에서 projectId/package를 대조한다. 기존 프로젝트에 대한 접근 권한이 없으면 소유자에게 초대받아야 한다. 새 프로젝트를 만들어 문제를 우회하지 않는다.

`.env.example`을 `.env`로 복사하여 아래 세 실제 값을 채운다. `.env`는 Git에 올리지 않는다. 세 값은 공개 앱 설정이며 개인 연결 코드가 아니다.

```dotenv
FRIDGE_EAS_PROJECT_ID=기존_프로젝트_UUID
FRIDGE_ANDROID_PACKAGE=기존_Android_package
EXPO_PUBLIC_API_URL=https://실제_API_도메인
```

Expo 프로젝트의 **preview 환경 변수**에도 같은 이름과 값을 설정한다. 빌드 설정을 해석할 때 필요한 값이므로 EAS secret 가시성에 숨기지 말고 일반 공개 설정으로 등록한다. 개인 토큰/연결 코드는 절대로 `EXPO_PUBLIC_*`로 등록하지 않는다. `.env`는 EAS 업로드에서 제외하므로 로컬 파일만 만들고 원격 환경 설정을 생략하면 빌드가 실패할 수 있다.

```powershell
pnpm dlx eas-cli@latest project:info
pnpm check:deployment
pnpm build:preview
```

`project:info`가 `hj1640/fridge-app`의 실제 ID를 가리키는지 확인한다. `check:deployment`는 설정 형식·실제 HTTPS 상태 응답·모델 준비를 검사한다. 형식 검사는 프로젝트 소유권 검증을 대신하지 않는다. `build:preview`는 검사 후 기존 EAS 계정으로 **새 내부 배포 APK**를 요청한다. 빌드 대기열/사용량/비용은 계정 플랜에 따른다.

`preview`는 개발 PC의 Metro 서버 없이 실행할 APK다. 기존 `development` 프로필은 개발 도구용으로 유지한다. SecureStore 등 네이티브 구성이 바뀌었으므로 과거 APK에 JS 파일만 올린 것으로 적용됐다고 판단하면 안 된다. EAS Update 설정도 이번 작업에서 새로 활성화하지 않는다.

## 5. APK 설치와 정상 사용

1. 빌드 성공 페이지의 새 APK를 휴대폰에 설치한다. 기존 앱을 업데이트하려면 package와 서명이 같아야 한다. 충돌한다고 기존 앱부터 삭제하지 말고, 로컬 구매 기록 보존과 서명을 확인한다.
2. 홈의 ‘내 구매 기록 평균·전송 상태’에서 개인 연결 코드를 등록한다. 빌드에 서버 주소가 들어 있으면 주소를 사용자가 다시 입력하지 않는다.
3. 지류 영수증 또는 쿠팡 주문내역을 선택해 인식한다. 구매일·식품명·수량을 확인하고 등록한다.
4. 품목 상세에서 포장지 날짜·보관 조건을 입력하고 ‘이 구매 건을 내 평균에 반영’을 켠다.
5. 평균 화면의 완료/전송 대기/제외/충돌 상태와 평균·건수를 확인한다.
6. 오프라인 수정은 로컬에 남는다. 연결이 돌아오고 앱이 전경에 있을 때 재시도한다. 완전 종료 중 전송한다고 약속하지 않는다.
7. 철회는 ‘평균 반영 철회’를 누른다. ‘이 기기 서버 연결 해제’는 로그인 해제이며 평균 철회가 아니다.

## 6. 실제 휴대폰 인수 — 반드시 결과 기록

`benchmarks/DEVICE_ACCEPTANCE_TEMPLATE.md`를 복사하여 커밋·APK URL·기종·Android 버전·서버 배포 버전을 적는다. 개인정보/코드를 포함한 사진은 공개하지 않는다.

- 지류와 쿠팡 실제 이미지 각각 OCR→검토→등록이 되는지.
- 같은 식품 두 구매의 10/20일 합성 관측이 15일/2건, 12/20일 수정 후 16일/2건, 둘째 철회 후 12일/1건인지.
- 앱 강제 종료·재실행 후 기록·연결이 유지되는지.
- 비행기 모드 수정 후 앱 재시작·연결 복구 시 한 번만 반영되는지.
- 다른 계정이 같은 식품을 입력해도 통계가 섞이지 않는지.
- 서버 재시작 후 같은 통계, 충돌 안내, 소비 완료로 숨긴 품목의 철회가 되는지.
- 실제 네이티브 OCR, SQLite, SecureStore, ONNX 런타임이 정상인지.

PC 검사만 통과하고 이 목록을 실행하지 않았다면 ‘실기기 인수 전’으로 표시한다.

## 7. 공식 참고 문서

- [Expo SDK 57 SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/): 기기 보안 저장소와 백업 관련 제약.
- [Expo 내부 배포](https://docs.expo.dev/build/internal-distribution/): 내부 배포 APK 사용.
- [EAS 환경 변수](https://docs.expo.dev/eas/environment-variables/): 로컬·원격 빌드 설정 구분.
- [Waitress](https://docs.pylonsproject.org/projects/waitress/en/latest/): WSGI 서버 실행.
- [Caddy 자동 HTTPS](https://caddyserver.com/docs/automatic-https): DNS·인증서 발급 조건.

컨테이너 태그 `python:3.12-slim`, `caddy:2`는 배포 시 받아오는 이미지다. 실제 배포한 digest·날짜를 운영 기록에 남기고 검증 없이 무조건 자동 갱신하지 않는다.
