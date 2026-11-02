# 팀 실행·연결 안내

## 저장소 준비

Node.js **22.13.x 이상**과 npm, Git을 준비한다. Expo SDK 57의 최소 Node 요구는 [공식 SDK 57 문서](https://docs.expo.dev/versions/v57.0.0/) 기준이다. 이 점검 PC의 Node는 24.22.1이었다. 프로젝트 폴더는 OneDrive·한글·공백 문제를 피할 수 있는 경로를 권장한다(Notion의 환경 문제 기록).

```powershell
git clone https://github.com/hj1640/Capstone_Design_Project.git
cd Capstone_Design_Project
git rev-parse HEAD
node --version
npm --version
npm ci --ignore-scripts
node scripts/stage0-audit.mjs
npx --no-install tsc --noEmit
```

`npm ci` 실패 시 오류와 Node/npm 버전을 공유한다. lockfile 삭제, 임의 업그레이드, `--force`/`--legacy-peer-deps`로 기준을 바꾸지 않는다. 설치 스크립트를 비활성화한 설치와 네이티브 빌드 성공은 별개다. 필요한 설치 스크립트는 실제 오류를 확인한 후 검토한다.

진단:

```powershell
npx expo-doctor
npx expo install --check
```

저장소에 ESLint 설정·의존성이 없으므로 lint가 준비됐다고 가정하지 않는다. 설정을 자동 생성하는 제안은 별도 변경으로 검토하고 커밋한다.

## 제공된 개발 빌드와 연결

[팀 개발 빌드](https://expo.dev/accounts/hj1640/projects/fridge-app/builds/ae1cdfc7-f4ef-4862-9024-4b00b5b70ac2)를 가진 팀원은 먼저 빌드 페이지의 소스 커밋·생성 시각·플랫폼·profile을 확인한다. 현재 저장소의 커밋/네이티브 의존성과 맞는지 확인한 뒤 실행한다.

```powershell
npx expo start --dev-client
```

앱으로 터미널 QR/개발 서버 URL에 접속한다. 같은 접근 가능한 네트워크가 필요하며, 학교 AP 격리 문제가 있으면 Notion 기록처럼 휴대폰 핫스팟을 시험한다. 개발 서버가 PC에서 실행되는 동안에만 개발 세션을 사용할 수 있다.

**Expo Go에서는 ML Kit 검증이 불가**하다. 모의 결과가 보이는 것과 실제 OCR 성공을 구분한다. 네이티브 의존성 변경 후에는 맞는 개발 빌드를 새로 만들어야 한다. [Expo 개발 환경 안내](https://docs.expo.dev/get-started/set-up-your-environment/)

## EAS 재빌드 전 필요한 자료

현재 `app.json`에 `extra.eas.projectId`, owner, Android package가 없고 `eas.json`도 없다. 링크의 slug가 같다는 것만으로 같은 프로젝트 연결을 보장하지 않는다.

팀 빌드 담당자가 **기존 프로젝트**의 실제 projectId·owner·Android applicationId와 사용한 `eas.json`을 확인해 PR로 제공한다. 확인 전 새 EAS 프로젝트 생성이나 임의 package ID 설정을 하지 않는다. 자격증명·서명키·토큰은 Git에 올리지 않는다.

설정 확인 후에만 기존 팀 계정 권한으로 실행:

```powershell
npx eas-cli@latest project:info
npx eas-cli@latest build --profile development --platform android
```

새 빌드마다 Git 커밋, profile, URL, 생성 시각, 기기/OS, 실제 ML Kit 사용 여부와 확인 시나리오를 [VALIDATION.md](VALIDATION.md)에 추가한다. 로그인·설치·새 빌드 생성은 이번 0단계에서 수행하지 않았다.

## 공유 작업 방식

`main`에서 최신 코드를 받은 뒤 `codex/<작업명>` 또는 팀이 정한 브랜치에서 작업하고 PR로 공유한다. PR에는 변경 내용, D-ID, 실행 결과, 미완료 항목을 적는다. 처음부터 다른 앱을 만들지 말고 `src/services/ocr/`, `src/data/`, `src/types/`, `src/context/` 연결을 유지하며 단계별 변경을 한다.

공개 Git에는 소스·정의·익명화한 예제·재현 절차·평가 요약을 올린다. 주문 이미지·구매 이력·사용자 DB·개인 식별자·토큰·서명키는 올리지 않는다. 큰 모델은 체크섬과 다운로드 절차·고정 revision을 제공하고 실제 배포 위치는 모델 확보 후 정한다.

## 2단계 이후 설치 안내
현재는 pnpm-lock.yaml과 ESLint 설정이 추가되었다. 위 0단계의 npm ci 대신 pnpm install --frozen-lockfile 및 pnpm model:prepare를 사용한다. eas.json은 추가됐지만 기존 프로젝트 식별값은 여전히 필요하다. 자세한 절차는 STAGE_2_VALIDATION.md 참조.
