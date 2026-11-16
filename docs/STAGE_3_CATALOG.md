# 3단계 — 상품 DB 검색과 표준 식품 연결

D-039/D-041/D-044. 2026-11-02. 기존 Expo 앱에서 2층 상품/식품 검색 흐름을 구현했다. 검증 범위는 합성 상품 7개와 식품 5개이며, 실상품 데이터 인수·실기기 검증은 대기 상태다.

## 동작

- 상품명 originalTitle을 그대로 보존하고 searchText를 검색에 사용한다. foodId/productId는 이름과 별개다.
- 전체 상품명 일치 → 검토된 매핑이면 product. 부분 입력의 후보가 같은 식품 → food_only, productId는 null. 다른 식품/미검토 매핑이 섞이면 needs_review.
- 후보를 화면에 3개만 보여도 모호성 판정에는 전체 부분 일치 후보를 사용한다. 3은 이번 화면의 표시 개수이며 유사도 운영 임계값이 아니다.
- 상품 부분 일치가 없으면 표준 식품명/별칭 일치를 확인한다. 나머지는 문자 2-gram Jaccard 후보를 제시하고 자동 확정하지 않는다. 겹침이 없으면 no_match.
- Jaccard 점수는 순위값이다. MiniLM 임베딩 비교는 다음 4단계의 비교 대상이다. 문자열 정규화는 NFKC/소문자/문자·숫자 보존이며 원본 필드는 변경하지 않는다.
- createCatalogService는 검증한 데이터의 복사본을 보유하고 비동기 searchProducts 및 식품 조회를 제공한다. marketplace 필터, 중복 ID/끊긴 연결 검사를 포함한다.

## 앱에서 확인

기존 팀 개발 환경은 TEAM_SETUP.md 및 STAGE_2_VALIDATION.md 참조. Node 24.22.1에서 검사했다.

```powershell
pnpm install --frozen-lockfile
pnpm model:prepare
pnpm test:stage3
pnpm typecheck
pnpm lint
pnpm exec expo start --dev-client
```

홈 → **개발용: 3단계 상품 검색 검사**. 합성 예제 버튼 또는 직접 입력으로 후보와 연결 식품을 확인하고 후보를 선택할 수 있다. 선택 결과는 이 검사 화면의 메모리 상태다. 소비기한은 검증된 규칙이 없어 unknown이다.

실제 OCR 경로에도 개발 모드에서 합성 상품 후보 표시를 연결했다. 해당 후보는 검색 구조 점검용이며 기존 등록 로직에 자동 적용하지 않는다. 기존 OCR 표준명 Jaccard/임계값/기한 fallback은 여전히 남아 있으므로 실제 등록 전체가 새 규약을 따르는 단계로 발표하지 않는다. 실제 통합은 5단계에서 모델 비교와 함께 진행한다.

## 대표 사례

| 입력 | 결과 | 이유 |
|---|---|---|
| 가상 바른농장 | food_only / 당근 | 식품명이 빠져도 이 합성 DB에서 고유한 접두어 |
| 간편한 국내산 제주 | needs_review | 당근·감자 상품이 함께 일치 |
| 당근 | food_only / 당근 | 여러 상품이 같은 식품 |
| 가상 부침용 두부 300g | product / 두부 | 상품 원문 일치와 검토된 연결 |
| 무관한외부상품 | no_match | 문자 겹침 없음 |

부분 일치가 현실에서도 고유하다는 보장은 없다. 실제 카탈로그에 비식품/동명 상품이 추가되면 결과도 바뀐다. 상품을 복원한 사실로 표시하지 않는다.

## 팀원이 실제 데이터를 연결하는 방법

`src/data/catalog-stage3.ts`는 합성 fixture다. 실제 자료는 `Catalog` 형식의 foods/products/version/synthetic 필드로 준비하고 `createCatalogService`에 전달한다. 식품은 foodId/name/aliases/revision, 상품은 Product 계약 필드를 모두 채운다. originalTitle에는 출처 원문을 보존한다. 실제 자료의 synthetic은 false로 두되 검토 전 mappingStatus는 unreviewed, foodId는 null로 유지한다.

실제 파일 인수 시 출처·이용 권한·marketplace/externalProductId·식품 매핑 검토자를 기록한다. 조원이 검토한 연결만 reviewed로 바꾼다. 현재 예제 7개는 약 600개 선별 자료도 쿠팡 실제 상품도 아니다. 검증된 보관규칙이 없으므로 기한 값을 만들어 넣지 않는다.

## 검증 증거

`benchmarks/stage3-checks.json`: 합성 데이터 검색·매핑·검증 검사 20개. 날짜·Node/OS·통과 사례 기록. 이 숫자는 모델 정확도 측정이 아니다. 타입·lint·Android 번들 결과는 VALIDATION.md 참조. 2단계 실기기 검증은 계속 대기 상태이며 이번 결과가 그 조건을 충족하지 않는다.
