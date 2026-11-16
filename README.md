# 스마트 냉장고 앱 (7조 캡스톤)

## 현재 범위 (2026-11-16, 이 내용이 아래 기록보다 우선)

- **입력: 지류(종이) 영수증만.** 쿠팡 주문내역, 2-layer 상품 카탈로그, MiniLM 실험, 데이터 인사이트 화면은 제거했다.
- **식품 매칭: ko-sroberta-multitask(jhgan) INT8 ONNX + 코사인 유사도.** 식품 DB는 식품마다 표준명 1개.
  DB 임베딩은 앱 실행 중 1회만 계산해 캐시한다 (`src/services/ocr/foodMatcher.ts`).
- 임계값: 자동확정 = 점수 ≥ 0.50 그리고 1·2위 차이 ≥ 0.15, 0.40 미만은 원문 그대로 사용자 확인.
  실제 영수증으로 `pnpm calibrate:threshold`(또는 `scripts/calibrate_threshold.py <onnx> <tokenizer> labeled.csv`)를 돌려 재조정한다.
- 저장: expo-sqlite로 등록 품목·구매 이력·포장지 소비기한 수정을 기기에 저장 (팀원 brach2 작업).
- Expo 프로젝트: 기존 `hj1640/fridge-app` (`com.hj1640.fridgeapp`).
- 다음 작업: 실기기 ko-sroberta 추론 확인, 잔여량·폐기 기록 저장, visual hull.

### 모델 파일 준비 (GitHub에 올라가지 않음, 110MB)
`assets/models/ko-sroberta/model_int8.onnx`를 팀 드라이브에서 받아 넣거나 직접 만든다:
```bash
python convert_onnx.py   # jhgan/ko-sroberta-multitask → onnx_model/model.onnx
python quantize.py       # → onnx_model/model_int8.onnx
cp onnx_model/model_int8.onnx assets/models/ko-sroberta/
```
토크나이저(`assets/models/ko-sroberta/tokenizer.json`)는 저장소에 포함돼 있다. `pnpm test:tokenizer`로 확인.

---

## 이전 기록 (brach2, 2026-11-13 기준)

**2026-11-13 전달:** 새 Android 시험 APK 생성 완료. [설치 파일·실제 빌드 결과](benchmarks/ANDROID_BUILD_RESULTS.md), [팀 시험 안내](docs/ANDROID_TEAM_TRIAL.md), [GitHub 업로드](docs/GITHUB_UPLOAD.md), [현재 PR 본문](docs/PR_ANDROID_DELIVERY.md). 공개 서버·휴대폰 실행 검증은 아직 남아 있다. 아래 이전 준비 단계 설명보다 이 전달 기록을 우선한다.

현재 기준은 **D-050: 지류 영수증 + 쿠팡 주문내역, 포장지 소비기한, 개인별 평균**이다. 기존 0~8단계의 공용 평균 실험과 구분한다.

**D-052 최신 배포 선택:** 사용자 승인으로 새 Expo 프로젝트에 별도 앱을 만든다. [새 프로젝트 진행 안내](docs/NEW_EXPO_PROJECT.md)를 먼저 읽는다. 서버 없이 기기 내 등록·수정을 시험할 `preview-local`을 추가했으며, 서버 평균은 실제 서버 연결 후 갱신한다. 프로젝트 생성·APK 성공 여부는 실제 계정/빌드 결과를 확인해야 한다.

- [상세 구현·검토 보고서](docs/APP_INTEGRATION_REPORT.md)
- [실제 서버 배포·기존 Expo 앱 빌드·설치 순서](docs/APP_DEPLOYMENT.md)
- [실행한 검사 결과](benchmarks/DEPLOYMENT_RESULTS.md)
- [팀 공유 설명](docs/TEAM_DELIVERY.md)
- [GitHub PR 본문](docs/PR_APP_INTEGRATION.md)
- [결정 기록](docs/DECISIONS.md) / [기계 판독 계약](docs/project-contract.json)

실제 작업 대상은 기존 React Native / Expo SDK 57 앱이다. OCR 실패 시 합성 데이터로 자동 대체하지 않는다. 실제 ML Kit 인식은 해당 네이티브 모듈이 포함된 개발 APK가 필요하다. 지류/쿠팡 파서는 사용자 확인을 돕는 초안이며 실제 이미지 인식률 검증은 남아 있다.

개인 평균은 `포장지 날짜 − 구매일`의 산술평균이다. 계정·확인된 식품명·보관 조건으로 나누고 구매 품목 한 건이 한 번 기여한다. 수정·철회는 기존 기여분을 교체/제거한다. 평균은 실제 섭취 안전 기간이 아니며 포장지 날짜를 자동으로 바꾸지 않는다.

현재 판정: **앱 연결·배포 코드와 PC 검증을 제공하는 팀 시험 후보. 공개 서버 가동·APK 설치·실기기 인수 완료 아님.** D-051에서 운영자 발급 개인 연결 코드, 해시된 기기 세션, SecureStore, 전경 자동 재시도, Waitress 서비스와 HTTPS 배포 설정을 추가했다. 사용자는 별도 서버가 아직 없다고 확인했다. 실제 서버·기존 Expo 프로젝트 설정·서명·Android 확인이 필요하다. GitHub 업로드만으로 기존 설치 APK가 바뀌지는 않는다.

0~8단계 문서는 당시의 실험 기록이다. 최신 범위와 충돌하면 D-050/D-051과 위 문서를 우선한다. 모델 바이너리, 토큰, 개인 구매 DB, 실제 영수증 원문은 소스에 포함하지 않는다. 실제 상품 목록/FoodKeeper 원본과 실데이터·휴대폰 모델 검증도 별도 남아 있다.
