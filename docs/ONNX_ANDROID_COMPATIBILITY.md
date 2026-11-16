# ONNX Android 호환 패치 — D-052

적용 대상은 잠금 파일의 `onnxruntime-react-native@1.24.3`, Expo SDK 57, React Native 0.86.3이다. 패치는 `pnpm-workspace.yaml`의 `patchedDependencies`와 `patches/onnxruntime-react-native@1.24.3.patch`로 재현한다. 이 파일들과 `pnpm-lock.yaml`을 함께 공유한다. 설치된 node_modules만 수동 변경해 전달하는 방식이 아니다.

## 실제 발견과 수정 이유

| 발견 | 근거 | 수정 |
|---|---|---|
| Gradle 설정 평가 실패 | EAS `8c361e1f-75b9-401f-8786-d4b94f070e43`의 `VersionNumber` 오류 | [ONNX Runtime에 병합된 수정 #27385](https://github.com/microsoft/onnxruntime/pull/27385)에 따라 major/minor 정수 비교를 적용. RN 버전 판별을 삭제하지 않음 |
| 네이티브 모듈 등록 누락 | 이 PC의 실제 Expo autolinking 결과에서 ONNX 항목 없음, ML Kit 항목 있음 | `unimodule.json` 제거 및 오래된 Expo 수동 Gradle 플러그인 사용 제거. [원 프로젝트의 이슈 #29004](https://github.com/microsoft/onnxruntime/issues/29004)와 로컬 resolver 소스의 제외 조건을 대조 |
| 네이티브 ONNX 버전이 매번 달라질 수 있음 | 라이브러리의 `latest.integration@aar` | 현재 JS 릴리스와 같은 Maven `onnxruntime-android:1.24.3`으로 고정. 공식 Maven POM의 존재(HTTP 200) 확인. QNN/extension 선택은 현재 사용하지 않음 |
| 구형 Catalyst 경유 초기화 | RN 0.86.3의 `BridgelessReactContext.getCatalystInstance()`는 legacy-minify 활성화 시 예외. 같은 소스에 직접 `getJSCallInvokerHolder()` API 존재 | `ReactApplicationContext.getJSCallInvokerHolder()` 직접 접근으로 변경. 모바일 초기화 성공은 기기에서 별도 확인 |

패치 후 실제 autolinking 결과는 `new OnnxruntimePackage()`와 `new TextRecognitionPackage()`를 포함했다. Windows sandbox 안에서는 모든 네이티브 의존성 탐색이 비어 나오는 경우가 있어, 실제 파일 접근이 가능한 실행 환경에서 검사했다. 이 결과를 Android 앱 실행 성공으로 바꾸어 말하지 않는다.

## 재현

```powershell
pnpm install --frozen-lockfile
pnpm test:native-linking
pnpm test:project-config
pnpm typecheck
pnpm lint
pnpm build:preview:local
```

`check-deployment`에도 실제 모듈 등록 검사를 포함한다. 빌드 결과는 [ANDROID_BUILD_RESULTS](../benchmarks/ANDROID_BUILD_RESULTS.md)를 확인한다. Java/C++ 컴파일 성공, 앱 시작, 실제 모델 추론, 정확도·속도 측정은 서로 다른 검증이다. 마지막 두 항목은 실기기 결과가 필요하다.

향후 공식 ONNX 패키지를 올릴 때는 해당 수정이 배포본에 포함됐는지 확인하고 패치를 재평가한다. 패치를 무시하거나 설치 검사를 끄는 방식으로 업그레이드하지 않는다.
