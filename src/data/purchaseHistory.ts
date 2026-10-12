import { PurchaseHistoryEntry } from '@/types/food';
import { findFoodDbEntry } from './foodDatabase';
import { addDays, todayIso } from '@/utils/date';

// 지난 70일간의 구매 이력 (모의 데이터)
// 과제계획서 "바" 항목 구매추천 알고리즘(평균 구매주기, 평균 구매량)과
// 교수님 피드백 보완을 위한 "데이터 분석 기반 소비 인사이트"의 기초 데이터로 사용한다.
// 실제 소비가 완벽한 주기를 띄지 않는다는 점을 반영하기 위해 약간의 변동(jitter)을 둔다.

const JITTER = [0, 1, -1, 0, 2, -1, 0, 1];

function generatePeriodic(
  standardName: string,
  cycleDays: number,
  quantity: number,
  unit: string,
  occurrences: number,
  source: PurchaseHistoryEntry['source'],
): PurchaseHistoryEntry[] {
  const db = findFoodDbEntry(standardName);
  const category = db?.category ?? '가공식품';
  const today = todayIso();
  const entries: PurchaseHistoryEntry[] = [];
  for (let i = occurrences; i >= 1; i--) {
    const jitter = JITTER[i % JITTER.length];
    const daysAgo = cycleDays * i + jitter;
    entries.push({
      id: `${standardName}-${i}`,
      standardName,
      category,
      date: addDays(today, -daysAgo),
      quantity,
      unit,
      source,
    });
  }
  return entries;
}

export const purchaseHistory: PurchaseHistoryEntry[] = [
  ...generatePeriodic('흰우유', 7, 1000, 'ml', 9, '영수증'),
  ...generatePeriodic('바나나', 6, 6, '개', 10, '수기입력'),
  ...generatePeriodic('두부', 5, 1, '개', 12, '영수증'),
  ...generatePeriodic('즉석밥', 12, 6, '개', 5, '온라인주문'),
  ...generatePeriodic('생수', 14, 1, '개', 4, '온라인주문'),
  ...generatePeriodic('두유', 30, 1, '개', 3, '영수증'),
  ...generatePeriodic('계란', 14, 30, '개', 4, '영수증'),
  ...generatePeriodic('대파', 10, 300, 'g', 6, '영수증'),
  ...generatePeriodic('돼지고기 삼겹살', 16, 600, 'g', 4, '영수증'),
  ...generatePeriodic('김치', 45, 2000, 'g', 2, '수기입력'),
]
  // 오늘 이후(미래) 데이터는 제외하고 날짜 순 정렬
  .filter((e) => e.date <= todayIso())
  .sort((a, b) => (a.date < b.date ? 1 : -1));
