# D-052 새 Expo 프로젝트 설정 검사

UTC: 2026-11-12T12:14:41.391636+00:00
환경: Windows-11-10.0.26200-SP0 / Python 3.12.14 / Node v24.22.1

| 검사 | 결과 | 초 |
|---|---|---|
| new_project_configuration | PASS | 0.671 |
| decision_contract | PASS | 1.052 |
| service_http_regression | PASS | 9.442 |
| typecheck | PASS | 12.132 |
| lint | PASS | 41.943 |
| expo_native_configuration | PASS | 3.042 |
| android_js_bundle | PASS | 55.36 |

실제 Expo 생성/클라우드 APK 성공을 뜻하지 않는다. 합성 식별자·실제 HTTP 회귀·JS 번들 검사이다.
실제 클라우드 상태는 config/expo-project.json과 docs/project-contract.json을 확인한다.

전체 로그·소스 해시: new-expo-verification.json.
