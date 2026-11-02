# 0단계 검증 기록

## 1단계 추가 검증 — 2026-11-02

`src/contracts/catalog-v1.ts` 및 합성 예제를 포함한 전체 TypeScript 검사가 오류 없이 완료됐다. 문서 상대 링크 검사, `git diff --check`, 기존 정책 감사 스크립트도 통과했다. 운영 미정 값은 null이고 예제 보관일수도 null이다. 예제의 개인 수정 날짜는 가상 입력이며 식품 권장기한이 아니다.

API 소유권·중복/동시성·철회·배포 시나리오는 [API 계약](STAGE_1_API.md)의 후속 인수 기준이며 실행 서버 테스트가 아니다. 기존 lint 설정 부재는 그대로다. 이번 단계는 타입/문서/예제만 추가하며 Android·모델·서버 실행을 완료했다고 주장하지 않는다.

실행일: **2026-10-30 (Asia/Seoul)**. 환경: Windows, Node **24.22.1**, 임시 npm CLI **10.9.4**. 코드 기준 SHA: `dc385df9babe8bad53064f16674e2019010c4965`. 음식 데이터는 기존 앱의 **16개 모의 항목**이다. 임베딩 모델 실행·정확도 측정은 이번 단계에서 하지 않았다.

| 항목 | 결과 | 범위 |
|---|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | 통과, 577 packages | pnpm dlx로 npm CLI 실행. 설치 스크립트 미실행. lockfile 변경 없음 |
| `npx --no-install tsc --noEmit`에 해당하는 로컬 tsc 실행 | 통과, exit 0 | 설치 완료 뒤 `node node_modules/typescript/bin/tsc --noEmit` 실행 |
| `node scripts/stage0-audit.mjs` | 통과 | [구조화된 결과](stage0-audit-2026-10-30.json). 의존성 없는 파일 감사 및 문서 정책 검사 |
| `node --check scripts/stage0-audit.mjs` | 통과 | 감사 스크립트 구문 검사 |
| `expo export --platform web --output-dir .stage0-web` | 통과, exit 0 | telemetry 비활성화·offline/CI 환경. Metro 808 modules, bundling 59,617ms. 웹 산출물 생성이며 브라우저 UI·Android OCR 검증 아님 |
| `expo lint` | 실행 불가 | 기존 ESLint 설정/의존성 없음. 자동 설치 시도는 npm PATH 부재로 실패. CLI가 추가한 devDependencies는 원복, package.json 원본 복구 |
| 실제 Android APK/ML Kit | 미검증 | 제공된 Expo 빌드와 Git SHA 연결 미확인 |
| 모델·ONNX·INT8·서버 수정 통계 | 미검증/미구현 | 팀 저장소에 실행 파일·기능이 없음 |

설치 중 `expo-modules-core`와 선택적 `react-native-worklets` peer dependency 경고가 있었다. 강제 버전 변경으로 숨기지 않았으며 네이티브 실행 사전 검증 때 확인한다. `expo-doctor`·전체 네이티브 호환성 검사를 완료했다고 주장하지 않는다.

설치가 끝나기 전에 먼저 실행한 tsc는 `react-native` 타입 부재 오류가 있었다. 설치 완료 뒤 재실행은 통과했다. 최종 결과와 설치 도중의 불완전 상태를 구분한다.

별도 인수인계 폴더의 `scripts/validate_handoff.py`와 Python 테스트 **42개**는 통과했다(14.844초). 제한 환경에서 임시 폴더·loopback 접근 오류가 있어 별도 임시 테스트 데이터로 일반 권한에서 재실행했다. **그 Python 코드는 이 팀 앱에 포함되지 않으므로 Expo 앱의 테스트 통과 수로 합산하지 않는다.**

## 공유 상태

GitHub 연결의 저장소 메타데이터에는 push=true가 표시됐으나 실제 브랜치 생성은 **403 `Resource not accessible by integration`**으로 거부됐다. 로컬 Git dry-run push도 로그인 정보가 없어 실패했다. 원격 브랜치·PR·main 변경은 이루어지지 않았다.

이를 해결하려면 팀 저장소를 연결한 GitHub 앱의 repository contents 쓰기 권한과 PR 권한을 확인하거나, 권한 있는 조원이 제공된 패치/소스를 자신의 인증된 Git으로 push한다. 패치에는 현재 앱 동작 변경 없이 문서·감사 도구·공개 데이터 제외 규칙만 포함된다.

자료 대조와 공유 패키지는 준비됐지만 **GitHub 게시 및 기존 개발 빌드 재현까지 완료된 상태는 아니다.**

