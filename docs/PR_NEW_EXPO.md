# D-052 후속 PR 설명

사용자가 새 Expo 프로젝트로 별도 앱을 만들도록 승인했습니다. 기존 GitHub 소스를 유지하면서 앱 이름/slug/scheme을 개인판으로 분리하고, `hj1640` 소유자 고정을 제거했습니다. 실제 owner/projectId/Android package는 생성 결과를 기록하는 `config/expo-project.json`으로 관리합니다. 로그인 전 null 값을 생성 완료처럼 사용하지 않습니다.

서버가 아직 없는 상태에서 기기 내 구매 등록·날짜 수정을 시험할 수 있도록 `preview-local` 독립 APK 프로필을 추가했습니다. 이 프로필만 API 주소 생략을 허용하고, 실제 주소를 넣으면 HTTPS 검증은 유지합니다. 서버 미연결과 서버 평균 미갱신 상태를 화면에 설명합니다. 연결형 preview는 여전히 실제 HTTPS 서버 검사를 요구합니다.

검증은 `benchmarks/NEW_EXPO_RESULTS.md` 및 `new-expo-verification.json` 참조. 클라우드 프로젝트 생성·APK 빌드·실기기 설치와 PC 번들 검사는 구분합니다. 실제 생성 상태는 `config/expo-project.json` 및 계약 JSON에 기록합니다. 기존 앱 데이터를 자동 이전하거나 두 Expo 프로젝트를 자동 병합하는 기능은 없습니다.
