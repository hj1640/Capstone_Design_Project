# 새 Expo 프로젝트에서 별도 앱 만들기 — D-052

2026-11-12 사용자 승인: “일단 2번으로 만들어봐”. 기존 GitHub 소스를 그대로 이어 새 Expo 프로젝트에 연결한다. 기존 `hj1640/fridge-app`을 변경하거나 빈 앱으로 교체하는 작업이 아니다.

## 현재 상태

- 별도 앱 구성: 이름 `스마트 냉장고 개인판`, slug `fridge-app-personal`, 링크 scheme `fridgepersonal`.
- **Expo 프로젝트 실제 생성 완료:** [juuuuuuun/fridge-app-personal](https://expo.dev/accounts/juuuuuuun/projects/fridge-app-personal).
- 실제 projectId: `6899818e-50b4-41b0-8fae-e4f27ac65566`. 공식 CLI가 `status: created`를 반환했다.
- 새 Android package: `com.capstoneteam7.fridge.personal6899818e`. 기존 앱과 별도로 설치할 새 식별자이며 기존 APK의 식별자를 추측한 값이 아니다.
- 계정 로그인과 프로젝트 생성은 완료했다. 로그인 파일·비밀번호·토큰은 Git에 넣지 않는다. 공개 앱 식별자는 `config/expo-project.json`에 기록했다.
- 새 APK 성공 여부는 Expo 빌드 결과와 실제 설치 결과로 판단한다. 설정/JS 번들만으로 APK가 만들어졌다고 말하지 않는다.

## 앱은 어디까지 작동하는가

같은 소스를 빌드하므로 지류/쿠팡 OCR 화면, 구매 확인·등록, 기기 내 구매 기록 보관, 포장지 날짜 수정 경로를 이어 사용한다. 실제 기기의 ML Kit/SQLite/ONNX 작동은 APK 설치 후 확인해야 한다.

현재 별도 서버가 없으므로 먼저 **`preview-local`** 프로필로 독립 실행 시험 APK를 만든다. 개발 PC의 Metro 없이 실행할 수 있도록 `developmentClient: false`인 preview 설정을 상속한다. 이 프로필에 한해서 서버 주소 없이 빌드할 수 있다.

서버 미연결 상태에서는 구매와 날짜가 기기에 저장되고 전송 대기 요청이 보관된다. **서버 개인 평균 갱신은 아직 작동하지 않는다.** 가짜 서버나 임의 평균으로 대신하지 않는다. 평균 화면에서 실제 HTTPS 서버 주소와 개인 연결 코드를 등록하면 기존 전송·재시도 경로가 이어진다. 서버 구축은 별도 작업이며 [APP_DEPLOYMENT](APP_DEPLOYMENT.md)의 서버 절차를 따른다.

실제 서버를 미리 넣는 연결형 `preview`는 서버 주소·상태 확인을 계속 요구한다. 로컬 프로필에서도 잘못된 주소를 입력하면 거부한다.

## 생성·빌드 순서

1. 본인 계정으로 로그인한다.
2. 현재 계정 이름을 확인하고 새 프로젝트를 생성한다. 실제 프로젝트 ID를 읽어 `config/expo-project.json`에 넣는다. 같은 파일에 새 앱용 Android package를 기록한다.
3. 프로젝트 정보의 owner/slug/ID를 다시 조회하여 연결을 확인한다.
4. 모델 준비와 새 프로젝트 설정 검사를 수행한다.
5. `pnpm build:preview:local`로 Android APK를 만든다. 새 앱의 서명키는 새 Expo 프로젝트의 관리 자격 증명을 사용한다.
6. 생성된 APK 링크에서 설치하고 [실기기 인수표](../benchmarks/DEVICE_ACCEPTANCE_TEMPLATE.md)를 실행한다.

명령은 `package.json`이 있는 폴더에서 실행한다.

```powershell
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest whoami
# 아래 계정명은 실제 로그인 계정으로 교체한다.
pnpm dlx eas-cli@latest project:init --account 실제계정명 --json --non-interactive
# 반환된 프로젝트 ID와 소유자를 config/expo-project.json에 기록한 후:
pnpm dlx eas-cli@latest project:info
pnpm test:project-config
pnpm build:preview:local
```

동적 `app.config.js` 때문에 CLI가 자동 설정 쓰기를 완료하지 못할 수 있다. 이 경우 프로젝트가 이미 생성됐는지 출력된 ID와 URL부터 확인하고 재생성하지 않는다. 확인된 ID를 구성 파일에 기록하여 이어 연결한다.

원격 EAS 환경의 기존 `FRIDGE_*` 변수가 파일의 값을 덮어쓰지 않는지 확인한다. 프로젝트 ID/소유자/package는 공개 앱 식별자이며 비밀키가 아니다. 서버 주소는 선택한 빌드 방식에 맞춰 설정한다. 구체적인 서명키나 개인 연결 코드는 공개 설정에 넣지 않는다.

## 나중에 팀원의 기존 Expo 프로젝트와 이어 쓰려면

기능 코드는 같은 Git 저장소의 브랜치/PR로 합칠 수 있다. 새 프로젝트용 `config/expo-project.json`, 앱 이름·scheme·package는 배포 설정이므로, 기존 앱을 업데이트할 때는 담당자가 기존 프로젝트 식별자·서명으로 설정해야 한다. 두 Expo 프로젝트 자체를 하나로 자동 합치는 작업은 아니다.

새 앱과 기존 앱의 기기 내 데이터는 분리된다. 새 앱을 기존 앱 위에 강제로 설치하거나 기존 앱을 먼저 삭제하지 않는다. 두 앱의 구매 기록 자동 병합/가져오기 기능은 현재 없다. 실제 서버를 함께 쓰려면 개인 owner와 연결 코드·중복 구매 처리도 확인해야 한다.

## 공유와 검증

기존 GitHub 업로드 구성에 새 프로젝트 설정·이 문서·검사 스크립트를 포함한다. 로그인 파일/토큰·서명키·개인 DB·모델 바이너리는 제외한다. D-051 패키지는 이전 스냅샷이고, D-052 이후 소스로 빌드해야 새 프로젝트 설정이 반영된다.

현재 실제 클라우드 생성/빌드 상태는 `config/expo-project.json`, `docs/project-contract.json` 및 최종 전달 기록을 확인한다. 프로젝트 생성 완료와 APK 빌드·실기기 설치 완료는 별도로 판단한다.

## 빌드 설치 기준

D-052: `pnpm install --frozen-lockfile`을 사용한다. `package-lock.json`을 추가하지 않는다. 두 잠금 파일 공존으로 첫 클라우드 빌드의 `npm ci`가 실제 실패했기 때문이다. 로컬·CI·EAS는 pnpm 11.25.0, EAS Node는 검증 환경과 같은 24.22.1로 고정한다. EAS의 버전 지정은 [공식 설정 문서](https://docs.expo.dev/eas/json/#common-properties-for-native-platforms)를 따른다.
