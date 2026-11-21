import { validDate } from '../feedback/store.ts';

// 지류 영수증에서 구매일(거래일)을 찾는다.
// - "2026-11-16", "2026.11.16", "2026. 11. 16", "26.11.16", "거래일시: 2026/11/16 13:05" 등
// - 날짜가 없거나, 서로 다른 날짜가 여러 개면 사용자 확인이 필요하다고 표시한다.
const DATE_PATTERN =
  /^(?:(?:거래\s*일시|구매\s*일|결제\s*일시|판매\s*일)\s*[:：]?\s*)?(\d{4}|\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?:\D|$)/;

export function parseReceiptDate(lines: string[]): { orderDate: string | null; dateNeedsReview: boolean } {
  const dates = new Set<string>();
  let invalidDate = false;
  for (const raw of lines) {
    const match = raw.trim().match(DATE_PATTERN);
    if (!match) continue;
    const year = match[1].length === 2 ? `20${match[1]}` : match[1];
    const value = `${year}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    if (validDate(value)) dates.add(value);
    else invalidDate = true;
  }
  return {
    orderDate: dates.size === 1 && !invalidDate ? [...dates][0] : null,
    dateNeedsReview: dates.size !== 1 || invalidDate,
  };
}
