# 스마트 냉장고 관리 앱 (7조 과제계획서 구현)

영수증 인식 기반 AI 스마트 냉장고 관리 애플리케이션입니다.
React Native + Expo (Expo Router) 기반이며, **영수증 OCR은 Google ML Kit Text Recognition v2(한국어
모델)로 실제 연동**되어 있습니다. 다만 ML Kit은 네이티브 모듈이라 Expo Go에서는 실행할 수 없고,
**개발 빌드(dev client)** 에서만 카메라로 실제 테스트가 가능합니다. 개발 빌드가 없으면 자동으로
모의(mock) 데이터로 전체 흐름을 보여줍니다 (영수증 등록 화면 상단 배지로 현재 어떤 모드인지 표시됩니다).

## 빠르게 화면 흐름만 보려면 (Expo Go, 실제 기기 불필요)

```bash
npm install
npx expo start
```

터미널의 QR코드를 **Expo Go** 앱으로 스캔하면 바로 실행됩니다. 이 모드에서는 영수증 등록 시
"🟡 모의 인식 데이터를 사용해요" 배지가 뜨고, 미리 준비된 영수증 2종 중 하나로 전체 흐름을 보여줍니다.

## 실기기에서 Google ML Kit OCR 테스트하려면 (개발 빌드 필요)

ML Kit은 네이티브 코드가 포함된 모듈이라 Expo Go에는 들어있지 않습니다. 둘 중 하나로 진행하세요.

**방법 A. 로컬에서 빌드 (Android Studio / Xcode 필요, 무료)**
```bash
npx expo prebuild        # ios/, android/ 네이티브 프로젝트 생성
npx expo run:android     # 연결된 안드로이드 기기/에뮬레이터에 설치 후 실행
# 또는
npx expo run:ios         # Mac + Xcode 필요, 시뮬레이터는 카메라가 없으니 실기기 권장
```

**방법 B. EAS 클라우드 빌드 (Expo 계정 필요, Mac 없어도 iOS 빌드 가능)**
```bash
npm install -g eas-cli
eas login
eas build --profile development --platform android   # 또는 ios
```
빌드가 끝나면 링크로 받은 설치 파일(.apk/.ipa)을 기기에 설치하고, `npx expo start --dev-client`로
개발 서버에 연결하면 됩니다.

개발 빌드로 실행하면 영수증 등록 화면 배지가 "🟢 Google ML Kit 실제 인식 사용 중"으로 바뀌고,
촬영한 영수증 사진이 실제로 텍스트 인식 → 품목 매칭을 거칩니다.

## 화면 구성 (과제계획서 대응)

- **홈** (`src/app/(tabs)/index.tsx`): 오늘 상태 요약, 확인 필요 품목, 오늘의 추천, 데이터 인사이트 미리보기
- **영수증 등록** (`src/app/(tabs)/receipt.tsx`): 촬영/갤러리 선택 → 인식 시작 → 결과 확인 화면으로 이동. 수기 입력도 지원.
- **인식 결과 확인** (`src/app/receipt-result.tsx`): OCR 원문 + 품목 후보 확인/수정/제외 후 등록
- **냉장고 현황** (`src/app/(tabs)/fridge.tsx`): 4단계 상태(파랑/초록/주황/빨강) 필터 + 카드 그리드
- **품목 상세** (`src/app/item/[id].tsx`): 소비기한, 잔여량 조절, 영양정보, 다 먹음/폐기 처리
- **구매추천** (`src/app/(tabs)/recommend.tsx`): 규칙 기반 추천 + **데이터 기반 소비 인사이트**(폐기 추정액, 사용률, 주차별 추이, 카테고리별 낭비)

## OCR·AI 파이프라인 구조 (`src/services/ocr/`)

```
receipt.tsx
  └─ runReceiptOcrPipeline(imageUri)        [index.ts]
       ├─ (개발 빌드) mlkitOcrEngine.recognize()   → Google ML Kit, 한국어 모델
       │     └─ parseReceiptLines()  [receiptParser.ts]  정규식/키워드로 잡음 제거, 수량 추출
       │     └─ matchFoodName()      [foodMatcher.ts]    식품 DB와 유사도 매칭
       └─ (그 외) 미리 만든 모의 영수증 결과 반환
```

