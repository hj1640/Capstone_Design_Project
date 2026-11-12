> **현재 기준: D-050 (2026-11-12).** 지류+쿠팡, 포장지 날짜, 개인별 평균. 이 문서의 이전 공용/온라인 전용 설명은 당시 기록이며 [최신 검토](REVIEW_FINAL.md)와 [실행 안내](TEAM_SETUP.md)를 우선합니다.

# v1 API 계약 초안

D-039/D-040. 이번 단계에서 실행 서버나 endpoint를 배포하지 않았다. 타입의 문자열 날짜는 런타임 달력 검증이 필요하다. 아래 경로는 후속 구현 계약 제안이다.

| 메서드·경로 | 입력 | 성공 응답 |
|---|---|---|
| GET /v1/catalog/manifest | 선택적 If-None-Match | 200: catalogVersion/indexVersion/modelRevision, 다운로드 경로·SHA256; 미변경 304 |
| GET /v1/foods/{foodId}/storage-rules | productId 선택, storage/opened/productForm/basis | 200: 일치하는 published 규칙 목록과 revision. 없으면 빈 목록 |
| GET /v1/me/items/{itemId} | 인증 | 200: PersonalItem과 revision |
| PATCH /v1/me/items/{itemId}/expiry | ExpiryEditRequest, Idempotency-Key | 200: 수정된 PersonalItem |
| POST /v1/me/expiry-feedback | FeedbackSubmission, Idempotency-Key | 202: FeedbackReceipt. accepted/published 보장 아님 |
| GET /v1/me/expiry-feedback/{feedbackId} | 인증 | 200: FeedbackReceipt와 본인 제출 snapshot |
| DELETE /v1/me/expiry-feedback/{feedbackId} | 인증, Idempotency-Key | 200: withdrawn FeedbackReceipt. 반복도 같은 상태 |

검색은 `searchProducts(text, marketplace?, catalogVersion)` 로컬 비동기 함수 → SearchResult 계약을 사용한다. catalog 배포와 다운로드 인증/공개 범위는 상품 데이터의 이용 권한 확인 후 결정한다. 기존 공개 소비기한 규칙 조회는 최소 정보만 반환하며 사용자 이력과 통계 원자료를 포함하지 않는다.

## 쓰기 규칙

- `/me` 주체는 인증에서 얻는다. 다른 사용자의 item/feedback 조회·변경은 404, 인증 부재는 401. 내부 식별자를 추측해도 접근하지 못하게 한다.
- PATCH는 expectedRevision을 확인하고 불일치 409 `REVISION_CONFLICT`. null 날짜는 source도 null이어야 한다. 빈 문자열·유효하지 않은 달력 날짜는 422.
- POST는 itemRevision과 서버 저장 snapshot 일치를 검증한다. 제출자의 foodId·가중치·승인 플래그는 입력으로 받지 않는다. 동의 없음/철회된 버전이면 422 `CONSENT_REQUIRED`.
- 같은 actor/route/Idempotency-Key + 같은 payload 재시도는 최초 응답 재생. 다른 payload는 409 `IDEMPOTENCY_CONFLICT`. 키가 달라도 같은 itemRevision/basis의 중복 제출은 새 기여를 만들지 않는다.
- 수정으로 기존 제출을 superseded 처리하는 것과 기여분 제거를 원자적으로 수행한다. 새로운 제출 동의는 별도로 확인하며 개인 수정만 했다고 자동 재제출하지 않는다.
- 개인 수정 성공 후 제출 실패해도 개인 수정은 유지한다. outbox는 성공/충돌/재시도 대기/철회를 구분한다. 사용자 철회 후 대기 제출이 다시 살아나지 않게 한다.
- 429는 Retry-After에 따라 대기, 일시적 5xx는 같은 키로 재시도. 재시도 횟수·제출량 제한은 운영 정책에서 선택한다.

오류 형식: `{ "error": { "code": "REVISION_CONFLICT", "message": "최신 기록을 확인해 주세요", "requestId": "..." } }`. 원본 주문 텍스트·토큰·개인정보를 오류나 공용 로그에 포함하지 않는다.

## 통합 검증 시나리오

1. 상품 식별 성공→연결된 표준 식품→조건 일치 규칙. 다른 조건 규칙은 미적용.
2. 잘린 이름 후보가 당근/감자로 갈림→needs_review; 임의 상품 ID 확정 금지.
3. 여러 당근 상품→food_only; 특정 제품 규칙 접근 금지. 미등록→no_match/직접 선택.
4. 구매일 없음→기한 unknown. 포장지 수정은 개인 기록에 적용하되 구매 후 일수 집계는 보류.
5. 같은 제출 네트워크 재시도/서로 다른 키/동시 요청→기여 하나. 사용자 A의 항목을 B가 변경 불가.
6. 수정·철회→이전 기여 제거. 공개 기준 미충족 시 community 규칙 철회. 사용자 override는 유지.
7. N명 미달·이상값·근거 불명·미승인 정책→공개 기본값 갱신 안 함.
8. 앱 재시작 후 개인 수정 유지, offline outbox 복구, 규칙 업데이트가 사용자 날짜를 덮어쓰지 않음.

위 목록은 서버·모바일 구현 후 실행할 인수 기준이다. 1단계에서 통과한 실행 테스트로 보고하지 않는다.
