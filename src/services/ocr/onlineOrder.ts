import { validDate } from '../feedback/store.ts';
import type { ParsedReceiptLine } from './receiptParser';

// D-002/D-049: online screenshot text only; date candidates remain user-reviewed claims.
export function parseOnlineOrder(lines: string[]) {
  const dates=new Set<string>();
  const items: ParsedReceiptLine[]=[];
  let invalidDate=false;
  for (const original of lines) {
    const line=original.trim();
    const orderDate=line.match(/^주문\s*일(?:자)?\s*[:：]?\s*(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})(?:\D|$)/);
    if (orderDate) {
      const value=`${orderDate[1]}-${orderDate[2].padStart(2,'0')}-${orderDate[3].padStart(2,'0')}`;
      if (validDate(value)) dates.add(value); else invalidDate=true;
      continue;
    }
    const qty=line.match(/^(?:구매\s*)?수량\s*[:：]?\s*(\d+)\s*개?$/);
    if (qty) {
      if (items.length && Number(qty[1])>0) items[items.length-1].quantity=Number(qty[1]);
      continue;
    }
    if (/^(?:주문\s*내역|주문\s*상세|주문\s*정보|배송\s*완료|배송\s*중|결제\s*완료)$/.test(line)) continue;
    if (/^(?:주문\s*번호|주문\s*일|배송\s*(?:상태|일|예정|비|지)|결제\s*(?:금액|수단)|판매자|수령인|받는\s*분|연락처)\s*[:：]/.test(line)) continue;
    if (/^(?:총\s*)?(?:결제\s*금액|상품\s*금액|합계|배송비)\s*[:：]?\s*[\d,]+\s*원$/.test(line)) continue;
    const name=line.replace(/\s+[\d,]+\s*원$/,'').trim();
    if (name.replace(/\s/g,'').length>=2) items.push({rawText:line,nameCandidate:name,quantity:1});
  }
  return {items,orderDate:dates.size===1 && !invalidDate ? [...dates][0] : null,
    dateNeedsReview:dates.size!==1 || invalidDate};
}
