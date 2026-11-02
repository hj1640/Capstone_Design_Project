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
