# 5단계 — FP32 / INT8 비교와 앱 후보 확인 연결

D-013/D-015/D-039/D-046, 2026-11-02. 같은 리비전의 FP32 ONNX, 기존 upstream INT8, 직접 만든 INT8 2종을 PC에서 실행하고 앱 개발용 검색 흐름에 연결했다. 실기기 실행 및 실제 데이터 검증은 대기 상태다.

## 측정 결과

합성 상품 7개, 평가용 등록 입력 12개. 4단계와 같은 데이터이므로 새로운 독립 평가셋이 아니다.

| 모델 | 파일 MB (10^6 bytes) | 상품 Top-1 | Top-3 | PC warm p50 ms |
|---|---:|---:|---:|---:|
| FP32 ONNX | 470.27 | 4/12 | 12/12 | 3.70 |
| 기존 upstream INT8 | 118.05 | 5/12 | 10/12 | 2.02 |
| 로컬 INT8 (MatMul + Gather) | 118.31 | 5/12 | 10/12 | 2.01 |
| 로컬 INT8 (MatMul만) | 406.94 | 5/12 | 11/12 | 1.98 |

로컬 MatMul+Gather 모델은 FP32보다 파일이 약 74.8% 작다. 이 PC에서 p50도 줄었지만 모바일 속도로 일반화할 수 없다. 프로세스 lifetime peak RSS는 FP32 약 921MB, 로컬 INT8 약 468MB였다. Python/ORT/tokenizer를 포함한 전체 프로세스 수치이며 모델만의 메모리가 아니다.

FP32도 낮은 Top-1을 보였으므로 4단계 오분류를 양자화만의 문제로 볼 수 없다. Jaccard보다 좋다고 결론 내리지 않았고 운영 모델/유사도 임계값도 확정하지 않았다.

원시 순위·벡터 변화·파일 해시·시간·메모리·환경은 benchmarks/stage5-report.json, 표는 benchmarks/STAGE5_RESULTS.md 참조. 모델마다 새 프로세스를 사용했고 warmup 1회/반복 3회, CPU 2 threads다. OS 파일 캐시는 통제하지 않았다.

## 모델 생성과 출처

- FP32: Xenova/paraphrase-multilingual-MiniLM-L12-v2, 고정 리비전 2c4055b12046f11709e9df2c122e59ffbdc2f900의 기존 ONNX export를 재사용했다. models/stage5-manifest.json의 해시를 검증한다.
- 원본 PyTorch checkpoint → ONNX export를 이번에 수행하거나 변환 동등성을 측정한 것은 아니다. 이를 완료로 보고하지 않는다.
- scripts/stage5_quantize.py: FP32 ONNX → dynamic INT8. QInt8/per_channel/reduce_range, MatMul/Gather를 고정한 실험 recipe다. 평가 정답으로 파라미터를 튜닝하지 않았다.
- --matmul-only는 임베딩 Gather를 FP32로 남겨 크기 차이를 확인하는 비교군이다. 생성 recipe·ORT/ONNX 버전·출력 해시는 models/stage5-quantization.json 및 stage5-matmul-quantization.json에 있다.
- shape preprocess는 별도 실행하지 않아 ORT의 권고 경고가 발생했다. 현 recipe를 최종 최적화 설정으로 간주하지 않는다.
- 공식 API 참고: https://onnxruntime.ai/docs/performance/model-optimizations/quantization.html

## 앱 연결

홈 → 개발용 상품 검색 검사 → 검색 방식 버튼으로 문자 검색/로컬 MiniLM INT8 전환 → 후보 선택. OCR 결과 화면의 ‘이 입력의 MiniLM 후보 확인’으로도 같은 입력을 가져갈 수 있다.

추론은 지연 로딩된 단일 세션으로 직렬화한다. 화면을 나가면 세션을 해제한다. 생성된 상품 벡터는 모델 해시/카탈로그 버전/ID를 검사한 뒤 사용하며, 고득점도 자동 승인하지 않는다. 검색 결과 공유에는 기종/OS/시각/방법/시간/모델 식별값을 포함한다.

합성 상품 후보의 선택은 검사 화면의 메모리 상태다. 실제 냉장고 등록/소비기한 계산에는 적용하지 않는다. 실제 상품 매핑과 검증된 보관규칙이 아직 없으며, 해당 통합을 완료로 표시하지 않는다. 개인 저장·서버 제출은 6단계 대상이다.

개발 빌드에는 기존 2단계 upstream INT8 검사와 5단계 로컬 INT8 검사를 위해 약 118MB 모델 2개가 포함된다. FP32/MatMul-only는 .easignore에서 제외했다. 이 개발 빌드를 최종 용량 최적화 배포판으로 부르지 않는다. 운영 모델을 선택한 뒤 단일 모델만 포함해야 한다.

## 재현 (소스 다운로드 후)

Node 24.22.1, Python 3.12.14. JS는 pnpm-lock.yaml, Python은 requirements-stage5.txt를 사용한다.

```powershell
pnpm install --frozen-lockfile
pnpm model:prepare
pnpm model:prepare:fp32
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-stage5.txt
.venv/Scripts/python scripts/stage5_quantize.py --matmul-only
.venv/Scripts/python scripts/stage5_quantize.py
.venv/Scripts/python scripts/stage5_benchmark.py
pnpm test:stage5
pnpm typecheck
pnpm lint
pnpm exec expo start --dev-client
```

benchmark가 합성 상품 색인과 Python 기준 질의 벡터를 생성한다. 생성 환경이 바뀌면 해시가 달라질 수 있으므로 새 모델과 새 색인을 함께 만든다. 모델 파일은 Git에 넣지 않는다. PC 비교 준비에는 임시 파일을 포함해 수 GB의 여유 공간이 필요하다.

실기기에는 2단계의 기존 EAS 프로젝트 식별값과 새 ONNX 네이티브 모듈이 포함된 개발 APK가 필요하다. TEAM_SETUP.md 참조. APK를 재빌드하지 않고 예전 APK만 실행하면 새 네이티브 모듈을 검증할 수 없다.

## 검증 및 남은 조건

- 4종 ONNX 실제 CPU 실행, 25개 입력/모델별 상품 색인 생성, 형상 384D/유한값 검사.
- 로컬 모델의 Python/TypeScript Top-3 순위 25개 모두 일치. 빈 입력/잘못된 벡터/모델 해시·카탈로그 버전 불일치 거부 검사 통과.
- TypeScript 및 Android JS 번들 생성 통과. lint 오류 0/경고 3 (기존 2개 + native asset require).
- PyTorch export 동등성, 실제 온라인 주문 평가, Android 네이티브 빌드/기기 지연·메모리/입력→확인 UI 실사용은 미검증이다. 따라서 5단계 전체 배포 완료 판정은 대기다.