- `receiptParser.ts`: 합계/카드/전화번호 등 잡음 줄 제거, 줄 끝 금액 제거, `*3`·`2마리` 같은
  수량 표기 추출. **순수 함수라 기기 없이도 Node에서 바로 테스트 가능** (아래 "검증 방법" 참고).
- `foodMatcher.ts`: 지금은 **문자 2-gram Jaccard 유사도**로 식품 DB(표준명+동의어)와 매칭하는
  임시 구현입니다. 과제계획서의 최종 목표(MiniLM 임베딩 + 코사인 유사도)로 가는 디딤돌이며,
  나중에 이 파일 내부만 임베딩 비교로 교체하면 나머지 파이프라인(파서 → 매칭 → 후보 생성)은
  그대로 재사용됩니다. 자세한 내용은 "다음 단계" 참고.

### 검증 방법 (파서/매칭기만 따로 테스트)
```bash
npx tsx -e "
import { parseReceiptLines, guessStoreName } from './src/services/ocr/receiptParser';
import { matchFoodName } from './src/services/ocr/foodMatcher';
const lines = ['이마트 수원점', '서울우유 1L   2,980', '합계   2,980'];
console.log(guessStoreName(lines));
console.log(parseReceiptLines(lines));
console.log(matchFoodName('서울우유 1L'));
"
```

## 식품 DB 데이터 요청

`src/data/foodDatabase.ts`가 식품 표준명/동의어/보관정보/영양정보 DB입니다. 지금은 16개 품목만
예시로 채워뒀습니다. `data-template/food-db-template.csv`에 같은 형식의 템플릿을 만들어뒀으니,
팀원들이 조사한 식품명·소비기한·영양정보를 이 양식에 맞춰 채워서 주시면 바로
`foodDatabase.ts`에 반영하겠습니다. (형식은 아래 "교수님 피드백" 다음 섹션 참고)

## 실제 구현으로 교체해야 할 자리표시자(placeholder)

| 파일 | 지금은 | 실제로는 |
|---|---|---|
| `src/services/ocr/foodMatcher.ts` | 문자 2-gram 유사도 | MiniLM 임베딩 + 코사인 유사도 (ONNX 변환 + INT8 양자화 필요) |
| `src/context/FridgeContext.tsx` | 메모리(useState) | expo-sqlite 등 단말 내 경량 DB |
| `src/utils/recommend.ts`, `insights.ts` | 더미 구매/폐기 이력으로 계산 | 실제 사용자 구매 이력 누적 데이터로 계산 (로직 자체는 그대로 재사용 가능) |

## 교수님 피드백("데이터 활용 부재") 보완 반영 지점

- `src/utils/insights.ts`: 누적 구매·폐기 이력을 분석해 폐기 추정액, 소비기한 내 사용률,
  알림 효과율, 카테고리별 낭비 순위, 주차별 추이를 계산합니다.
- `(tabs)/recommend.tsx`, `(tabs)/index.tsx`: 위 분석 결과를 사용자에게 바로 보여주는
  "데이터 기반 소비 인사이트" 섹션으로 반영했습니다.

## 다음 단계 (우선순위 순)

1. **실기기로 ML Kit OCR 테스트** — 위 "실기기에서 테스트하려면" 방법 A/B 중 하나로 개발 빌드를
   만들어서, 실제 영수증 사진으로 `parseReceiptLines`/`matchFoodName` 결과 품질 확인
2. **식품 DB 데이터 보강** — `data-template/food-db-template.csv` 양식으로 실제 식품
   표준명/동의어/소비기한 데이터를 받아 `foodDatabase.ts`에 반영 (이후 단계의 전제조건)
3. **MiniLM 임베딩 매칭으로 교체** — `foodMatcher.ts` 내부 구현만 교체. React Native에서
   onnxruntime-react-native 등으로 INT8 양자화된 모델을 돌리는 방법 조사 필요
4. **단말 내 DB(SQLite) 연동** — 지금은 앱을 새로고침하면 더미 데이터로 초기화됨
5. 압력판 기반 비주기 식품 잔여량 트래킹 (하드웨어 연동 필요), 알림(푸시) 기능
