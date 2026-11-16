# 실제 Android 클라우드 빌드 기록 — D-052

**EAS FINISHED — Android 시험 APK 생성 성공.** 실제 완료 시각(UTC): 2026-11-12T13:20:55.137Z. 문서 정리일: 2026-11-13 KST.

[APK 다운로드](https://expo.dev/artifacts/eas/FXHf81oi6s7yav1VNIZaDnUG0bfmLGeJF209AHFDpfs.apk) · [성공한 빌드](https://expo.dev/accounts/juuuuuuun/projects/fridge-app-personal/builds/0a220d0e-cd8e-48de-9315-474e560b04f6)

앱 1.0.0 / versionCode 4. 서버 배포·실기기 설치/실행은 미완료. 바이너리 점검은 `apk-inspection.json` 참조.

## 프로젝트와 대상

- 사용자 결정: “우선 팀에서 시험할 Android APK 만들기”.
- 새 프로젝트: [juuuuuuun/fridge-app-personal](https://expo.dev/accounts/juuuuuuun/projects/fridge-app-personal).
- projectId: `6899818e-50b4-41b0-8fae-e4f27ac65566`.
- Android package: `com.capstoneteam7.fridge.personal6899818e`.
- 앱 버전: 1.0.0. 프로필: `preview-local`, internal APK, developmentClient=false.
- 새 프로젝트용 Android 서명키는 Expo가 생성·관리한다. 비밀키를 Git/패키지에 넣지 않았다.
- 첫 빌드의 로그에서 관찰한 EAS 머신: AMD 4 vCPU / 15.62 GB RAM. SDK 57 Ubuntu 26.04/JDK17/NDK r27b 이미지. 재시도부터 Node 24.22.1/pnpm 11.25.0 지정.

## 실패를 포함한 실제 이력

| 시도 | 소스 | build ID / versionCode | 결과·원인 |
|---|---|---|---|
| 1 | `301d5424ebe64e88020fc564c0c1014261f4eb63` | `c7c21b15-0d02-4a6b-ad17-bef12429478c` / 2 | 실패. 오래된 package-lock.json을 선택한 npm ci가 현재 package.json과 불일치 |
| 2 | `b207421639619eb0c96ea66bb20049f0639f4fa5` | `8c361e1f-75b9-401f-8786-d4b94f070e43` / 3 | 설치·번들 통과 후 Gradle 실패. ONNX 1.24.3의 VersionNumber 참조 오류 |
| 3 | `611cdc6228d61798c33d63ba71d4d3a46ec04b27` | `0a220d0e-cd8e-48de-9315-474e560b04f6` / 4 | 성공 — EAS FINISHED |

첫 문제는 npm 잠금 파일을 제거하고 pnpm 단일 설치 경로와 도구 버전을 고정하여 해결했다. 실제 두 번째 빌드의 설치 단계가 통과했다. 두 번째 문제는 [ONNX 호환 패치 기록](../docs/ONNX_ANDROID_COMPATIBILITY.md)대로 수정했다. 수정 전에는 Expo autolinking이 ONNX를 등록하지 않는 문제도 실제 재현했으며 패치 후 등록을 확인했다.

## PC에서 별도로 실행한 검사

- 수정 후 `pnpm install --frozen-lockfile`: 통과.
- 실제 Expo Android autolinking: ONNX 및 ML Kit 등록 통과.
- 프로젝트 구성 검사, TypeScript, ESLint: 통과.
- Git 소스 커밋 611cdc6을 새 폴더로 복원하고 `pnpm install --offline --frozen-lockfile` 및 두 구성 검사: 통과. [실행 기록](android-source-restore.json). 이 PC의 pnpm 캐시를 재사용했으며 새 PC에서의 온라인 설치 검증은 아니다.
- 루트 인수인계 계약 검사 및 루트 브라우저 시제품 회귀 42개: 통과. 이 42개는 Android UI 검사 수가 아니다.
- 개인 평균 서비스에 대한 이전 20개 검사 그룹/서버 48개 단위 테스트는 [D-051 기록](DEPLOYMENT_RESULTS.md)을 따른다. 이번 네이티브 빌드 수정은 서버 통계 계산을 바꾸지 않았다.

## 적용 판단의 경계

APK를 생성·다운로드하는 것과 실제 Android에서 설치·시작·OCR·SQLite·SecureStore·모델 추론을 확인하는 것은 다르다. 실기기 결과는 아직 없다. 실제 지류/쿠팡 자료의 인식률·식품 매칭 정확도·소비기한의 타당성이 APK 빌드 성공으로 검증되지는 않는다.

별도 공개 서버도 아직 없다. 이 APK 구성은 기기 내 구매·날짜 저장과 전송 대기 시험을 위한 것이다. 서버 개인 평균 갱신은 HTTPS 서버와 개인 연결 코드를 등록한 뒤 시험한다. 실사용자가 입력한 기간을 식품 안전 보증으로 해석하지 않는다.

원시 EAS 응답에는 일시적인 서명된 로그 URL이 포함되어 있어 공유하지 않는다. 공개 빌드 식별자·소스 SHA·결과·검증한 해시만 `android-build.json`으로 공유한다.

## 바이너리 재검사 명령

```powershell
python scripts/inspect_apk.py 내려받은파일.apk --output benchmarks/apk-inspection.json
```

ZIP CRC, 앱 식별자, JS 번들, DEX 패키지 클래스, ONNX 라이브러리와 모델 SHA-256을 점검한다. 서명 암호학 검증과 휴대폰 실행을 대신하지 않는다.

## 내려받은 APK 실제 검사 결과

**PASS.** 424,692,074 bytes (약 425 MB), SHA-256 `59007ce4683d6def33813cc4e1d5cbc24ba60557739003408994cfdd5ad11230`. ZIP CRC, manifest package, JS bundle, ONNX/ML Kit DEX 클래스, 4종 ABI의 ONNX 네이티브 라이브러리 확인. 포함된 INT8 모델 2개의 바이트 해시가 원본 manifest와 일치한다. 서명 독립 검증·기기 실행은 미실행이다.
