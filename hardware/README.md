# HW 연동 1차 — 앱 / Firestore 통신

기존 앱의 OCR, SQLite, 소비기한/개인 평균, EAS 설정은 유지한다. 기존 Expo SDK 57 및 expo-crypto를 재사용하고 Firebase Auth/Firestore REST API를 사용하므로 package.json과 pnpm-lock.yaml은 변경하지 않는다. API key는 공개 웹 앱 설정값이며 인증 비밀번호나 서비스 계정 키는 포함하지 않는다. 실제 프로젝트 설정과 일치하는지 확인 필요.

## 설치 / 검증
- 별도 feature/hw-ai-integration 브랜치에서 패치 적용. 실제 UID로 Firestore 규칙의 REPLACE_WITH_REAL_UID를 교체하여 콘솔에서 게시한다 (이미 동일 규칙 게시했다면 중복 작업 불필요). 이 규칙은 단일 테스트 계정 전용이며 역할 분리 전에는 운영에 사용하지 않는다.
- 전체 앱 빌드는 기존 모델 파일, Expo 프로젝트 권한 및 무료 빌드 한도 필요. 빌드 담당 환경에서 pnpm install --frozen-lockfile, pnpm typecheck, pnpm lint 후 기존 Android 시험 빌드 설정 검증. 노트북에서 설치할 필요는 없다. iOS 설치는 별도 경로.
- 식재료 상세 → 잔여량 측정 시작 → Firebase 테스트 계정 로그인 → T0/T1/T2 선택 → 새 촬영 세션 → 0° 촬영 요청. Firestore에서 session/command 두 문서가 동시에 생성/갱신됐는지 확인한다. 실제 촬영은 worker가 있어야 가능하다.
- 세션 ID를 기록해 두면 화면을 나갔다가 같은 품목에서 재로그인 후 불러올 수 있다. 인증은 메모리에만 유지한다. 오류 후 중복 명령을 생성하지 않도록 상태 새로고침부터 한다. 세션 화면 닫기는 작업 취소가 아니다. 실패한 세션은 새 세션으로 다시 시작한다. 1개 장치/1개 테스트 세션만 운용한다 (장치 예약/취소/재촬영 기능은 후속 단계).

## 프로토콜 v1 (후속 Pi/Colab 코드 계약)
- capture_sessions/{uuid}: owner_uid, device_id=fridge_01, item_id, item_name, mode, step(0~8), image_count, status, error, protocol_version, created_at; 명령 전송 시 command_id 추가. step은 완료된 촬영 단계 수이다. T0/T1/T2는 실험 태그일 뿐 자동 기준 부피 연결이 아님.
- capture_commands/{uuid}_{step}: owner_uid, device_id, session_id, step, angle, views(쉼표 구분), status, protocol_version, created_at. 0단계 top,side_000; 1~7단계 side_045~side_315. 명령 생성과 세션 pending 변경은 원자적 commit, updateTime 조건 및 exists:false 사용.
- Pi worker는 pending 명령을 원자적으로 claim하고 capturing/uploading으로 상태를 변경한다. 세션 command_id/step/owner/device 일치 확인. 각 view의 실제 저장 및 Drive 업로드 성공 검증 후 명령 completed, 세션 step+1, image_count=2(첫 단계) 또는 이전+1, status=waiting_angle (마지막은 ready_for_inference)로 원자적으로 갱신한다. 부분 실패 시 step/count 유지, failed 및 error 기록. 중복 실행/재시작 복구는 worker에서 구현해야 한다.
- Drive: capstone/captures/{session_id}/{session_id}_top.jpg 및 _side_000.jpg ... _side_315.jpg. 9개 view 모두 확인된 후 Colab 분석. 실제 결과 문서는 analysis_results/{session_id}. 현재 앱은 상태만 표시하며 결과/SQLite 자동 반영 없음. T0 기준량, 개별 물체 대응, 수동 확인 및 푸시 알림은 후속 구현.
- 앱은 대기 중 전경에서 5초 간격으로 세션 조회, 수동 새로고침 지원. 백그라운드 알림 미구현. 무료 쿼터 내에서 짧은 시험용으로만 실행.

## 검증 범위
순수 TypeScript REST/촬영 프로토콜 컴파일 및 모의 fetch 검사, 패치 적용 검사. 실제 Firebase 로그인/권한, RN 전체 타입 검사/lint, APK, 카메라, Colab 검증은 아직 수행하지 않았다.

공식 문서: https://firebase.google.com/docs/reference/rest/auth / https://firebase.google.com/docs/firestore/use-rest-api / https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/commit
