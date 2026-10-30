# 0단계 검증 기록

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
