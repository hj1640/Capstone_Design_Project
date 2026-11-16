# 5단계 PC 실측 결과

합성 평가용 등록 입력 12개. 전체 25개로 벡터 변화·시간 측정. 모바일 측정 아님.

| 모델 | 파일 MB | 상품 Top-1 | Top-3 | p50 ms | FP32 대비 평균 cosine |
|---|---:|---:|---:|---:|---:|
| fp32 | 470.27 | 33.3% | 100.0% | 3.70 | 1.00000 |
| upstream_int8 | 118.05 | 41.7% | 83.3% | 2.02 | 0.98237 |
| local_int8 | 118.31 | 41.7% | 83.3% | 2.01 | 0.98841 |
| matmul_int8 | 406.94 | 41.7% | 91.7% | 1.98 | 0.99107 |

Upstream FP32 ONNX 재사용 및 로컬 dynamic INT8 생성. PyTorch export 검증은 미실행.
환경·모델 해시·peak RSS·개별 순위는 stage5-report.json, recipe는 models/stage5-quantization.json 참조.
