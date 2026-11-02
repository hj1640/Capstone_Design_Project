# 7단계 — 수정값 신뢰도·증분 통계·공유 규칙

D-040/D-048, 2026-11-02. 6단계 서버에 검토·집계·공개 조건·철회 엔진을 추가했다. 실제 식품 자료, 정책 승인, 운영 인증/배포는 대기 상태다. 기본 설정 config/feedback-policy.json은 enabled=false, 미정 수치는 null이다.

## 구현된 흐름

제출 snapshot → 서버 운영자의 식품/제품/보관 조건 연결 검토 → 같은 의미의 기준값 확인 → 정책 평가 → 기여/집계 갱신 → 공개 조건 검사 → 규칙 버전 생성. 클라이언트는 검토 결과·가중치·승인 정보를 지정하지 못한다.

집계 그룹은 foodId, productId, storage, opened, productForm, basis, overrideSource다. 식품 이름은 단순하게 유지하며 조건만 분리한다. 포장지 날짜/사용자 예상, 구매 후 남은 기간/개봉 후 기간을 섞지 않는다. 제품별 통계를 식품 전체로 자동 합치지 않는다.

운영자 검토도 포장지나 실제 소비를 독립 관측한 사실을 만들어 주지는 않는다. 날짜는 사용자 주장이다. 개봉 후 기간을 평가하려면 실제 개봉일이 있어야 하며, 포장지 절대 날짜를 개봉 후 권장기간으로 바꾸지 않는다.

## 정책 수식 (이번 구현의 실험 설계)

- 같은 owner/그룹은 최신 유효 기여 하나만 반영한다. 이전 기여를 빼고 새 기여를 넣는다. 부적격 새 제출이 별도 품목에서 들어오면 기존 유효 기여는 유지한다.
- 비교 중심은 현재 평균에서 해당 사용자의 이전 기여를 뺀 값이다. 다른 기여가 없으면 운영자가 근거를 확인한 같은 그룹의 이전 기준 평균을 사용한다.
- 허용 편차 폭 = referenceDays × relativeDeviation. referenceDays는 같은 조건·기간 의미의 기준값이며, 실제 자료가 없으면 REFERENCE_REQUIRED로 보류한다. FoodKeeper 전체 보관기간을 구매 후 남은 기간으로 자동 변환하지 않는다.
- 편차가 폭 이내이면 weight=1. 밖이면 weight=outlierWeight × 허용 폭 / 실제 편차. 고정된 작은 가중치만 곱하는 것보다 극단값 하나의 영향을 제한하려는 실험식이다.
- arithmetic_mean 후보는 outlierWeight=0으로 이상값을 제외하고 정상 기여만 산술평균한다. weighted_mean 후보는 명시된 양수 가중치를 쓴다. 한 운영 정책에서 두 평균 방식을 동시에 쓰지 않는다.
- 평균은 sumWeightedDays / sumWeight. 일반 제출·교체·철회는 저장된 합계/count의 증분 갱신이다. 가중치는 승인 시점에 기록하고, 철회 때 같은 값을 뺀다. 다른 과거 기여의 가중치를 조용히 다시 계산하지 않는다.

relativeDeviation/outlierWeight/최소 N/평균 방식/기여 선택 방식은 이번 실험용 정책의 매개변수다. 운영 승인값은 아니다. 구매주기 예측의 산술평균/EWMA 선택과도 별개다.

## N과 공개 조건

집계 계정 수와 정상 기여 계정 수를 따로 기록한다. 저가중치 이상값 계정은 평균에 작은 영향을 줄 수 있지만 최소 정상 기여 N을 채우는 데에는 쓰지 않는다. 동일 계정의 반복 입력은 N을 늘리지 않는다. 계정 수가 서로 다른 실제 사람 수를 보장하지 않으므로 다계정 악용까지 해결했다고 주장하지 않는다.

accepted는 통계 기여 상태다. published는 별도 상태이며 아래 조건을 모두 요구한다.

1. 명시된 정책·검토된 식품 연결·같은 의미의 기준값이 존재.
2. 정상 기여 계정 수가 정책의 minimum_contributors 이상.
3. publication_enabled=true와 approval_reference 존재.

approval_reference는 운영자가 기록하는 승인 근거 문자열이다. 전자서명이나 사용자 승인 사실을 자동 인증하는 기능은 아니다. 실제 사용자/팀 승인 없이 설정을 켜면 안 된다. 이번 기본 설정과 4가지 비교 실험은 공개 기능이 꺼져 있다. 공개 기능의 실행 검사는 SYNTHETIC TEST ONLY 근거와 임시 DB에서만 수행했고 서버는 검사 후 종료했다.

