// 식품/냉장고 도메인 타입 정의
// 과제계획서 "나. 영수증 인식 및 전처리", "다. Local AI 기반 식재료 분류", "라. 예상 소비기한 산정" 항목에 대응

export type FoodCategory =
  | '채소'
  | '과일'
  | '유제품'
  | '육류'
  | '수산물'
  | '가공식품'
  | '음료'
  | '곡물/베이커리'
  | '조미료/소스';

export type StorageType = '냉장' | '냉동' | '실온';

// 과제계획서 "라" 항목: 주기 식품 / 비주기 식품 구분
export type ConsumptionPattern = '주기형' | '비주기형';

// 과제계획서 "마" 항목: 4단계 상태 (파랑/초록/주황/빨강)
export type StatusLevel = 'fresh' | 'normal' | 'warning' | 'danger';

export interface StatusInfo {
  level: StatusLevel;
  color: string;
  label: string;
  description: string;
}

// 식품 표준 DB 엔트리 (품목 분류 및 소비기한 산정의 기준 데이터)
export interface FoodDbEntry {
  standardName: string;
  synonyms: string[]; // 영수증에 찍히는 다양한 표기 (OCR 매칭용)
  category: FoodCategory;
  defaultStorage: StorageType;
  shelfLifeUnopenedDays: number; // 미개봉 기준 보관일수
  shelfLifeOpenedDays: number; // 개봉 후 보관일수
  unit: string; // g, ml, 개 등
  icon: string; // 이모지 아이콘 (실제 구현시 대표 이미지로 대체)
  nutrition: {
    calories: number; // kcal / 100g 또는 1개 기준
    protein: number; // g
    fat: number; // g
    carbs: number; // g
  };
  consumptionPattern: ConsumptionPattern;
}

// 사용자가 실제로 냉장고에 보유 중인 품목 인스턴스
export interface FoodItem {
  id: string;
  standardName: string;
  category: FoodCategory;
  storageType: StorageType;
  icon: string;
  purchaseDate: string; // ISO date
  expectedExpiryDate: string; // ISO date, 소비기한 산정 결과
  isOpened: boolean;
  totalQuantity: number;
  remainingQuantity: number;
  unit: string;
  consumptionPattern: ConsumptionPattern;
  nutrition: FoodDbEntry['nutrition'];
  source: '영수증' | '온라인주문' | '수기입력';
}

// 구매/소비 이력 (추천 알고리즘 및 데이터 분석의 기반 데이터)
export interface PurchaseHistoryEntry {
  id: string;
  standardName: string;
  category: FoodCategory;
  date: string; // ISO date
  quantity: number;
  unit: string;
  source: '영수증' | '온라인주문' | '수기입력';
}

export type EventType = 'purchase' | 'consume_update' | 'discard';

// 품목 상세 화면에서 보여줄 사용/소진 이력 (잔여량 변화 추적)
export interface UsageEvent {
  id: string;
  itemId: string;
  date: string;
  type: EventType;
  remainingAfter: number;
}

// 영수증 OCR 인식 후보 (사용자 확인/수정 대상)
export interface OcrCandidate {
  id: string;
  rawText: string; // OCR로 추출된 원문 텍스트
  guessedName: string; // 임베딩 유사도 매칭 1순위 결과
  alternativeNames: string[]; // 유사도 근소한 차이의 대안 후보 (2~3개)
  confidence: number; // 0~1, 코사인 유사도 점수 (모의값)
  category: FoodCategory;
  quantity: number;
  unit: string;
  status: 'confirmed' | 'uncertain' | 'rejected';
}

export interface MockReceipt {
  id: string;
  storeName: string;
  date: string;
  rawLines: string[]; // OCR이 추출했다고 가정하는 원문 줄
  candidates: OcrCandidate[];
  /** 이 결과를 만든 엔진. 실기기 빌드가 아니면 항상 'mock'이다. */
  engine?: 'mlkit' | 'mock';
}

export interface PurchaseRecommendation {
  standardName: string;
  category: FoodCategory;
  icon: string;
  lastPurchaseDate: string;
  avgCycleDays: number;
  predictedRunOutDate: string;
  urgency: 'high' | 'medium' | 'low';
  reason: string;
}
