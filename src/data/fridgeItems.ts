import { FoodItem } from '@/types/food';
import { findFoodDbEntry } from './foodDatabase';
import { addDays, todayIso } from '@/utils/date';

// 현재 냉장고 보유 품목 (모의 데이터)
// 소비기한이 danger/warning/normal/fresh 4단계에 고루 분포하도록 구성해
// "마" 항목 상태 시각화 화면을 바로 확인할 수 있게 함

interface Seed {
  standardName: string;
  purchasedDaysAgo: number;
  expiresInDays: number; // 오늘 기준 (음수면 이미 경과)
  isOpened: boolean;
  totalQuantity: number;
  remainingQuantity: number;
  source: FoodItem['source'];
}

const seeds: Seed[] = [
  { standardName: '흰우유', purchasedDaysAgo: 5, expiresInDays: 0, isOpened: true, totalQuantity: 1000, remainingQuantity: 300, source: '영수증' },
  { standardName: '돼지고기 삼겹살', purchasedDaysAgo: 7, expiresInDays: -1, isOpened: false, totalQuantity: 600, remainingQuantity: 600, source: '영수증' },
  { standardName: '대파', purchasedDaysAgo: 8, expiresInDays: 2, isOpened: true, totalQuantity: 300, remainingQuantity: 180, source: '영수증' },
  { standardName: '방울토마토', purchasedDaysAgo: 7, expiresInDays: 3, isOpened: true, totalQuantity: 500, remainingQuantity: 200, source: '온라인주문' },
  { standardName: '애호박', purchasedDaysAgo: 3, expiresInDays: 4, isOpened: false, totalQuantity: 1, remainingQuantity: 1, source: '영수증' },
  { standardName: '두부', purchasedDaysAgo: 4, expiresInDays: 6, isOpened: true, totalQuantity: 1, remainingQuantity: 0.5, source: '영수증' },
  { standardName: '바나나', purchasedDaysAgo: 1, expiresInDays: 5, isOpened: false, totalQuantity: 6, remainingQuantity: 4, source: '수기입력' },
  { standardName: '닭가슴살', purchasedDaysAgo: 10, expiresInDays: 50, isOpened: false, totalQuantity: 1000, remainingQuantity: 700, source: '온라인주문' },
  { standardName: '김치', purchasedDaysAgo: 40, expiresInDays: 20, isOpened: true, totalQuantity: 2000, remainingQuantity: 600, source: '수기입력' },
  { standardName: '두유', purchasedDaysAgo: 89, expiresInDays: 1, isOpened: false, totalQuantity: 1, remainingQuantity: 1, source: '영수증' },
];

export const fridgeItems: FoodItem[] = seeds.map((seed, index) => {
  const db = findFoodDbEntry(seed.standardName)!;
  const today = todayIso();
  return {
    id: `item-${index + 1}`,
    standardName: db.standardName,
    category: db.category,
    storageType: db.defaultStorage,
    icon: db.icon,
    purchaseDate: addDays(today, -seed.purchasedDaysAgo),
    expectedExpiryDate: addDays(today, seed.expiresInDays),
    isOpened: seed.isOpened,
    totalQuantity: seed.totalQuantity,
    remainingQuantity: seed.remainingQuantity,
    unit: db.unit,
    consumptionPattern: db.consumptionPattern,
    nutrition: db.nutrition,
    source: seed.source,
  };
});

export function getFridgeItemById(id: string): FoodItem | undefined {
  return fridgeItems.find((i) => i.id === id);
}
