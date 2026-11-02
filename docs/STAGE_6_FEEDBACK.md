# 6단계 — 개인 소비기한 저장과 수정값 제출

D-040/D-041/D-047, 2026-11-02. 기존 Expo 앱 상세 화면에 개인 날짜 편집을 추가하고, SQLite 저장·전송 대기열·로컬 개발 API를 구현했다. 서버 배포/운영 인증/실기기 검증은 대기 상태다.

## 앱 동작

1. 식품 상세 → 날짜(YYYY-MM-DD)와 근거(포장지 날짜/내 예상) 선택 → 내 날짜 저장.
2. 날짜와 원래 참고 날짜, 식품 snapshot, 대기열을 Expo SQLite kv-store에 하나의 JSON 값으로 저장한다. 저장이 성공한 뒤 화면을 바꾼다. 앱 재실행 시 수정한 품목과 날짜를 복원한다.
3. 개인 날짜 해제는 원래 참고 날짜로 돌아간다. 공유 기여 철회와 구분한다.
4. 상세의 ‘개발용: 수정값 제출·철회’ → 개발용 동의 스위치 → 제출 대기열 추가 → 서버 주소/개발 토큰 입력 → 동기화.
5. 최초 개인 수정은 동의한 제출 전까지 서버로 보내지 않는다. 이미 서버에 저장된 개인 기록의 후속 수정/해제는 다음 동기화에서 갱신하고 이전 제출을 무효화한다.
6. 수정값의 근거와 날짜는 사용자 주장이다. 포장지/부패/실제 소비 관측을 검증했다는 뜻이 아니다.

기존 추정 잔여량 바·수치는 D-007에 따라 상세/식품 카드에서 제거했다. 날짜에 따른 위험 색상 UI는 별개다. 전체 구매 이력/모든 앱 상태를 영속화한 것은 아니며, 이번 저장 범위는 개인 수정한 품목과 수정·제출 대기열이다.

## 재전송과 철회

- 요청 키와 정확한 payload를 네트워크 호출 전에 저장한다. 응답이 유실돼도 같은 키로 재전송한다.
- 전송 전의 여러 개인 수정은 최신 값으로 합친다. 전송 중 새 수정이 생겨도 응답 처리 시 최신 로컬 상태를 덮어쓰지 않는다.
- 409 충돌은 해당 품목의 후속 전송을 보류한다. 사용자가 ‘내 날짜로 다시 요청’ 또는 ‘서버 날짜 사용’을 선택한다. 다른 품목이나 철회는 계속 처리 가능하다.
- 오류/충돌 상태는 대기열에 남긴다. 네트워크 오류/5xx/401은 로컬 수정을 보존하며 멈춘다. Retry-After가 있으면 해당 시간 전 의존 요청을 보내지 않는다. 현재는 사용자가 동기화 버튼으로 재시도하며 자동 백그라운드 동기화는 구현하지 않았다.
- 제출 철회는 key에 대한 서버 tombstone을 만든다. POST 응답을 못 받아 feedbackId를 모르는 경우도 철회 가능하다. offline 철회는 기기에 보존하고 다음 동기화에 먼저 전송한다.
- 철회 후 새 제출에는 새 개인 수정과 새 동의가 필요하다. 철회는 공개 반영/기여 사용을 막는 상태 전이이며 저장 데이터 전체 삭제 API를 구현한 것은 아니다.

## 개발 API

Python 표준 라이브러리 HTTP + SQLite. 기본 listen은 127.0.0.1:8766이며 외부에 배포하지 않았다. 환경변수의 개발 토큰을 해시로 대조해 owner를 정한다. 사용자가 payload로 actorId/가중치/승인 상태를 전달할 수 없다. 계정 경계·트랜잭션·멱등 키·revision을 검사한다.

