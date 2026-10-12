// 날짜 계산 유틸 (소비기한 산정의 기준이 되는 함수들)

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// 오늘 기준 남은 일수 (음수면 기한 경과)
export function daysRemaining(expiryIso: string): number {
  return daysBetween(todayIso(), expiryIso);
}

export function formatDateKo(dateIso: string): string {
  const d = new Date(dateIso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
