import type { StatusInfo } from '../types/food';
import { daysRemaining } from './date.ts';

// D-050: only calendar boundaries are used. The old 14/45-day and ratio cutoffs
// were unvalidated; a date display must not label food safety as measured truth.
export function computeStatus(purchaseDate: string, expiryDate: string | null): StatusInfo {
  void purchaseDate; // Kept for source compatibility with existing callers.
  if (!expiryDate) return {level:'unknown',color:'#6B7280',label:'기한 미정',description:'포장지 날짜를 확인해 입력해 주세요'};
  const remaining=daysRemaining(expiryDate);
  if (!Number.isFinite(remaining)) return {level:'unknown',color:'#6B7280',label:'날짜 확인',description:'저장된 날짜를 확인해 주세요'};
  if (remaining<0) return {level:'danger',color:'#EF4444',label:'표시기한 경과',description:`입력한 날짜가 ${Math.abs(remaining)}일 지났습니다`};
  if (remaining===0) return {level:'warning',color:'#F59E0B',label:'오늘까지',description:'입력한 날짜가 오늘입니다'};
  return {level:'normal',color:'#22C55E',label:'표시기한 전',description:`입력한 날짜까지 ${remaining}일 남았습니다`};
}

export function remainingRatio(totalQuantity: number, remainingQuantity: number): number {
  if (totalQuantity <= 0) return 0;
  return Math.max(0, Math.min(1, remainingQuantity / totalQuantity));
}
