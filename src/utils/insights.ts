import { DiscardEntry } from '@/data/discardLog';
import { PurchaseHistoryEntry, FoodCategory } from '@/types/food';
import { daysBetween, todayIso } from './date';

// 데이터 분석 기반 소비 인사이트
// 교수님 피드백("데이터를 활용하는 부분이 없다") 보완을 위해 추가한 모듈.
// 단순히 OCR→분류→표시로 끝나는 것이 아니라, 누적된 구매/폐기 이력을 분석해
// 사용자에게 실질적인 인사이트(절감 추정치, 패턴, 알림 효과)를 돌려준다.

export interface CategoryWaste {
  category: FoodCategory;
  totalValueWon: number;
  count: number;
}

export interface WeeklyWaste {
  weekLabel: string;
  valueWon: number;
}

export interface ConsumptionInsights {
  monthlyWasteWon: number;
  totalWasteWon: number;
  discardCount30d: number;
  purchaseCount30d: number;
  usageBeforeExpiryRate: number; // 0~1, 최근 30일 기준 "폐기 없이 소비 완료 추정" 비율
  warningEffectivenessRate: number; // 0~1, 임박 알림을 받고도 폐기된 비율 (낮을수록 알림이 효과적)
  topWastedCategories: CategoryWaste[];
  weeklyTrend: WeeklyWaste[]; // 최근 4주, 과거→최근 순
}

export function computeConsumptionInsights(
  history: PurchaseHistoryEntry[],
  discardLog: DiscardEntry[],
): ConsumptionInsights {
  const today = todayIso();

  const discard30d = discardLog.filter((d) => daysBetween(d.date, today) <= 30);
  const purchase30d = history.filter((h) => daysBetween(h.date, today) <= 30);

  const monthlyWasteWon = discard30d.reduce((sum, d) => sum + d.estimatedValueWon, 0);
  const totalWasteWon = discardLog.reduce((sum, d) => sum + d.estimatedValueWon, 0);

  // 최근 30일 동안 "구매된 품목 건수" 대비 "폐기된 품목 건수"로
  // 소비기한 내 사용 비율을 추정한다 (근사치 지표)
  const usageBeforeExpiryRate =
    purchase30d.length === 0
      ? 1
      : Math.max(0, 1 - discard30d.length / purchase30d.length);

  const warnedDiscards = discardLog.filter((d) => d.hadWarning).length;
  const warningEffectivenessRate =
    discardLog.length === 0 ? 0 : warnedDiscards / discardLog.length;

  const categoryMap = new Map<FoodCategory, CategoryWaste>();
  for (const d of discardLog) {
    const cur = categoryMap.get(d.category) ?? {
      category: d.category,
      totalValueWon: 0,
      count: 0,
    };
    cur.totalValueWon += d.estimatedValueWon;
    cur.count += 1;
    categoryMap.set(d.category, cur);
  }
  const topWastedCategories = [...categoryMap.values()]
    .sort((a, b) => b.totalValueWon - a.totalValueWon)
    .slice(0, 3);

  // 최근 4주간 주차별 폐기 추정액 (오래된 주 → 최근 주)
  const weeklyTrend: WeeklyWaste[] = [];
  for (let w = 3; w >= 0; w--) {
    const lowerBoundExclusive = w * 7;
    const upperBoundInclusive = w * 7 + 7;
    const valueWon = discardLog
      .filter((d) => {
        const diff = daysBetween(d.date, today);
        return diff > lowerBoundExclusive && diff <= upperBoundInclusive;
      })
      .reduce((sum, d) => sum + d.estimatedValueWon, 0);
    weeklyTrend.push({ weekLabel: w === 0 ? '이번 주' : `${w}주 전`, valueWon });
  }
  // weeklyTrend는 w=3(3주 전) → w=0(이번 주) 순으로 이미 과거→최근 순 정렬되어 있다

  return {
    monthlyWasteWon,
    totalWasteWon,
    discardCount30d: discard30d.length,
    purchaseCount30d: purchase30d.length,
    usageBeforeExpiryRate,
    warningEffectivenessRate,
    topWastedCategories,
    weeklyTrend,
  };
}
