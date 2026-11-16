# feat: 개인 구매 평균 연동과 별도 Android 시험 앱 전달

기존 앱에는 사용자 날짜 수정값을 개인별 서버 평균으로 유지하는 완성된 경로가 없었습니다. 이번 변경은 지류 영수증과 쿠팡 주문내역에서 확인한 구매 기록에 포장지 날짜를 저장하고, 개인·식품명·보관 조건별로 `포장지 날짜 − 구매일`을 집계하도록 앱과 서버를 연결합니다. 한 구매의 수정은 기여분을 교체하고, 철회는 제거하며, 응답 유실 후 같은 요청의 재전송은 중복 집계하지 않습니다.

## 범위

- D-050: 지류/쿠팡 입력, 구매일 확인, 포장지 날짜 편집, 개인별 증분 산술평균. 기존 데이터의 추정 날짜를 포장지 관측으로 자동 전환하지 않습니다.
- D-051: 운영자 발급 개인 연결 코드, 해시된 기기 세션, SecureStore, SQLite 전송 대기, 전경 재시도·충돌·철회 및 Waitress/SQLite 서버 배포 구성.
- D-052: 실제 생성한 `juuuuuuun/fridge-app-personal` 프로젝트, 별도 package, Metro 없는 Android `preview-local` 시험 APK 경로. 기존 팀 앱과 데이터·서명 자동 병합은 없습니다.
- 실제 빌드 오류 수정: 중복 잠금 파일 제거, Node/pnpm 고정, 재현 가능한 ONNX 1.24.3 Gradle/자동 등록/초기화 호환 패치. `patches/`와 `pnpm-workspace.yaml`을 반드시 포함합니다.

## 검증 근거

**실제 APK 생성 성공:** EAS `0a220d0e-cd8e-48de-9315-474e560b04f6`, FINISHED, versionCode 4. 내려받은 APK의 ZIP/식별자/네이티브 라이브러리/모델 해시 검사 PASS. 기기 설치·실행 및 공개 서버 배포는 미완료.

- 개인 평균·중복·동시 요청·재시도·철회 및 로컬 HTTP 서버 재시작: `benchmarks/DEPLOYMENT_RESULTS.md`, `deployment-verification.json`.
- 새 Expo 설정·타입·린트·Android JS 번들: `benchmarks/NEW_EXPO_RESULTS.md`. 이 PC 검사 자체는 APK나 휴대폰 실행 증거가 아닙니다.
- 실제 클라우드 빌드 시도·결과·소스 SHA·다운로드 정보: **`benchmarks/ANDROID_BUILD_RESULTS.md` 및 `android-build.json`**. 실패 이력도 포함합니다.
- ONNX 수정 근거 및 실제 자동 등록 검사: `docs/ONNX_ANDROID_COMPATIBILITY.md`, `pnpm test:native-linking`.

## 남은 적용 조건

공개 개인 평균 서버는 아직 없습니다. `preview-local`은 기기 내 등록·날짜 수정과 전송 대기 저장을 시험하는 구성입니다. 실제 서버 URL과 개인 연결 코드를 등록한 뒤 서버 평균 갱신을 시험해야 합니다. Android 실기기 인수, 원래 앱에서 새 앱으로 기록 이전, 실상품 DB 통합, OCR·MiniLM 실데이터 정확도/속도 측정은 완료로 표시하지 않습니다.

근거 없는 통계적 이상치 임계값은 활성화하지 않습니다. 현재 필터는 날짜 형식·출처·보관 조건·소유권·중복·충돌 검사입니다. 평균은 식품 섭취 안전 보증이나 포장지 날짜의 대체값이 아닙니다.

팀 실행 안내: `docs/ANDROID_TEAM_TRIAL.md`. 상세 요구→설계→코드→반례: `docs/APP_INTEGRATION_REPORT.md`. 서버 적용: `docs/APP_DEPLOYMENT.md`. 실제 결과를 `benchmarks/DEVICE_ACCEPTANCE_TEMPLATE.md`에 기록한 뒤 운영 적용을 판단합니다.

이 브랜치에는 원격 main에 없던 0~8단계와 이후 재검토가 함께 포함됩니다. 일부 화면 변경만 있는 PR이 아닙니다. GitHub 병합만으로 기존 설치 APK나 서버가 자동 업데이트되지는 않습니다.
