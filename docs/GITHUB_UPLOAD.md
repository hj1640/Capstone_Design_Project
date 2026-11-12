# GitHub에 올릴 것과 올리는 방법

대상 저장소: https://github.com/hj1640/Capstone_Design_Project

최신 검토 브랜치: `codex/new-expo-project-2026-11-12` (D-052 새 Expo 별도 앱). 이전 D-051 브랜치는 `codex/app-deployment-2026-11-12`다. 원격 업로드 여부는 실제 링크/커밋을 확인한다. 이 문서를 만든 것만으로 push를 완료한 것은 아니다. 아래 명령의 브랜치를 최신 브랜치로 사용한다.

## 올릴 단위

`package.json`이 있는 이 저장소의 추적 파일 전체를 올린다. 변경된 몇 개의 화면 파일만 복사하면 서버·의존성·설정·문서가 빠진다. 상위 `Capstone Design` 폴더의 다른 시제품을 이 저장소에 합치지 않는다.

함께 올라가야 할 파일은 다음과 같다.

- `src/`: 앱 화면, OCR 파서, 구매 저장, 날짜 수정, 개인 평균 연결/재시도.
- `server/`: 개인 통계, 서비스 API, 코드 발급/백업, 자동 검사.
- `scripts/`, `config/`, `models/` manifest, 합성 fixture: 실행·검사·모델 재현 설정.
- `app.json`, `app.config.js`, `eas.json`, `package.json`, `pnpm-lock.yaml`, `requirements-*.txt`, `.env.example`.
- `deploy/`, `.dockerignore`, `.github/workflows/`: 서버 및 CI 구성.
- `docs/`, 검토된 `benchmarks/`, `README.md`: 결정·실행·팀 공유·검증 기록.

`.env`, `.secrets`, 개인 DB/백업, 실제 영수증, 토큰·키, `node_modules`, `.venv`, `.stage0*`, 모델 바이너리, APK는 업로드 대상이 아니다. 제공 ZIP은 소스를 복원하기 위한 것이며 ZIP 자체 하나를 GitHub 소스 대신 올리는 것을 권장하지 않는다.

## 이 작업 폴더에서 올릴 경우

현재 작업이 모두 검토·커밋된 뒤 다음 push를 사용한다. 기존 main에 직접 push하거나 강제로 덮어쓰지 않는다.

```powershell
git status --short
git log -1 --oneline
git push -u origin codex/new-expo-project-2026-11-12
```

쓰기 권한 오류면 저장소 소유자가 해당 GitHub 계정에 권한을 부여하거나 권한 있는 팀원이 같은 브랜치를 올린다. Expo 로그인과 GitHub 쓰기 권한은 별개다.

## 전달된 Git bundle에서 올릴 경우

bundle에는 소스 이력이 들어 있다. 별도 새 폴더에서 복원한다.

```powershell
git clone --branch codex/new-expo-project-2026-11-12 ./capstone-new-expo.bundle Capstone_App_Integration
cd Capstone_App_Integration
git remote rename origin delivery-bundle
git remote add origin https://github.com/hj1640/Capstone_Design_Project.git
git push -u origin codex/new-expo-project-2026-11-12
```

원격 main이 이후 바뀌었다면 먼저 `git fetch origin`으로 받아 차이를 검토한다. 아직 편집 중인 팀원의 파일을 덮어쓰는 파일 복사 방식은 피한다.

## PR 만들기

- base: `main`
- compare: `codex/new-expo-project-2026-11-12`
- 제목: `feat: 포장지 소비기한 개인 평균과 앱·서버 재전송 및 배포 경로 연결`
- 본문: `docs/PR_APP_INTEGRATION.md`에 `docs/PR_NEW_EXPO.md`의 후속 변경을 함께 적는다.
- 실기기/서버 배포가 끝나지 않은 상태임을 남기고 검토용 draft PR로 공유한다.

이 브랜치는 원격 main에 없던 0~8단계와 개인 평균 재검토를 모두 포함한다. 최신 몇 개 파일만 검토하는 PR로 오해하면 안 된다. 팀원이 읽을 보고서는 `APP_INTEGRATION_REPORT.md`, 적용 담당자가 읽을 문서는 `APP_DEPLOYMENT.md`다. GitHub 병합 후에도 서버 실행과 APK 재빌드는 따로 해야 한다.