## 2단계 구현 검증 — 2026-11-02 (D-043)
- Python ORT CPU 합성 입력 8개: 모두 384D 유한 벡터. 원시 측정: benchmarks/reference.json.
- Python/JS 토큰 비교 8/8, masked pooling 및 오류 경계 검사 통과.
- tsc --noEmit 통과. ESLint 오류 0, 경고 2 (기존 unused radius, Metro asset require).
- Expo Android export 성공: 1,320 modules, Hermes bundle 약 14MB, ONNX asset 약 118MB. APK 빌드/실기기 실행을 뜻하지 않음.
- 루트 handoff validator 및 unittest 42개 통과. Windows sandbox의 임시 파일 접근 실패 후 정상 권한에서 재검증.
- RN ORT 네이티브 빌드/기기 추론, 메모리, FP32 비교 미검증. 기기 결과를 만든 적 없음.
- 네이티브 의존성 설치 중 Expo CLI 후처리 오류가 있었으나 새 프로세스에서 TypeScript/Android export를 완료. ONNX config plugin 명시 추가.

## 3단계 구현 검증 — 2026-11-02 (D-044)
- 합성 상품 7개 / 식품 5개. 검색·모호성·ID 무결성·미검토 매핑·서비스 격리 검사 20개 통과. benchmarks/stage3-checks.json에 사례와 환경 기록.
- TypeScript 통과. ESLint 오류 0 / 기존 경고 2.
- Android Metro export 성공 (1,324 modules). APK 빌드 및 기기 실행은 미실행.
- 실제 상품 목록·원본 XLSX·온라인 주문 평가셋은 미확보. 정확도/실기기 속도를 주장하지 않음.

## 4단계 비교 검증 — 2026-11-02 (D-045)
- Python ONNX INT8 실제 실행, 합성 입력 25개. 등록 상품 test 12개에서 Jaccard Top-1 12/12, MiniLM 5/12, Top-3 12/12 대 10/12.
- 지표 집계 테스트 4개 / 기존 카탈로그 회귀 검사 20개 통과. TypeScript 통과, lint 오류 0 / 기존 경고 2.
- 캐시 재사용 실행 확인. 미등록·모호 사례는 known 정확도 분모에서 제외, 임계값 미정으로 MiniLM 자동 승인 없음.
- 실제 상품 평가·모바일 성능·FP32 비교 미실행. 원시 기록 benchmarks/stage4-report.json.

## 5단계 구현 검증 — 2026-11-02 (D-046)
- FP32/upstream INT8/local MatMul+Gather INT8/local MatMul-only INT8, 총 4종 실제 ONNX CPU 비교. 동일 합성 25개 입력/상품 색인.
- Python/TypeScript 의미 검색 Top-3 25개 일치 및 모델·카탈로그·벡터 검증 통과.
- TypeScript 통과. ESLint 오류 0/경고 3. Android Metro export 성공(1,330 modules, 모델 asset 2개).
- 초기 sandbox 임시 경로 제한 후 정상 권한에서 양자화/비교 실행. ORT 전처리 권고 경고 기록.
- PyTorch export/실기기/실제 상품 통합 미검증. 원시 실측 benchmarks/stage5-report.json.

## 6단계 검증 — 2026-11-02 (D-047)
- 서버 테스트 13개 통과. SQLite 소유권·날짜·동시 중복·멱등성·revision·철회·재연결 검사.
- loopback 실제 HTTP + TypeScript 영속 대기열 통합 통과. 14개 시나리오 benchmarks/stage6-client-checks.json 참조. Native SQLite가 아닌 파일 adapter로 재시작 검증.
- TypeScript 통과, lint 오류 0/기존 경고 3. Android Metro export 성공(1,373 modules).
- 최초 수정 동의 전 비전송, Retry-After와 의존 순서, 응답 유실 후 철회, 충돌 재요청 확인.
- 실기기 저장/네트워크 및 운영 인증/배포 미검증. N/평균/이상값/공개 기본값 비활성 유지.
- 루트 handoff validator 및 기존 unittest 42개도 통과.

## 7단계 검증 — 2026-11-02 (D-048)
- 서버/API/신뢰도 테스트 32개 통과. 반복 사용자·동시성·그룹 분리·저가중치 N 제외·철회·공개 철회·정책 버전/재평가·트랜잭션 rollback 확인.
- 별도 임시 합성 DB에서 실제 HTTP 공개 규칙 조회/조건 필터/철회 검사 통과. benchmarks/stage7-http-checks.json 참조.
- 6단계 실제 HTTP outbox 회귀, TypeScript, ESLint 오류 0/기존 경고 3 통과. 앱 코드 변경 없이 서버 기능 추가.
- 정책 4개를 각각 독립 임시 DB에서 비교. benchmarks/stage7-policy-report.json에 합성값·환경·시각·엔진 해시 기록.
- 기본 config/feedback-policy.json disabled 및 OPEN 숫자 null 유지. 실제 식품/기간 자료·운영 정책 승인·공개 배포는 미완료.
