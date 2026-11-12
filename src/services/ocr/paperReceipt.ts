import { validDate } from '../feedback/store.ts';
import type { ParsedReceiptLine } from './receiptParser';

// D-050: conservative line parser. Unsupported layouts remain manually reviewable.
export function parsePaperReceipt(lines: string[]) {
  const dates=new Set<string>();
  const items: ParsedReceiptLine[]=[];
  let invalidDate=false;
  for (const raw of lines) {
    const line=raw.trim();
    const date=line.match(/^(?:(?:거래\s*일시|구매\s*일|결제\s*일시)\s*[:：]?\s*)?(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})(?:\D|$)/);
    if(date) {
      const value=`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`;
      if(validDate(value)) dates.add(value); else invalidDate=true;
      continue;
    }
    if (/^(?:합계|총액|부가세|면세|과세|카드|현금|승인|거스름|받은금액|사업자|전화|TEL|주소|매장|영수증|할인액|포인트|상품명|단가|수량)/i.test(line)) continue;
    // Supported columns: name unit-price quantity total-price. Pack size stays in the name.
    const columns=line.match(/^(.+?)\s+([\d,]+)\s+(\d+)\s+([\d,]+)\s*원?$/);
    if(columns && /[가-힣a-z]/i.test(columns[1])) {
      items.push({rawText:line,nameCandidate:columns[1].trim(),quantity:Number(columns[3]),unitHint:'개'});
      continue;
    }
    // A priced item without a quantity requires explicit user correction (zero is not a guess of one).
    const priced=line.match(/^(.+?)\s+[\d,]+\s*원?$/);
    if(priced && /[가-힣a-z]/i.test(priced[1])) {
      items.push({rawText:line,nameCandidate:priced[1].trim(),quantity:0,unitHint:'개'});
    }
  }
  return {items,orderDate:dates.size===1 && !invalidDate ? [...dates][0] : null,
    dateNeedsReview:dates.size!==1 || invalidDate};
}