이는 개발용 인증 어댑터다. 실제 로그인/계정 복구/운영 토큰 발급 및 TLS/호스팅/보관 기간은 미정이다. 클라이언트는 최초 연결한 서버·owner에 대기열을 묶어 다른 계정으로 조용히 보내지 않는다. 토큰은 앱 화면의 메모리에만 보관한다.

1단계 API의 GET/PATCH item, POST/GET/DELETE feedback를 구현했다. 개발용 확장:

| 메서드/경로 | 용도 |
|---|---|
| GET /v1/me | 개발 인증 주체·동의 버전 확인 |
| PUT /v1/me/items/{id} | 최초 개인 snapshot 생성, expectedRevision=0. 기존 기록 덮어쓰기 금지 |
| DELETE /v1/me/expiry-feedback/by-key/{submissionKey} | 응답 유실/아직 도착하지 않은 제출도 철회 |

PUT은 실제 카탈로그 연결이 없어 foodId/productId/ruleSnapshot을 null로 제한한다. 클라이언트의 기존 모의 이름을 임의 ID에 연결하지 않는다. 구매일도 기존 앱이 보유한 값이므로 실제 주문일로 독립 검증했다고 주장하지 않는다.

제출은 held로 저장된다. FOOD_UNMAPPED/MISSING_BASE_DATE/INVALID_DATE_ORDER 등의 사유와 기간 의미를 보존한다. N·이상값·가중치·평균·공개 정책은 미정이며 집계나 공유 기본값 배포를 켜지 않았다. 현재 앱은 purchase_remaining만 제출하며 after_opening은 API 테스트만 있다. 개봉일을 만들어 넣지 않는다.

## 실행 및 검증

새 native dependency: expo-sqlite, expo-crypto. 새 개발 APK가 필요하다. 모델 준비는 STAGE_5_MODEL_AND_APP.md 참조.

```powershell
pnpm install --frozen-lockfile
python -m unittest discover -s server -p test_dev_api.py -v
python server/run_client_check.py
pnpm typecheck
pnpm lint
```

서버를 직접 실행할 때 아래 개발 토큰은 각 PC에서 새로 생성한다. 출력/환경변수를 Git에 넣지 않는다.

```powershell
$devToken = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$tokenMap = @{}
$tokenMap[$devToken] = 'local-user-a'
$env:FRIDGE_DEV_TOKENS_JSON = $tokenMap | ConvertTo-Json -Compress
# 개발 화면에 붙여넣을 토큰은 현재 터미널의 $devToken 값 사용
python server/dev_api.py
```

Android 기기에서 PC loopback에 연결하려면 adb reverse tcp:8766 tcp:8766 후 앱 개발 화면에 http://127.0.0.1:8766을 사용한다. 에뮬레이터/네트워크의 HTTP 정책에 따라 추가 개발 환경 설정이 필요할 수 있다. 실제 기기 연결은 이번에 수행하지 않았다. 공용 서버에는 이 개발용 HTTP 서버를 그대로 배포하지 않는다.

## 확인한 것과 남은 것

- 서버 테스트 13개: 인증/소유권, 날짜/근거, revision, 멱등성, 서로 다른 키 및 동시 제출 중복 방지, 수정 무효화, 철회, DB 재연결 보존.
- 실제 loopback HTTP 서버 + 파일 저장 adapter를 사용하는 TypeScript 통합 검사 통과. 14개 시나리오를 benchmarks/stage6-client-checks.json에 기록했다.
- Node 파일 adapter로 재시작/응답 유실/계정 차단/동시 로컬 수정/충돌 재요청/Retry-After를 검사했다. Android SQLite 재시작 실측과 동일한 검증은 아니다.
- TypeScript 및 Android Metro export 통과. ESLint 오류 0/기존 경고 3.
- 휴대폰에서 SQLite 실제 저장·재실행·HTTP 통신, 운영 인증·배포·보관/삭제 정책, 실제 식품 연결 및 공유 통계는 남아 있다. 7단계는 신뢰도·집계 정책 비교와 구현이다.
