import { FoodItem, PurchaseHistoryEntry, PurchaseRecommendation } from '@/types/food';
import { findFoodDbEntry } from '@/data/foodDatabase';
import { addDays, daysBetween, todayIso } from './date';

// 과제계획서 "바" 항목: "최근 구매일, 평균 구매주기, 평균 구매량, 현재 잔여량,
// 예상 소진일을 조합한 규칙 기반 알고리즘"
// 초기 데이터가 적어도 적용 가능하도록 2회 이상 구매 이력이 있으면 추천 대상에 포함한다.
export function generateRecommendations(
  history: PurchaseHistoryEntry[],
  fridgeItems: FoodItem[],
): PurchaseRecommendation[] {
  const byName = new Map<string, PurchaseHistoryEntry[]>();
  for (const entry of history) {
    const list = byName.get(entry.standardName) ?? [];
    list.push(entry);
    byName.set(entry.standardName, list);
  }

  const today = todayIso();
  const results: PurchaseRecommendation[] = [];

  for (const [standardName, entries] of byName) {
    if (entries.length < 2) continue; // 데이터 2건 미만이면 신뢰도가 낮아 제외

    const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(daysBetween(sorted[i - 1].date, sorted[i].date));
    }
    const avgCycleDays = Math.round(
      intervals.reduce((sum, d) => sum + d, 0) / intervals.length,
    );
    const lastPurchaseDate = sorted[sorted.length - 1].date;
    const daysSinceLastPurchase = daysBetween(lastPurchaseDate, today);

    // 아직 주기의 70%도 지나지 않았다면 추천하지 않음 (막 구매한 품목 제외)
    if (daysSinceLastPurchase < avgCycleDays * 0.7) continue;

    // 현재 냉장고에 남아있다면, 잔여량이 넉넉하면 추천 우선순위를 낮춘다
    const stillInFridge = fridgeItems.find((i) => i.standardName === standardName);
    const remainingRatio = stillInFridge
      ? stillInFridge.remainingQuantity / stillInFridge.totalQuantity
      : 0;
    if (stillInFridge && remainingRatio > 0.4 && daysSinceLastPurchase < avgCycleDays) continue;

    const predictedRunOutDate = addDays(lastPurchaseDate, avgCycleDays);
    const daysUntilRunOut = daysBetween(today, predictedRunOutDate);

    const urgency: PurchaseRecommendation['urgency'] =
      daysUntilRunOut <= 1 ? 'high' : daysUntilRunOut <= 4 ? 'medium' : 'low';

    const db = findFoodDbEntry(standardName);

    results.push({
      standardName,
      category: db?.category ?? '가공식품',
      icon: db?.icon ?? '🛒',
      lastPurchaseDate,
      avgCycleDays,
      predictedRunOutDate,
      urgency,
      reason: `최근 ${sorted.length}회 구매 데이터 기준 평균 약 ${avgCycleDays}일 주기로 구매하셨고, 마지막 구매 후 ${daysSinceLastPurchase}일이 지났어요.`,
    });
  }

  const urgencyRank = { high: 0, medium: 1, low: 2 };
  return results.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);
}
