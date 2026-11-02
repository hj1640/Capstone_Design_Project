# 2단계 — 모델 실행 실험 구현과 검증

D-043, 2026-11-02. 모바일 검사 코드 및 PC 검증 구현 완료, 실기기 통과는 대기 상태다. 3단계 식품 DB 검색이나 5단계 FP32/INT8 비교 완료를 의미하지 않는다.

## 구현
- 기존 Expo 앱 홈에 개발 빌드 전용 검사 화면 추가. 고정 합성 입력 8개를 로컬 토큰화 → ONNX INT8 → masked mean pooling → L2 정규화 → 384차원 벡터로 처리한다.
- Python 기준 토큰과 모두 비교하며 불일치 시 실패한다. 벡터의 Python 대비 cosine/max absolute error는 측정값으로 출력하고 임의 운영 합격선을 만들지 않는다.
- 모델/토크나이저 로딩, 토큰화, warmup 1회 후 3회 추론 시간, 기종/OS/시각을 결과 공유 버튼으로 내보낸다. 메모리는 null이며 외부 측정이 필요하다.
- `models/manifest.json`에 모델 리비전 및 SHA-256 고정. 다운로드 스크립트가 모든 파일을 검증한다. 모델 바이너리는 Git에서 제외한다.
- 실험 대상은 Xenova/paraphrase-multilingual-MiniLM-L12-v2 INT8. 팀의 ko-sroberta 실험을 대체 확정한 것이 아니다. 모델 파일 118,054,609 bytes이며 작은 모바일 모델이라고 가정하지 않는다.

## 재현
Node 24.22.1, pnpm 11.25.0을 사용했다. pnpm-lock.yaml을 공유하므로 설치는 `pnpm install --frozen-lockfile`을 사용한다.

```powershell
pnpm install --frozen-lockfile
pnpm model:prepare
pnpm test:stage2
pnpm typecheck
pnpm lint
```

Python 기준값을 다시 측정할 때:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-stage2.txt
.venv/Scripts/python scripts/stage2-reference.py
pnpm test:stage2
```

`benchmarks/reference.json`은 합성 입력·토큰·벡터·PC 실행 측정값이며 실제 사용자 주문 데이터가 아니다. 이 파일을 바꾸면 기기 비교 기준도 바뀐다.

## 휴대폰에서 이어서 실행
기존 EAS 프로젝트의 owner/projectId/Android package는 저장소에 없으므로 빌드 담당자가 기존 값을 제공해야 한다. eas.json의 development 프로필만 추가했고 임의의 프로젝트를 만들지 않았다.

1. 기존 프로젝트 정보를 연결한 뒤 `pnpm dlx eas-cli build --profile development --platform android`로 새 개발 빌드를 만든다. 새 ONNX 네이티브 모듈이 필요하므로 이전 APK만으로 실행할 수 없다.
2. `pnpm exec expo start --dev-client`, 새 개발 빌드에서 연결.
3. 홈의 **개발용: 2단계 모델 실행 검사** → 검사 실행 → 결과 공유. 첫 실행/재실행을 구분하고 사용 커밋 SHA를 결과에 함께 적는다.
4. 기기 로그와 Android Studio profiler 또는 `adb shell dumpsys meminfo <실제 package>`로 메모리를 기록한다. 한 시점의 PSS를 peak로 부르지 않는다.
5. 기기에서 토큰 일치·벡터 오차·시간·메모리 확인 후 2단계 완료 판정. 현 시점에는 실기기 결과가 없다.

## 실제 검증
- Python ONNX CPU: 합성 8개 모두 384차원, 유한값. 모델 로딩 약 234ms (한 번의 PC 실행; 모바일 성능 아님).
- Python/JavaScript 토큰 ID·attention mask·type ID: 8/8 일치. 긴 입력 128토큰 잘림, 공백, 이모지 포함.
- masked pooling, 잘못된 shape/빈 mask 실패 검사 통과.
- TypeScript 통과. 기존 루트 handoff validator 통과, 회귀 테스트 42개 통과.
- Android bundle 및 lint의 최종 결과는 VALIDATION.md 참조.
- Python ORT 1.30.0 / RN ORT 1.24.3으로 런타임 버전이 다르다. 기기 오차를 아직 측정하지 않았다.
- FP32 변환/양자화 비교, 실제 분류 정확도, 모바일 메모리·속도는 미측정이다.

참고: [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [ONNX React Native](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html), [Hugging Face Tokenizers.js](https://github.com/huggingface/tokenizers.js).

EAS 업로드는 .easignore를 사용해 준비된 모델을 포함한다. Git에는 모델을 넣지 않는다. 반드시 빌드 전에 pnpm model:prepare를 실행한다. ESLint 9는 Expo 57 플러그인 호환 때문에 사용했으며 lint 오류 0/경고 2다.
