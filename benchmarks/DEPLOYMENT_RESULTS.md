# D-051 앱·서버 연결 검사 실행 결과

UTC: 2026-11-12T11:58:24.224238+00:00
환경: Windows-11-10.0.26200-SP0 / AMD64 / Python 3.12.14 / Node v24.22.1

데이터는 합성 예제. 실제 Waitress 프로세스·HTTP·SQLite와 앱 순수 로직을 실행했다. 네이티브 SecureStore는 파일 어댑터로 대체했다.

| 검사 | 결과 | 초 |
|---|---|---|
| server_regressions | PASS | 30.315 |
| personal_http_flow | PASS | 4.662 |
| service_http_restart | PASS | 5.901 |
| foreground_retry_controller | PASS | 0.494 |
| secure_storage_failures | PASS | 0.398 |
| legacy_order_counterexample | PASS | 1.939 |
| stage2_token_parity | PASS | 1.544 |
| stage3_catalog | PASS | 0.386 |
| stage4_metrics | PASS | 0.507 |
| stage5_semantic_parity | PASS | 0.654 |
| legacy_client_http | PASS | 2.96 |
| legacy_trust_http | PASS | 2.116 |
| legacy_full_flow | PASS | 2.288 |
| date_boundaries | PASS | 0.983 |
| typecheck | PASS | 8.673 |
| lint | PASS | 41.664 |
| native_peer_versions | PASS | 0.981 |
| expo_sdk_versions | PASS | 2.017 |
| expo_native_config | PASS | 2.236 |
| android_js_bundle | PASS | 73.964 |

전체 로그·검사별 실행 시각·소스 SHA-256: `deployment-verification.json`. JS bundle 성공은 APK 성공이 아니다.
선택 실행 시 이전 검사를 보존하고 변경 관련 검사만 다시 실행한다. 각 검사의 verified_at을 확인한다.

## 미검증
- Real paper/Coupang image OCR accuracy
- Physical Android UI/SecureStore/SQLite and process death
- Docker image/Compose and public DNS/TLS hosting
- Existing Expo project identity, signing credentials, APK build/install
- Real 1200/600 catalogue, FoodKeeper duration labels, physical-device model benchmarks
- Public-service load/security audit and final retention policy
