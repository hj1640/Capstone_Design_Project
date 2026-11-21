# 4단계 — Jaccard / MiniLM 상품 검색 비교

D-039/D-045, 2026-11-02. 실제 ONNX INT8 추론으로 3단계 카탈로그와 비교 코드를 실행했다. 실제 상품/주문 평가셋과 실기기 측정은 미확보다.

## 이번 결과

합성 상품 7개/식품 5개, 입력 25개를 사용했다. 개발용 입력 9개는 3개 상품, 평가용 등록 입력 12개는 나머지 4개 상품의 변형이다. 평가용에는 모호한 입력 1개와 미등록 입력 3개가 별도로 있다. 같은 상품의 질의가 dev/test 양쪽에 들어가면 exporter가 실패한다. 검색 후보 DB에는 전체 7개 상품이 들어 있다. 모델 학습은 하지 않는다.

| 평가용 등록 입력 12개 | 순수 Jaccard | MiniLM INT8 |
|---|---:|---:|
| 상품 Top-1 | 12/12 | 5/12 |
| 상품 Top-3 | 12/12 | 10/12 |
| 식품 Top-1 | 12/12 | 5/12 |

이 작은 합성 데이터는 문자 겹침이 많고 이 작업 중 작성됐다. 독립적인 실제 주문 정확도나 Jaccard의 일반적 우수성을 입증하지 않는다. 이번 결과에 맞춰 threshold를 조정하지 않았다. 원시 예측은 benchmarks/stage4-report.json, 간단한 표는 benchmarks/STAGE4_RESULTS.md 참조.

MiniLM은 ‘제주 아삭 당근’을 감자 후보에 올렸고, 미등록 ‘싱싱한 생연어’도 감자에 약 0.72 점수를 줬다. 코사인 점수는 확률이 아니다. INT8의 영향인지 확인하려면 같은 모델 FP32 비교가 필요하며 이는 5단계다.

## 비교 방법과 해석

- Jaccard: 앱과 같은 NFKC/문자·숫자 정규화, 2-gram 집합 유사도. 3단계의 원문 일치/부분 일치 승격은 순수 순위 비교에 넣지 않았다.
- MiniLM: models/manifest.json의 고정 리비전/해시를 검증한 모델과 토크나이저. 최대 128토큰, attention-mask mean pooling, L2 정규화, 384D, cosine 상품 검색 → 검토된 foodId 연결.
- 모델/카탈로그/토크나이저 런타임이 바뀌면 색인 키가 바뀐다. .npy는 Git 제외 캐시에 저장하며 shape/유한값/해시를 확인한다. 두 번째 실행에서 캐시 재사용도 확인했다.
- Top-k 분모는 정답 상품이 있는 known 사례뿐이다. 모호/미등록을 정답이 맞은 것처럼 합산하지 않는다. 관련 metric 검증 테스트 4개가 있다.
- 3단계 구조 규칙은 평가 전체 16개 중 식품 제안 10개, 확인 요청 3개, no_match 3개였다. 제안 10개 중 이번 정답과 다른 식품 제안은 0개였다. 이는 실제 등록 자동 확정/안전성 보장이 아니다.
- MiniLM 정책은 임계값 미정이라 16개 모두 확인 요청이다. 자동 승인 0건이므로 오확정률은 null이며 0%로 표시하지 않는다. 서로 다른 정책의 오류율을 동등 비교하지 않는다.
- 시간은 warmup 1회 후 3회. Jaccard는 Node, MiniLM은 Python의 토큰화·추론·pooling·검색 포함이다. JSON에 p50/p95·모델 로딩·색인 비용·cache_hit, OS/CPU/버전/시각/입력 및 소스 해시를 기록했다. 모바일 속도·메모리는 미측정이다.

## 재현

Node 24.22.1, Python 3.12.14, Python 패키지는 requirements-stage2.txt, JS는 pnpm-lock.yaml 기준.

```powershell
pnpm install --frozen-lockfile
pnpm model:prepare
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-stage2.txt
pnpm stage4:prepare
.venv/Scripts/python scripts/stage4_compare.py
.venv/Scripts/python -m unittest discover -s scripts -p test_stage4_metrics.py -v
pnpm typecheck
pnpm lint
```

한 문장만 임베딩 검색하려면 `.venv/Scripts/python scripts/stage4_compare.py --query '제주 아삭 당근'`. 결과는 사용자 확인 후보이며 소비기한을 반환하지 않는다.

실제 익명화 평가셋은 `{ "catalog": { "version": "...", "synthetic": false, "foods": [...], "products": [...] }, "cases": [...] }` JSON으로 준비한다. Catalog 항목은 3단계 계약과 같다. 각 case는 id/split(dev 또는 test)/kind(known, ambiguous, unknown)/query/expectedProductIds/expectedFoodIds를 가진다. 미등록은 두 정답 배열을 비운다.

`node scripts/stage4-export.mjs C:/경로/평가셋.json` → Python 비교 스크립트 실행. benchmarks의 결과를 덮어쓰므로 새 평가 실행은 브랜치/결과를 분리해 보관한다. 공개 Git에는 개인정보가 없는 자료와 검토된 결과만 반영한다.

## 다음 단계

운영 모델/임계값은 여전히 미정이다. 5단계에서는 동일 모델 FP32·INT8을 비교하고, 실제 상품·온라인 주문 평가셋에서 실패 사례를 확인한 뒤 앱 검색 통합을 진행한다. 2단계 실기기 검증 대기 상태도 그대로 기록한다.
