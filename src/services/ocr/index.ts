import type { MockReceipt, OcrCandidate } from '@/types/food';
import { mlkitOcrEngine } from './mlkitEngine';
import { parseOnlineOrder } from './onlineOrder';
import { parsePaperReceipt } from './paperReceipt';
import type { ParsedReceiptLine } from './receiptParser';
import { matchFoodName } from './foodMatcher';
import { searchCatalog } from '../catalog/search';
import { foods, products, catalogVersion } from '../../data/catalog-stage3';
import { syntheticOnlineOrderLines } from '../../data/onlineOrder.synthetic';

export { parseReceiptLines, guessStoreName } from './receiptParser';
export { matchFoodName } from './foodMatcher';
export { mlkitOcrEngine } from './mlkitEngine';

function candidates(items: ParsedReceiptLine[]): OcrCandidate[] {
  return items.map((item,index)=>{
    const matches=matchFoodName(item.nameCandidate,3).filter(row=>row.score>0);
    const top=matches[0];
    return {id:`ocr-${Date.now()}-${index}`,rawText:item.rawText,
      guessedName:top?.entry.standardName ?? item.nameCandidate,
      alternativeNames:matches.slice(1).map(row=>row.entry.standardName),confidence:top?.score ?? 0,
      category:top?.entry.category ?? '가공식품',quantity:item.quantity,unit:item.unitHint ?? '개',status:'uncertain',
      catalogMatch:__DEV__ ? searchCatalog(item.nameCandidate,{foods,products,version:catalogVersion,synthetic:true}) : undefined};
  });
}

export function createOnlineOrderDemo(): MockReceipt {
  const parsed=parseOnlineOrder(syntheticOnlineOrderLines);
  return {id:`synthetic-${Date.now()}`,inputKind:'coupang',storeName:'합성 온라인 주문 예제',date:parsed.orderDate,
    dateNeedsReview:parsed.dateNeedsReview,rawLines:[...syntheticOnlineOrderLines],candidates:candidates(parsed.items),engine:'mock'};
}

export async function runReceiptOcrPipeline(imageUri: string, inputKind: 'paper' | 'coupang'='coupang'): Promise<MockReceipt> {
  if (!mlkitOcrEngine.isAvailable()) throw new Error('실제 OCR은 ML Kit이 포함된 개발 빌드에서 사용할 수 있습니다.');
  const raw=await mlkitOcrEngine.recognize(imageUri);
  const parsed=inputKind==='paper' ? parsePaperReceipt(raw.lines) : parseOnlineOrder(raw.lines);
  return {id:`live-${Date.now()}`,inputKind,storeName:inputKind==='paper' ? '지류 영수증' : '쿠팡 주문내역',date:parsed.orderDate,dateNeedsReview:parsed.dateNeedsReview,
    rawLines:raw.lines,candidates:candidates(parsed.items),engine:'mlkit'};
}