철회·개인 날짜 수정·기여 교체로 조건이 깨지면 공개 규칙을 철회하고 조회 결과는 빈 목록(unknown)으로 돌아간다. 평균이 바뀌어도 개인 입력 날짜를 덮어쓰지 않는다. 최소 인원 미달 값을 임의 기본값으로 반환하지 않는다.

## 이력과 재평가

정책 버전/매개변수, 매핑 검토 근거, 기준값 근거, 기여값·가중치·상태, 집계 revision, 공개 snapshot, 이벤트를 기록한다. 같은 버전으로 숫자를 바꾸면 거부한다. 기준값도 정책 버전별로 고정한다.

정책 변경 시 새 버전과 해당 버전의 기준값을 준비하고 명시적 rebuild를 실행한다. 전체 이력 재평가는 이 운영 작업에서만 한다. withdrawn/superseded는 다시 살리지 않는다. 이전 공개 snapshot과 이벤트는 보존한다.

## 6단계 서버 연결

- POST feedback: 활성 정책이 있으면 평가하며 검토/기준이 없으면 held. 기본 정책 미설정에서는 6단계와 같이 보류한다.
- PATCH 개인 날짜: 이전 기여를 같은 트랜잭션에서 제거하고 제출을 superseded 처리한다.
- DELETE feedback 또는 by-key: 기여를 제거하고 철회한다.
- GET /v1/foods/{foodId}/storage-rules: 현재 정책의 published 규칙만 반환한다. 개발 서버에서는 인증이 필요하다. 사용자별 제출/집계 원자료는 노출하지 않는다.
- 조건 필터: storage, opened(true/false), productForm, basis, overrideSource, productId. productId가 없으면 식품 수준 규칙만 반환한다. 특정 제품을 지정하면 그 제품과 식품 수준 fallback 후보를 반환하며, 호출자는 조건과 우선순위를 확인해야 한다. 필터가 빠진 조건을 추정해 단일 날짜로 적용하지 않는다.

최종 앱이 공유 평균으로 소비기한을 자동 적용하도록 활성화한 단계는 아니다. 실제 매핑/참고 규칙/정책이 없는 현재 상태에서는 조회가 비어 있는 것이 정상이다.

## 실행

Python 표준 라이브러리만 사용한다. Node는 실제 HTTP 클라이언트 검증에 사용한다.

```powershell
python -m unittest discover -s server -p "test_*.py" -v
python server/compare_trust_policies.py
python server/check_trust_http.py
python server/run_client_check.py
pnpm typecheck
pnpm lint
```

기본 로컬 서버는 6단계 문서의 개발 토큰 설정 후 `python server/dev_api.py --policy-file config/feedback-policy.json`으로 실행한다. 공개 기능은 꺼져 있다.

로컬 운영자 도구 server/review_feedback.py는 --db, --policy-file, --review-file을 받는다. review JSON은 feedbackId, mapping(foodId/productId/storage/opened/productForm), provenance, referenceDays, referenceProvenance를 포함한다. 활성화할 정책과 실제 근거가 먼저 필요하다. --rebuild는 명시적 정책 재평가용이다. 이 도구는 모바일에 공개하지 않으며 실제 자료를 임의로 채워 실행하지 않았다.

## 합성 비교 결과와 검증

benchmarks/STAGE7_RESULTS.md 및 stage7-policy-report.json 참조. 정상값 9/10/11, 다른 한 계정의 999 반복 20회, 기준값 10을 사용했다. 모두 실제 소비기한이 아닌 숫자 fixture다. 실험 N은 3/5, 편차 비율 0.5, 가중 후보 계수 0.1이며 합의한 운영값이 아니다.

원자료 23개 단순 평균은 870.0, 계정 중복만 제거하면 257.25다. 필터와 계정 제한을 함께 적용한 평균은 산술 후보 10.0 / 가중 후보 약 10.1666이다. 정상 기여는 3계정이므로 실험 N=3만 내부 배포 조건을 충족하고 N=5는 미달이다. 정상 1계정 철회 후 모두 미달이다. 비교 실험에서 실제 공개 규칙은 항상 없다.

서버 테스트 32개, 실제 HTTP 합성 공개/조건 조회/철회 검사, 6단계 클라이언트 대기열 통합 검사가 통과했다. TypeScript/lint도 통과(기존 경고 3개)했다. 원시 결과에 시각·OS·Python·엔진 해시를 기록했다.

합성 결과가 실제 안전성이나 악용 방지 성능을 입증하지는 않는다. 잘못된 초기 기준값은 정상 입력도 이상값으로 만들 수 있고, 여러 계정/장기 순서 효과는 추가 평가가 필요하다. 실제 식품 연결·기간 근거·정책 승인·운영 인증/호스팅은 여전히 남아 있다.
