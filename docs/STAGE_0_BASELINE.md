# 0단계 — 현재 구현과 실험 자료 점검

점검일: **2026-10-30, Asia/Seoul**. 비교 기준: `main`의 `dc385df9babe8bad53064f16674e2019010c4965` (2026-10-12, Initial app skeleton + Google ML Kit OCR integration). 이번 문서가 추가된 커밋은 이 기준 커밋의 후속이다.

## 자료 연결과 확인 수준

| 자료 | 확인 결과 | 한계 |
|---|---|---|
| [GitHub](https://github.com/hj1640/Capstone_Design_Project/tree/dc385df9babe8bad53064f16674e2019010c4965) | 저장소 clone, 추적 파일 전체 목록, 주요 소스 직접 읽음. 점검 당시 브랜치 main 하나 | 별도 PC·비공개 저장소·미업로드 파일은 포함 안 됨 |
| [Notion](https://app.notion.com/p/3fcddc2e13b380868de9ca2b14385b29) | 2026-10-29 본문 5개 항목·중첩 토글 전체와 첨부 과제계획서 본문을 열람한 기록을 대조 | 10/30 연결 도구는 404 권한 오류, 공개 브라우저 재조회는 시간 초과. 최신 변경 여부 재검증 못 함 |
| [Expo 빌드](https://expo.dev/accounts/hj1640/projects/fridge-app/builds/ae1cdfc7-f4ef-4862-9024-4b00b5b70ac2) | 사용자가 실제 개발 버전으로 제공한 빌드 ID·프로젝트 URL 보존 | 웹 조회 실패, 브라우저 시간 초과. 빌드 상태·소스 커밋·APK·실기기 실행 미확인 |
| 별도 로컬 Python 웹 검증판 | 작업 폴더에 Python/SQLite/브라우저 소스와 다국어 MiniLM INT8 파일이 별도로 존재함 | 팀 Expo 앱도 Notion의 ko-sroberta 실험도 아님. 개인 DB·런타임·전체 인수인계는 이 공개 저장소에 복사하지 않음 |

## 앱에서 확인한 구현

| 항목 | 실제 파일 | 상태 |
|---|---|---|
| 플랫폼 | `package.json`, `app.json` | Expo ~57.0.27, RN 0.86.3, React 19.2.3, TypeScript, Expo Router |
| 6화면 | `src/app/` | 홈·등록·인식 결과·냉장고·상세·추천 |
| OCR | `src/services/ocr/mlkitEngine.ts` | 한국어 ML Kit 호출 코드. 기기 실행은 이번 점검에서 미검증 |
| 파싱 | `src/services/ocr/receiptParser.ts` | 줄 잡음 제거·수량 추출. Notion의 쿠팡 UI 잡음 수정 일부가 현재 코드에 없음 |
| 매칭 | `src/services/ocr/foodMatcher.ts` | 문자 2-gram Jaccard, 표준명·동의어 비교. 임베딩 호출 없음 |
| 표준 식품 DB | `src/data/foodDatabase.ts` | 모의 데이터라고 표시된 **16개** TypeScript 항목. 전체 상품명 보존 상품 DB 없음 |
| 참고 기한 | `src/context/FridgeContext.tsx` | 등록 당일 + 미개봉 보관일수, 미매칭 7일 fallback. 실제 주문일 사용 아님 |
| 기한 수정 | `src/app/item/[id].tsx`, Context | 잔여량 조절·소진·폐기 기능이 있으며 기한 수정 저장 API는 없음 |
| 저장 | `src/context/FridgeContext.tsx` | useState 메모리. 재실행 유지·SQLite·서버 없음 |
| 서버 통계 | 전체 추적 파일 | 수정 제출·이상값·N명 필터·평균 갱신·인증 API 없음 |
| 모델·평가 | 전체 추적 파일 | Python, .onnx, .npy, tokenizer, 변환·양자화·평가 스크립트 없음. package.json에 추론 런타임 없음 |
| 테스트·빌드 | 전체 추적 파일 | 테스트 파일/스크립트·CI·eas.json 없음. 생성형 android/ios 폴더도 없음 |

## Notion과 GitHub의 차이

연구노트에는 40개 식품/15개 카테고리 JSON, Python 임베딩 검색, 영어 `all-MiniLM-L6-v2`에서 `jhgan/ko-sroberta-multitask`로 교체한 사례, DB 임베딩 .npy 캐시, ONNX 440MB → INT8 110MB가 기록되어 있다. 해당 파일과 측정 로그는 이 Git 저장소에서 찾지 못했다. **기록된 실험**이지 이 앱에 연결됐다는 증거가 아니다.

- 23MB와 로딩 3~4배 향상은 기록 속 기대/목표이며 달성 결과 아님.
- 유사도 0.4963/0.6382 두 사례는 분류 정확도 벤치마크 아님.
- 영어 MiniLM 실패를 다국어 MiniLM의 한국어 불가로 일반화하지 않음.
- ko-sroberta 차원·토크나이저·JS 구현 가능 여부는 config와 파일로 재확인 필요.
- 16개 앱 예시 / 40개 연구 초안 / FoodKeeper 참조명 / 약 600 선별 입력은 다른 데이터 층이다.

## 현재 구현에서 이어갈 때 처리할 문제

- D-002: 종이 영수증 중심 잡음·매장 추정 로직과 샘플은 온라인 주문 흐름에 맞춰 후속 보완.
- D-007: 잔여량 표시·조절이 기존 화면에 남아 있음. 후속 기능 작업에서 제거·정리해야 함.
- D-008/D-010: 더미 구매·폐기 이력을 실사용 분석으로 표현하지 않음.
- D-023: 기존 매칭 숫자를 임베딩 기준으로 복사하지 않음. 7일 fallback을 검증된 식품 기준으로 취급하지 않음.
- D-039: `FoodDbEntry`는 안정적인 ID가 없고 표준명으로 찾음. 1단계에서 상품 ID·식품 ID·참고규칙 ID를 설계해야 함.
- D-040: 날짜 수정은 실제 소비/부패 관측이 아님. 포장지 날짜와 구매 후 남은 기간을 섞어 평균 내지 않음.

## 0단계 결과와 다음 진입 조건

파일 기준 감사·팀 공유 문서 준비와 앱 실행/빌드 재현 검증은 구분한다. 검증 결과는 [VALIDATION.md](VALIDATION.md)에 기록한다.

1단계 설계는 이 소스 기준으로 시작 가능하다. 다만 **기존 개발 빌드와 동일한 상태를 재현했다는 조건은 아직 미충족**이다. 팀이 빌드 소스 커밋·EAS 설정과 누락 실험 파일을 제공하면 증거를 갱신한다. 그 전에는 연구노트 실험을 앱 완료로 표시하지 않는다.
