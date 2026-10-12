import { StatusInfo, StatusLevel } from '@/types/food';
import { daysBetween, daysRemaining } from './date';

// 과제계획서 "마" 항목: 4단계 상태 색상 체계
// 파랑(여유) / 초록(정상) / 주황(임박) / 빨강(확인 필요·기한 경과)
// "단기, 장기 보관식품 차이를 반영해 남은 기간 비율과 절대 일수를 함께 사용"
export function computeStatus(purchaseDate: string, expiryDate: string): StatusInfo {
  const totalDays = Math.max(1, daysBetween(purchaseDate, expiryDate));
  const remaining = daysRemaining(expiryDate);
  const isShortTerm = totalDays <= 14; // 우유, 채소 등 단기 보관 식품

  let level: StatusLevel;

  if (remaining < 0) {
    level = 'danger';
  } else if (isShortTerm) {
    const ratio = remaining / totalDays;
    if (ratio <= 0.15) level = 'danger';
    else if (ratio <= 0.35) level = 'warning';
    else if (ratio <= 0.7) level = 'normal';
    else level = 'fresh';
  } else {
    if (remaining <= 3) level = 'danger';
    else if (remaining <= 14) level = 'warning';
    else if (remaining <= 45) level = 'normal';
    else level = 'fresh';
  }

  return STATUS_META[level](remaining);
}

const STATUS_META: Record<StatusLevel, (remaining: number) => StatusInfo> = {
  fresh: (remaining) => ({
    level: 'fresh',
    color: '#3B82F6',
    label: '여유',
    description: `소비기한까지 ${remaining}일 여유 있어요`,
  }),
  normal: (remaining) => ({
    level: 'normal',
    color: '#22C55E',
    label: '정상',
    description: `${remaining}일 남았어요`,
  }),
  warning: (remaining) => ({
    level: 'warning',
    color: '#F59E0B',
    label: '임박',
    description: `${remaining}일 남았어요 · 곧 소비하세요`,
  }),
  danger: (remaining) => ({
    level: 'danger',
    color: '#EF4444',
    label: remaining < 0 ? '기한 경과' : '확인 필요',
    description:
      remaining < 0
        ? `예상 소비기한이 ${Math.abs(remaining)}일 지났어요. 상태를 확인해주세요`
        : '오늘 중 상태를 확인해주세요',
  }),
};

export function remainingRatio(totalQuantity: number, remainingQuantity: number): number {
  if (totalQuantity <= 0) return 0;
  return Math.max(0, Math.min(1, remainingQuantity / totalQuantity));
}
